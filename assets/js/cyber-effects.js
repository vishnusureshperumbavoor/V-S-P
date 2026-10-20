/**
 * ============================================================================
 * VSP Cyber & Futuristic Effects Engine
 * Modular architecture - cleanly separated from index.html
 * ============================================================================
 */

(function () {
  'use strict';

  document.addEventListener('DOMContentLoaded', initCyberEffects);

  function initCyberEffects() {
    initScrollProgressBar();
    initAmbientCursorFollower();
    initEnhancedNeuralMesh();
    initHackerTextScramble();
    init3DCardTilt();
    initGalleryVortex();
  }

  /* --------------------------------------------------------------------------
   * 1. NEON CYBER SCROLL PROGRESS BAR
   * -------------------------------------------------------------------------- */
  function initScrollProgressBar() {
    let bar = document.getElementById('cyber-scroll-progress');
    if (!bar) {
      bar = document.createElement('div');
      bar.id = 'cyber-scroll-progress';
      document.body.prepend(bar);
    }

    let ticking = false;
    window.addEventListener('scroll', () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          const scrollTop = window.scrollY || document.documentElement.scrollTop;
          const docHeight = document.documentElement.scrollHeight - window.innerHeight;
          const progress = docHeight > 0 ? (scrollTop / docHeight) * 100 : 0;
          bar.style.width = Math.min(progress, 100) + '%';
          ticking = false;
        });
        ticking = true;
      }
    }, { passive: true });
  }

  /* --------------------------------------------------------------------------
   * 2. AMBIENT CURSOR AURA GLOW FOLLOWER
   * -------------------------------------------------------------------------- */
  function initAmbientCursorFollower() {
    // Only on pointer devices with hover capability
    if (window.matchMedia('(hover: none)').matches) return;

    let glow = document.getElementById('ambient-cursor-glow');
    if (!glow) {
      glow = document.createElement('div');
      glow.id = 'ambient-cursor-glow';
      document.body.appendChild(glow);
    }

    let mouseX = -1000, mouseY = -1000;
    let currentX = -1000, currentY = -1000;

    window.addEventListener('mousemove', (e) => {
      mouseX = e.clientX;
      mouseY = e.clientY;
    }, { passive: true });

    function renderGlow() {
      // Smooth lerp interpolation for silky motion
      currentX += (mouseX - currentX) * 0.14;
      currentY += (mouseY - currentY) * 0.14;
      glow.style.transform = `translate3d(${currentX}px, ${currentY}px, 0)`;
      requestAnimationFrame(renderGlow);
    }
    renderGlow();
  }

  /* --------------------------------------------------------------------------
   * 3. ENHANCED NEURAL CONSTELLATION (Shockwave + Action Potentials)
   * -------------------------------------------------------------------------- */
  function initEnhancedNeuralMesh() {
    const canvas = document.getElementById('neural-mesh');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    let width = canvas.width = window.innerWidth;
    let height = canvas.height = window.innerHeight;

    window.addEventListener('resize', () => {
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    });

    const isMobile = width < 768;
    const particleCount = isMobile ? 35 : 75;
    const maxDist = isMobile ? 100 : 130;
    const particles = [];
    const shockwaves = [];

    let mouse = { x: null, y: null };

    window.addEventListener('mousemove', (e) => {
      mouse.x = e.clientX;
      mouse.y = e.clientY;
    }, { passive: true });

    window.addEventListener('mouseleave', () => {
      mouse.x = null;
      mouse.y = null;
    });

    // Click shockwave ripple
    window.addEventListener('click', (e) => {
      shockwaves.push({
        x: e.clientX,
        y: e.clientY,
        radius: 5,
        maxRadius: Math.max(width, height) * 0.35,
        opacity: 0.85,
        growth: 7
      });
    });

    for (let i = 0; i < particleCount; i++) {
      particles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.65,
        vy: (Math.random() - 0.5) * 0.65,
        radius: Math.random() * 1.8 + 1,
        baseColor: '#00d679'
      });
    }

    let frameCount = 0;

    function draw() {
      ctx.clearRect(0, 0, width, height);
      frameCount++;

      // Process and render Click Shockwaves
      for (let s = shockwaves.length - 1; s >= 0; s--) {
        const sw = shockwaves[s];
        sw.radius += sw.growth;
        sw.opacity *= 0.94;

        if (sw.opacity < 0.02 || sw.radius > sw.maxRadius) {
          shockwaves.splice(s, 1);
          continue;
        }

        ctx.beginPath();
        ctx.arc(sw.x, sw.y, sw.radius, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(125, 249, 255, ${sw.opacity})`;
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Push particles slightly when shockwave passes
        for (let i = 0; i < particles.length; i++) {
          const p = particles[i];
          const dx = p.x - sw.x;
          const dy = p.y - sw.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (Math.abs(dist - sw.radius) < 25) {
            const force = (1 - Math.abs(dist - sw.radius) / 25) * 3;
            p.vx += (dx / (dist || 1)) * force * 0.08;
            p.vy += (dy / (dist || 1)) * force * 0.08;
          }
        }
      }

      // Update and draw particles
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;

        // Dampen excess velocity back to drift speed
        p.vx *= 0.985;
        p.vy *= 0.985;

        if (p.x < 0 || p.x > width) p.vx *= -1;
        if (p.y < 0 || p.y > height) p.vy *= -1;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = p.baseColor;
        ctx.shadowBlur = 6;
        ctx.shadowColor = '#00d679';
        ctx.fill();
        ctx.shadowBlur = 0;

        // Neural network connections
        for (let j = i + 1; j < particles.length; j++) {
          const p2 = particles[j];
          const dx = p.x - p2.x;
          const dy = p.y - p2.y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < maxDist) {
            const alpha = (1 - dist / maxDist) * 0.35;
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.strokeStyle = 'rgba(0, 214, 121, ' + alpha + ')';
            ctx.lineWidth = 0.8;
            ctx.stroke();
          }
        }

        // Connection to mouse
        if (mouse.x !== null) {
          const mdx = p.x - mouse.x;
          const mdy = p.y - mouse.y;
          const mDist = Math.sqrt(mdx * mdx + mdy * mdy);
          if (mDist < 160) {
            const mAlpha = (1 - mDist / 160) * 0.65;
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(mouse.x, mouse.y);
            ctx.strokeStyle = 'rgba(125, 249, 255, ' + mAlpha + ')';
            ctx.lineWidth = 1;
            ctx.stroke();
          }
        }
      }

      requestAnimationFrame(draw);
    }
    draw();
  }

  /* --------------------------------------------------------------------------
   * 4. HACKER / CYBER TEXT SCRAMBLER EFFECT
   * -------------------------------------------------------------------------- */
  function initHackerTextScramble() {
    const glyphs = '0101XYZ_<>#%*@&+-=/\\~';

    function scramble(element, finalHtml, duration = 1000) {
      if (element.dataset.scrambling === 'true') return;
      element.dataset.scrambling = 'true';

      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = finalHtml;
      const originalText = tempDiv.innerText.trim();

      const startTime = performance.now();
      const length = originalText.length;

      function update(now) {
        const elapsed = now - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const resolvedCount = Math.floor(progress * length);

        let result = '';
        for (let i = 0; i < length; i++) {
          const char = originalText[i];
          if (char === ' ' || char === '\n') {
            result += char;
          } else if (i < resolvedCount) {
            result += char;
          } else {
            result += glyphs[Math.floor(Math.random() * glyphs.length)];
          }
        }

        // Maintain formatting with line break if original had it
        if (finalHtml.includes('<br') || finalHtml.includes('<BR')) {
          const parts = result.split(/\s{2,}|\n/);
          if (parts.length > 1) {
            element.innerHTML = parts.join('<br />');
          } else {
            element.innerText = result;
          }
        } else {
          element.innerText = result;
        }

        if (progress < 1) {
          requestAnimationFrame(update);
        } else {
          element.innerHTML = finalHtml;
          element.dataset.scrambling = 'false';
        }
      }
      requestAnimationFrame(update);
    }

    const bannerText = document.querySelector('.banner-text');
    if (bannerText) {
      bannerText.classList.add('cyber-scramble');
      const targetHtml = bannerText.innerHTML;

      // Run once smoothly on initial load after brief pause
      setTimeout(() => {
        scramble(bannerText, targetHtml, 1100);
      }, 400);

      // Re-trigger on hover
      bannerText.addEventListener('mouseenter', () => {
        scramble(bannerText, targetHtml, 800);
      });
    }

    // Also enable on section headers
    document.querySelectorAll('.row-features h3').forEach((header) => {
      header.classList.add('cyber-scramble');
      const text = header.innerHTML;
      header.addEventListener('mouseenter', () => {
        scramble(header, text, 600);
      });
    });
  }

  /* --------------------------------------------------------------------------
   * 5. 3D CARD PERSPECTIVE TILT & SPECULAR BORDER GLOW
   * -------------------------------------------------------------------------- */
  function init3DCardTilt() {
    if (window.matchMedia('(hover: none)').matches) return;

    const cards = document.querySelectorAll('.w3l-services-block-3 .feature-body');

    cards.forEach((card) => {
      card.addEventListener('mousemove', (e) => {
        const rect = card.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        // Specular glow coordinates
        card.style.setProperty('--glow-x', `${x}px`);
        card.style.setProperty('--glow-y', `${y}px`);

        // 3D tilt angles
        const centerX = rect.width / 2;
        const centerY = rect.height / 2;
        const rotX = ((y - centerY) / centerY) * -7;
        const rotY = ((x - centerX) / centerX) * 7;

        card.style.transform = `perspective(1000px) rotateX(${rotX.toFixed(2)}deg) rotateY(${rotY.toFixed(2)}deg) scale3d(1.025, 1.025, 1.025)`;
      });

      card.addEventListener('mouseleave', () => {
        card.style.transform = 'perspective(1000px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)';
        card.style.setProperty('--glow-x', '-200px');
        card.style.setProperty('--glow-y', '-200px');
      });
    });
  }

  /* --------------------------------------------------------------------------
   * 6. GALLERY COSMIC VORTEX & PARTICLE LIGHTFIELD
   * -------------------------------------------------------------------------- */
  function initGalleryVortex() {
    const gallerySection = document.getElementById('gallery-vsp');
    const canvas = document.getElementById('gallery-fx-canvas');
    if (!gallerySection || !canvas) return;

    const ctx = canvas.getContext('2d');
    let width = canvas.width = gallerySection.offsetWidth;
    let height = canvas.height = gallerySection.offsetHeight;

    window.addEventListener('resize', () => {
      width = canvas.width = gallerySection.offsetWidth;
      height = canvas.height = gallerySection.offsetHeight;
    });

    let isVisible = false;
    let animating = false;

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        isVisible = entry.isIntersecting;
        if (isVisible && !animating) {
          animating = true;
          drawVortex();
        } else if (!isVisible) {
          animating = false;
        }
      });
    }, { threshold: 0.05 });
    observer.observe(gallerySection);

    const colors = ['#00d679', '#7df9ff', '#c084fc', '#38bdf8'];
    const particleCount = width > 768 ? 65 : 30;
    const particles = [];
    let mouse = { x: null, y: null, active: false };

    gallerySection.addEventListener('mousemove', (e) => {
      const rect = gallerySection.getBoundingClientRect();
      mouse.x = e.clientX - rect.left;
      mouse.y = e.clientY - rect.top;
      mouse.active = true;
    }, { passive: true });

    gallerySection.addEventListener('mouseleave', () => {
      mouse.active = false;
    });

    for (let i = 0; i < particleCount; i++) {
      particles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.8,
        vy: (Math.random() - 0.5) * 0.8,
        radius: Math.random() * 2.2 + 0.8,
        color: colors[Math.floor(Math.random() * colors.length)],
        alpha: Math.random() * 0.5 + 0.3,
        pulseOffset: Math.random() * Math.PI * 2
      });
    }

    let frame = 0;

    function drawVortex() {
      if (!isVisible) {
        animating = false;
        return;
      }
      ctx.clearRect(0, 0, width, height);
      frame++;

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];

        // Gravitational vortex attraction toward mouse
        if (mouse.active && mouse.x !== null) {
          const dx = mouse.x - p.x;
          const dy = mouse.y - p.y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < 260 && dist > 15) {
            const force = (1 - dist / 260) * 0.9;
            // Tangential spiral + inward pull
            p.vx += (dx / dist) * force * 0.12 - (dy / dist) * force * 0.08;
            p.vy += (dy / dist) * force * 0.12 + (dx / dist) * force * 0.08;
          }
        }

        p.x += p.vx;
        p.y += p.vy;
        p.vx *= 0.98;
        p.vy *= 0.98;

        // Base drift
        p.x += Math.sin(frame * 0.015 + p.pulseOffset) * 0.3;
        p.y += Math.cos(frame * 0.015 + p.pulseOffset) * 0.3;

        if (p.x < 0) p.x = width;
        if (p.x > width) p.x = 0;
        if (p.y < 0) p.y = height;
        if (p.y > height) p.y = 0;

        // Draw glowing particle
        const dynamicAlpha = p.alpha * (0.8 + 0.2 * Math.sin(frame * 0.04 + p.pulseOffset));
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.globalAlpha = dynamicAlpha;
        ctx.shadowBlur = 10;
        ctx.shadowColor = p.color;
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.globalAlpha = 1;

        // Light trails connecting nearby particles in the gallery
        for (let j = i + 1; j < particles.length; j++) {
          const p2 = particles[j];
          const cdx = p.x - p2.x;
          const cdy = p.y - p2.y;
          const cdist = Math.sqrt(cdx * cdx + cdy * cdy);

          if (cdist < 95) {
            const linkAlpha = (1 - cdist / 95) * 0.25;
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.strokeStyle = `rgba(125, 249, 255, ${linkAlpha})`;
            ctx.lineWidth = 0.6;
            ctx.stroke();
          }
        }
      }

      requestAnimationFrame(drawVortex);
    }
  }
})();
