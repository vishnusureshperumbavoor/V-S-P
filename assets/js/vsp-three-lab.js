/**
 * ============================================================================
 * VSP 3D Interactive Laboratory Engine
 * Powered by Three.js (r128) & WebGL Shaders
 * Author: Vishnu Suresh Perumbavoor (VSP)
 * ============================================================================
 */

(function () {
  'use strict';

  // Ensure Three.js is available
  if (typeof THREE === 'undefined') {
    console.error('Three.js library is required for VSP 3D Lab.');
    return;
  }

  // DOM Elements
  const container = document.getElementById('vsp-three-viewport');
  const designNameEl = document.getElementById('vsp-design-name');
  const fpsCounterEl = document.getElementById('vsp-hud-fps');
  const polyCounterEl = document.getElementById('vsp-hud-polys');
  const autoSpinBtn = document.getElementById('vsp-toggle-spin');
  const themeBtn = document.getElementById('vsp-toggle-theme');
  const switcherBtns = document.querySelectorAll('.vsp-mode-btn');

  if (!container) return;

  // Scene state
  let currentDesign = 'matrix';
  let autoSpin = true;
  let activeThemeIndex = 0;
  const themes = [
    { name: 'EMERALD // CYAN', primary: 0x00d679, secondary: 0x7df9ff, hex1: '#00d679', hex2: '#7df9ff' },
    { name: 'ELECTRIC CYAN', primary: 0x7df9ff, secondary: 0x00d679, hex1: '#7df9ff', hex2: '#00d679' },
    { name: 'HYPER VIOLET', primary: 0xa855f7, secondary: 0x7df9ff, hex1: '#a855f7', hex2: '#7df9ff' }
  ];

  // Design metadata (Small text displayed at top corner as requested)
  const designDirectory = {
    matrix: {
      name: 'CYBERNETIC 3D VSP HOLOGRAPHIC MATRIX',
      category: 'DESIGN 01 // WIREFRAME HUD',
      cameraZ: 110,
    },
    swarm: {
      name: 'QUANTUM VSP PARTICLE SWARM & MORPH',
      category: 'DESIGN 02 // KINETIC PARTICLES',
      cameraZ: 95,
    },
    synaptic: {
      name: 'NEON SYNAPTIC VSP HYPER-LATTICE',
      category: 'DESIGN 03 // NEURAL TOPOLOGY',
      cameraZ: 105,
    },
    radar: {
      name: 'ORBITAL VSP GYROSCOPE & RADAR CORE',
      category: 'DESIGN 04 // ROTATIONAL GIMBAL',
      cameraZ: 115,
    }
  };

  // Three.js Core Variables
  let scene, camera, renderer, controls;
  let activeGroup = new THREE.Group();
  let animationFrameId = null;
  let clock = new THREE.Clock();

  // Mouse & Interaction
  const mouse = new THREE.Vector2(-1000, -1000);
  const targetMouse = new THREE.Vector2(0, 0);
  const raycaster = new THREE.Raycaster();
  const interactionPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
  const planeIntersection = new THREE.Vector3();

  // Telemetry trackers
  let frameCount = 0;
  let lastTime = performance.now();
  let currentFps = 60;

  // ==========================================================================
  // 1. Vector Coordinates for "V", "S", "P" Typography
  // Precision mathematical vector point sets defining the letter strokes
  // ==========================================================================
  const V_PATH = [
    new THREE.Vector3(-42, 22, 0),
    new THREE.Vector3(-28, -22, 0),
    new THREE.Vector3(-14, 22, 0)
  ];

  const S_PATH = [
    new THREE.Vector3(8, 22, 0),
    new THREE.Vector3(-4, 22, 0),
    new THREE.Vector3(-7, 10, 0),
    new THREE.Vector3(5, 0, 0),
    new THREE.Vector3(8, -10, 0),
    new THREE.Vector3(5, -22, 0),
    new THREE.Vector3(-7, -22, 0)
  ];

  const P_SPINE = [
    new THREE.Vector3(16, -22, 0),
    new THREE.Vector3(16, 22, 0)
  ];

  const P_LOOP = [
    new THREE.Vector3(16, 22, 0),
    new THREE.Vector3(32, 22, 0),
    new THREE.Vector3(37, 14, 0),
    new THREE.Vector3(37, 6, 0),
    new THREE.Vector3(32, 0, 0),
    new THREE.Vector3(16, 0, 0)
  ];

  // Helper to sample dense points along line segments for particle swarm
  function sampleSegment(p1, p2, count) {
    const pts = [];
    for (let i = 0; i <= count; i++) {
      const t = i / count;
      pts.push(new THREE.Vector3().lerpVectors(p1, p2, t));
    }
    return pts;
  }

  function getVspLetterPoints(densityMultiplier = 1) {
    const points = [];
    const step = 25 * densityMultiplier;

    // V letter
    points.push(...sampleSegment(V_PATH[0], V_PATH[1], step));
    points.push(...sampleSegment(V_PATH[1], V_PATH[2], step));

    // S letter
    for (let i = 0; i < S_PATH.length - 1; i++) {
      points.push(...sampleSegment(S_PATH[i], S_PATH[i + 1], Math.floor(step * 0.45)));
    }

    // P letter spine
    points.push(...sampleSegment(P_SPINE[0], P_SPINE[1], step));
    // P letter loop
    for (let i = 0; i < P_LOOP.length - 1; i++) {
      points.push(...sampleSegment(P_LOOP[i], P_LOOP[i + 1], Math.floor(step * 0.4)));
    }

    return points;
  }

  // ==========================================================================
  // 2. Three.js Initialization & Setup
  // ==========================================================================
  function initThree() {
    // Scene
    scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x03060a, 0.004);

    // Camera
    const aspect = window.innerWidth / window.innerHeight;
    camera = new THREE.PerspectiveCamera(45, aspect, 0.1, 1000);
    camera.position.set(0, 10, 110);

    // Renderer
    renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance'
    });
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    renderer.setPixelRatio(dpr);
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.25;

    // Clear previous canvases if any
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    // OrbitControls
    if (typeof THREE.OrbitControls !== 'undefined') {
      controls = new THREE.OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true;
      controls.dampingFactor = 0.05;
      controls.rotateSpeed = 0.75;
      controls.maxDistance = 250;
      controls.minDistance = 35;
      controls.enablePan = true;
    }

    // Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.65);
    scene.add(ambientLight);

    const primaryLight = new THREE.PointLight(themes[0].primary, 3, 200);
    primaryLight.position.set(-30, 40, 50);
    primaryLight.name = 'primaryLight';
    scene.add(primaryLight);

    const secondaryLight = new THREE.PointLight(themes[0].secondary, 3, 200);
    secondaryLight.position.set(30, -30, 40);
    secondaryLight.name = 'secondaryLight';
    scene.add(secondaryLight);

    // Add main dynamic group
    scene.add(activeGroup);

    // Build default design
    loadDesign('matrix');

    // Attach Event Listeners
    window.addEventListener('resize', onWindowResize, false);
    window.addEventListener('mousemove', onMouseMove, false);
    window.addEventListener('touchmove', onTouchMove, { passive: true });

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        if (animationFrameId) cancelAnimationFrame(animationFrameId);
      } else {
        clock.start();
        animate();
      }
    });

    animate();
  }

  // ==========================================================================
  // 3. Design 1: CYBERNETIC 3D VSP HOLOGRAPHIC MATRIX
  // ==========================================================================
  function createMatrixDesign() {
    const group = new THREE.Group();
    const theme = themes[activeThemeIndex];

    // Helper: Build 3D Extruded Tube for path
    function buildTube(points, radius = 1.4, color = theme.primary) {
      const curve = new THREE.CatmullRomCurve3(points, false, 'catmullrom', 0.1);
      const tubeGeo = new THREE.TubeGeometry(curve, 64, radius, 8, false);
      
      // Wireframe outer
      const wireMat = new THREE.MeshBasicMaterial({
        color: color,
        wireframe: true,
        transparent: true,
        opacity: 0.85
      });
      const wireMesh = new THREE.Mesh(tubeGeo, wireMat);

      // Inner glowing core
      const coreMat = new THREE.MeshStandardMaterial({
        color: 0x051015,
        emissive: color,
        emissiveIntensity: 0.45,
        roughness: 0.2,
        metalness: 0.8
      });
      const coreMesh = new THREE.Mesh(tubeGeo, coreMat);
      coreMesh.scale.set(0.7, 0.7, 0.7);

      const letterGroup = new THREE.Group();
      letterGroup.add(wireMesh);
      letterGroup.add(coreMesh);
      return letterGroup;
    }

    // Add V, S, P 3D Letters
    const letterV = buildTube(V_PATH, 1.8, theme.primary);
    const letterS = buildTube(S_PATH, 1.8, theme.secondary);
    const letterP1 = buildTube(P_SPINE, 1.8, theme.primary);
    const letterP2 = buildTube(P_LOOP, 1.8, theme.primary);

    group.add(letterV);
    group.add(letterS);
    group.add(letterP1);
    group.add(letterP2);

    // Orbiting Concentric Cyber Gimbal Rings
    const ringMat1 = new THREE.LineDashedMaterial({
      color: theme.secondary,
      dashSize: 4,
      gapSize: 2,
      linewidth: 1.5
    });
    const ringGeo1 = new THREE.BufferGeometry().setFromPoints(
      new THREE.Path().absarc(0, 0, 56, 0, Math.PI * 2, true).getPoints(90)
    );
    const ring1 = new THREE.Line(ringGeo1, ringMat1);
    ring1.computeLineDistances();
    ring1.rotation.x = Math.PI / 2.8;
    ring1.name = 'ring1';
    group.add(ring1);

    const ringMat2 = new THREE.LineDashedMaterial({
      color: theme.primary,
      dashSize: 6,
      gapSize: 4,
      linewidth: 1.5
    });
    const ringGeo2 = new THREE.BufferGeometry().setFromPoints(
      new THREE.Path().absarc(0, 0, 68, 0, Math.PI * 2, true).getPoints(100)
    );
    const ring2 = new THREE.Line(ringGeo2, ringMat2);
    ring2.computeLineDistances();
    ring2.rotation.y = Math.PI / 3.5;
    ring2.name = 'ring2';
    group.add(ring2);

    // Ground Cyber Grid
    const grid = new THREE.GridHelper(260, 48, theme.primary, 0x101a24);
    grid.position.y = -35;
    group.add(grid);

    // Ambient Hologram Star Field
    const starGeo = new THREE.BufferGeometry();
    const starCount = 500;
    const starPos = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount * 3; i += 3) {
      starPos[i] = (Math.random() - 0.5) * 220;
      starPos[i + 1] = (Math.random() - 0.5) * 160;
      starPos[i + 2] = (Math.random() - 0.5) * 160;
    }
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
    const starMat = new THREE.PointsMaterial({
      color: theme.secondary,
      size: 1.5,
      transparent: true,
      opacity: 0.65
    });
    const starField = new THREE.Points(starGeo, starMat);
    starField.name = 'starField';
    group.add(starField);

    group.userData = {
      animate: function (time) {
        ring1.rotation.z = time * 0.35;
        ring2.rotation.z = -time * 0.28;
        ring2.rotation.x = Math.sin(time * 0.4) * 0.35;
        starField.rotation.y = time * 0.05;

        // Subtle breathing
        const scale = 1 + Math.sin(time * 1.5) * 0.02;
        letterV.scale.set(scale, scale, scale);
        letterS.scale.set(scale, scale, scale);
        letterP1.scale.set(scale, scale, scale);
        letterP2.scale.set(scale, scale, scale);
      }
    };

    return group;
  }

  // ==========================================================================
  // 4. Design 2: QUANTUM VSP PARTICLE SWARM & MORPH
  // ==========================================================================
  function createSwarmDesign() {
    const group = new THREE.Group();
    const theme = themes[activeThemeIndex];

    const basePoints = getVspLetterPoints(8);
    const particleCount = basePoints.length * 6; // ~3,600 quantum particles
    const positions = new Float32Array(particleCount * 3);
    const homePositions = new Float32Array(particleCount * 3);
    const velocities = new Float32Array(particleCount * 3);
    const colors = new Float32Array(particleCount * 3);

    const c1 = new THREE.Color(theme.primary);
    const c2 = new THREE.Color(theme.secondary);

    for (let i = 0; i < particleCount; i++) {
      const base = basePoints[i % basePoints.length];
      const jitterX = (Math.random() - 0.5) * 4;
      const jitterY = (Math.random() - 0.5) * 4;
      const jitterZ = (Math.random() - 0.5) * 6;

      const x = base.x + jitterX;
      const y = base.y + jitterY;
      const z = base.z + jitterZ;

      positions[i * 3] = x;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = z;

      homePositions[i * 3] = x;
      homePositions[i * 3 + 1] = y;
      homePositions[i * 3 + 2] = z;

      velocities[i * 3] = 0;
      velocities[i * 3 + 1] = 0;
      velocities[i * 3 + 2] = 0;

      // Color gradient based on X position
      const t = (x + 45) / 90;
      const col = new THREE.Color().lerpColors(c1, c2, Math.max(0, Math.min(1, t)));
      colors[i * 3] = col.r;
      colors[i * 3 + 1] = col.g;
      colors[i * 3 + 2] = col.b;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    // Custom circle particle texture
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    const grad = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, 'rgba(255, 255, 255, 1)');
    grad.addColorStop(0.35, 'rgba(0, 214, 121, 0.85)');
    grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 64, 64);
    const particleTex = new THREE.CanvasTexture(canvas);

    const material = new THREE.PointsMaterial({
      size: 2.4,
      vertexColors: true,
      map: particleTex,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });

    const pointCloud = new THREE.Points(geometry, material);
    group.add(pointCloud);

    // Surrounding quantum field bounds
    const cageGeo = new THREE.WireframeGeometry(new THREE.BoxGeometry(95, 55, 25));
    const cageMat = new THREE.LineBasicMaterial({ color: theme.secondary, transparent: true, opacity: 0.15 });
    const cage = new THREE.LineSegments(cageGeo, cageMat);
    group.add(cage);

    group.userData = {
      animate: function (time) {
        const pos = geometry.attributes.position.array;
        raycaster.setFromCamera(mouse, camera);
        raycaster.ray.intersectPlane(interactionPlane, planeIntersection);

        for (let i = 0; i < particleCount; i++) {
          const i3 = i * 3;
          let px = pos[i3];
          let py = pos[i3 + 1];
          let pz = pos[i3 + 2];

          const hx = homePositions[i3];
          const hy = homePositions[i3 + 1];
          const hz = homePositions[i3 + 2];

          // Harmonic wave float
          const wave = Math.sin(time * 2 + px * 0.08) * 0.8;

          // Mouse repulsion in 3D
          const dx = px - planeIntersection.x;
          const dy = py - planeIntersection.y;
          const dz = pz - planeIntersection.z;
          const dist = Math.hypot(dx, dy, dz);

          if (dist < 26 && dist > 0.001) {
            const force = (26 - dist) / 26;
            velocities[i3] += (dx / dist) * force * 1.8;
            velocities[i3 + 1] += (dy / dist) * force * 1.8;
            velocities[i3 + 2] += (dz / dist) * force * 1.8;
          }

          // Spring return to home position
          velocities[i3] += (hx - px) * 0.045;
          velocities[i3 + 1] += (hy + wave - py) * 0.045;
          velocities[i3 + 2] += (hz - pz) * 0.045;

          // Drag damping
          velocities[i3] *= 0.88;
          velocities[i3 + 1] *= 0.88;
          velocities[i3 + 2] *= 0.88;

          pos[i3] += velocities[i3];
          pos[i3 + 1] += velocities[i3 + 1];
          pos[i3 + 2] += velocities[i3 + 2];
        }

        geometry.attributes.position.needsUpdate = true;
      }
    };

    return group;
  }

  // ==========================================================================
  // 5. Design 3: NEON SYNAPTIC VSP HYPER-LATTICE
  // ==========================================================================
  function createSynapticDesign() {
    const group = new THREE.Group();
    const theme = themes[activeThemeIndex];

    const nodesGroup = new THREE.Group();
    const beamsGroup = new THREE.Group();
    const packetsGroup = new THREE.Group();

    // Key vertices for the VSP letters
    const allVertices = [
      ...V_PATH,
      ...S_PATH,
      ...P_SPINE,
      ...P_LOOP
    ];

    // Node spheres
    const nodeGeo = new THREE.IcosahedronGeometry(1.8, 2);
    const nodeMat = new THREE.MeshStandardMaterial({
      color: theme.primary,
      emissive: theme.primary,
      emissiveIntensity: 0.8,
      roughness: 0.2,
      metalness: 0.9
    });

    allVertices.forEach((v) => {
      const mesh = new THREE.Mesh(nodeGeo, nodeMat);
      mesh.position.copy(v);
      nodesGroup.add(mesh);
    });

    // Connecting Synaptic Energy Beams
    const beamLines = [
      [V_PATH[0], V_PATH[1]],
      [V_PATH[1], V_PATH[2]],
      [S_PATH[0], S_PATH[1]],
      [S_PATH[1], S_PATH[2]],
      [S_PATH[2], S_PATH[3]],
      [S_PATH[3], S_PATH[4]],
      [S_PATH[4], S_PATH[5]],
      [S_PATH[5], S_PATH[6]],
      [P_SPINE[0], P_SPINE[1]],
      [P_LOOP[0], P_LOOP[1]],
      [P_LOOP[1], P_LOOP[2]],
      [P_LOOP[2], P_LOOP[3]],
      [P_LOOP[3], P_LOOP[4]],
      [P_LOOP[4], P_LOOP[5]]
    ];

    beamLines.forEach(([p1, p2]) => {
      const lineGeo = new THREE.BufferGeometry().setFromPoints([p1, p2]);
      const lineMat = new THREE.LineBasicMaterial({
        color: theme.secondary,
        transparent: true,
        opacity: 0.85,
        linewidth: 2
      });
      beamsGroup.add(new THREE.Line(lineGeo, lineMat));
    });

    // Energy packets flowing along letter circuits
    const packetGeo = new THREE.SphereGeometry(1.1, 12, 12);
    const packetMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const packetCount = 10;
    const packetData = [];

    for (let i = 0; i < packetCount; i++) {
      const mesh = new THREE.Mesh(packetGeo, packetMat);
      packetsGroup.add(mesh);
      packetData.push({
        mesh: mesh,
        lineIndex: i % beamLines.length,
        progress: Math.random(),
        speed: 0.4 + Math.random() * 0.5
      });
    }

    // Surrounding Geodesic Icosahedron Shield
    const shieldGeo = new THREE.IcosahedronGeometry(62, 1);
    const shieldMat = new THREE.MeshBasicMaterial({
      color: theme.primary,
      wireframe: true,
      transparent: true,
      opacity: 0.14
    });
    const shield = new THREE.Mesh(shieldGeo, shieldMat);
    group.add(shield);

    group.add(nodesGroup);
    group.add(beamsGroup);
    group.add(packetsGroup);

    group.userData = {
      animate: function (time) {
        shield.rotation.y = time * 0.12;
        shield.rotation.x = time * 0.08;

        packetData.forEach((p) => {
          p.progress += 0.015 * p.speed;
          if (p.progress > 1) p.progress = 0;

          const pair = beamLines[p.lineIndex];
          p.mesh.position.lerpVectors(pair[0], pair[1], p.progress);
        });

        // Pulsing nodes
        const pulse = 1 + Math.sin(time * 3) * 0.15;
        nodesGroup.children.forEach((n) => {
          n.scale.set(pulse, pulse, pulse);
        });
      }
    };

    return group;
  }

  // ==========================================================================
  // 6. Design 4: ORBITAL VSP GYROSCOPE & RADAR CORE
  // ==========================================================================
  function createRadarDesign() {
    const group = new THREE.Group();
    const theme = themes[activeThemeIndex];

    // Inner Centered 3D VSP Monogram
    const vspCore = new THREE.Group();
    const coreMat = new THREE.LineBasicMaterial({ color: theme.secondary, linewidth: 2 });

    const vGeo = new THREE.BufferGeometry().setFromPoints(V_PATH);
    const sGeo = new THREE.BufferGeometry().setFromPoints(S_PATH);
    const p1Geo = new THREE.BufferGeometry().setFromPoints(P_SPINE);
    const p2Geo = new THREE.BufferGeometry().setFromPoints(P_LOOP);

    vspCore.add(new THREE.Line(vGeo, coreMat));
    vspCore.add(new THREE.Line(sGeo, coreMat));
    vspCore.add(new THREE.Line(p1Geo, coreMat));
    vspCore.add(new THREE.Line(p2Geo, coreMat));
    group.add(vspCore);

    // Multi-Axis Gyroscope Rings
    function makeGimbal(radius, color, rotationAxis) {
      const ringGeo = new THREE.TorusGeometry(radius, 0.9, 8, 80);
      const ringMat = new THREE.MeshStandardMaterial({
        color: color,
        emissive: color,
        emissiveIntensity: 0.5,
        roughness: 0.25,
        metalness: 0.85
      });
      const mesh = new THREE.Mesh(ringGeo, ringMat);
      mesh.userData = { rotationAxis };
      return mesh;
    }

    const gimbal1 = makeGimbal(48, theme.primary, 'x');
    const gimbal2 = makeGimbal(58, theme.secondary, 'y');
    const gimbal3 = makeGimbal(68, theme.primary, 'z');

    group.add(gimbal1);
    group.add(gimbal2);
    group.add(gimbal3);

    // Radar Scanning Beam / Slice
    const radarGeo = new THREE.RingGeometry(0.1, 72, 32, 1, 0, Math.PI / 3);
    const radarMat = new THREE.MeshBasicMaterial({
      color: theme.primary,
      transparent: true,
      opacity: 0.25,
      side: THREE.DoubleSide
    });
    const radarSweep = new THREE.Mesh(radarGeo, radarMat);
    radarSweep.rotation.x = Math.PI / 2;
    group.add(radarSweep);

    // Target telemetry crosshairs
    const crosshairGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(-75, 0, 0), new THREE.Vector3(75, 0, 0),
      new THREE.Vector3(0, -75, 0), new THREE.Vector3(0, 75, 0)
    ]);
    const crosshairMat = new THREE.LineDashedMaterial({
      color: theme.secondary,
      dashSize: 6,
      gapSize: 6
    });
    const crosshair = new THREE.LineSegments(crosshairGeo, crosshairMat);
    crosshair.computeLineDistances();
    group.add(crosshair);

    group.userData = {
      animate: function (time) {
        gimbal1.rotation.x = time * 0.6;
        gimbal1.rotation.y = time * 0.3;

        gimbal2.rotation.y = -time * 0.45;
        gimbal2.rotation.z = time * 0.25;

        gimbal3.rotation.z = time * 0.35;
        gimbal3.rotation.x = -time * 0.2;

        radarSweep.rotation.z = -time * 2.2;
        vspCore.rotation.y = Math.sin(time) * 0.35;
      }
    };

    return group;
  }

  // ==========================================================================
  // 7. Design Switcher & Cleanup Engine
  // ==========================================================================
  function loadDesign(designKey) {
    if (!designDirectory[designKey]) return;
    currentDesign = designKey;

    // Dispose old geometries and materials to avoid WebGL memory leaks
    while (activeGroup.children.length > 0) {
      const obj = activeGroup.children[0];
      activeGroup.remove(obj);
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material) {
        if (Array.isArray(obj.material)) {
          obj.material.forEach((m) => m.dispose());
        } else {
          obj.material.dispose();
        }
      }
    }

    // Build new design
    let newDesignGroup;
    switch (designKey) {
      case 'matrix':
        newDesignGroup = createMatrixDesign();
        break;
      case 'swarm':
        newDesignGroup = createSwarmDesign();
        break;
      case 'synaptic':
        newDesignGroup = createSynapticDesign();
        break;
      case 'radar':
        newDesignGroup = createRadarDesign();
        break;
      default:
        newDesignGroup = createMatrixDesign();
    }

    activeGroup.add(newDesignGroup);
    activeGroup.userData = newDesignGroup.userData;

    // Update camera distance smoothly
    const targetZ = designDirectory[designKey].cameraZ;
    if (controls) {
      controls.target.set(0, 0, 0);
    }
    camera.position.set(0, 10, targetZ);

    // Update Top Corner Design Name HUD (Primary User Request!)
    updateTopCornerDesignName(designKey);

    // Update switcher buttons UI
    switcherBtns.forEach((btn) => {
      if (btn.getAttribute('data-design') === designKey) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    // Update poly counter in telemetry HUD
    updateTelemetryStats();
  }

  function updateTopCornerDesignName(designKey) {
    const meta = designDirectory[designKey];
    if (designNameEl && meta) {
      designNameEl.textContent = meta.name;
    }
    const catEl = document.querySelector('.vsp-hud-category');
    if (catEl && meta) {
      catEl.textContent = meta.category;
    }
  }

  function updateTelemetryStats() {
    let polyCount = 0;
    activeGroup.traverse((child) => {
      if (child.isMesh && child.geometry) {
        if (child.geometry.index) {
          polyCount += child.geometry.index.count / 3;
        } else if (child.geometry.attributes.position) {
          polyCount += child.geometry.attributes.position.count / 3;
        }
      } else if (child.isPoints && child.geometry) {
        polyCount += child.geometry.attributes.position.count;
      }
    });
    if (polyCounterEl) {
      polyCounterEl.textContent = Math.round(polyCount).toLocaleString();
    }
  }

  // ==========================================================================
  // 8. Animation & Render Loop
  // ==========================================================================
  function animate() {
    animationFrameId = requestAnimationFrame(animate);

    const elapsedTime = clock.getElapsedTime();

    // Auto-spin scene
    if (autoSpin) {
      activeGroup.rotation.y = elapsedTime * 0.15;
    }

    // Call active design animation routine
    if (activeGroup.userData && typeof activeGroup.userData.animate === 'function') {
      activeGroup.userData.animate(elapsedTime);
    }

    // Update OrbitControls
    if (controls) {
      controls.update();
    }

    renderer.render(scene, camera);

    // FPS Meter
    frameCount++;
    const now = performance.now();
    if (now - lastTime >= 1000) {
      currentFps = Math.round((frameCount * 1000) / (now - lastTime));
      if (fpsCounterEl) {
        fpsCounterEl.textContent = currentFps;
      }
      frameCount = 0;
      lastTime = now;
    }
  }

  // ==========================================================================
  // 9. Event Listeners & Interaction Handlers
  // ==========================================================================
  function onWindowResize() {
    const width = window.innerWidth;
    const height = window.innerHeight;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  }

  function onMouseMove(event) {
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
  }

  function onTouchMove(event) {
    if (event.touches.length > 0) {
      mouse.x = (event.touches[0].clientX / window.innerWidth) * 2 - 1;
      mouse.y = -(event.touches[0].clientY / window.innerHeight) * 2 + 1;
    }
  }

  // Hook UI Switcher Buttons
  switcherBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      const designKey = btn.getAttribute('data-design');
      if (designKey && designKey !== currentDesign) {
        loadDesign(designKey);
      }
    });
  });

  // Auto-Spin Toggle Button
  if (autoSpinBtn) {
    autoSpinBtn.addEventListener('click', () => {
      autoSpin = !autoSpin;
      autoSpinBtn.classList.toggle('active', autoSpin);
      autoSpinBtn.innerHTML = autoSpin
        ? '<i class="fa-solid fa-rotate"></i> Auto-Spin: ON'
        : '<i class="fa-solid fa-pause"></i> Auto-Spin: OFF';
    });
  }

  // Theme Toggle Button
  if (themeBtn) {
    themeBtn.addEventListener('click', () => {
      activeThemeIndex = (activeThemeIndex + 1) % themes.length;
      const theme = themes[activeThemeIndex];
      themeBtn.innerHTML = `<i class="fa-solid fa-palette"></i> Theme: ${theme.name.split(' // ')[0]}`;

      const pLight = scene.getObjectByName('primaryLight');
      const sLight = scene.getObjectByName('secondaryLight');
      if (pLight) pLight.color.setHex(theme.primary);
      if (sLight) sLight.color.setHex(theme.secondary);

      // Reload current design with new theme
      loadDesign(currentDesign);
    });
  }

  // Initialize
  initThree();
})();
