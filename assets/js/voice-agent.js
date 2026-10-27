/**
 * ============================================================================
 * VSP Voice Bot AI - Conversational Voice Agent Engine
 * Features:
 * - Dynamic Radial Audio Spectrum Visualizer (Live microphone & speech frequency dancing)
 * - Clear AI Model Status Feedback ("AI Model Ready", "Listening...", "Processing...", "Speaking...")
 * - Fixed Bottom Live Caption (Shows only current live text, zero page content expansion)
 * - Continuous Hands-Free Turn-Taking (Auto silence detection & auto re-listen)
 * ============================================================================
 */

(function () {
  "use strict";

  // DOM Elements
  const stageEl = document.getElementById("voice-stage");
  const orbEl = document.getElementById("voice-orb");
  const statusPillEl = document.getElementById("voice-status-pill");
  const statusTextEl = document.getElementById("voice-status-text");
  const canvas = document.getElementById("voice-canvas");
  const ctx = canvas ? canvas.getContext("2d") : null;
  const liveCardEl = document.getElementById("voice-live-card");
  const liveBadgeEl = document.getElementById("voice-live-badge");
  const liveTextEl = document.getElementById("voice-live-text");

  // State
  let currentState = "idle"; // "idle" | "listening" | "thinking" | "speaking"
  let sessionActive = false;
  let isRecognizing = false;
  let recognition = null;
  let preferredVoice = null;
  let audioCtx = null;
  let analyser = null;
  let micStream = null;
  let animFrameId = null;
  let speechEnergy = 0;
  let lastCapturedText = "";

  // Radial Spectrum Visualizer Configuration
  const NUM_BARS = 48;
  const barValues = new Float32Array(NUM_BARS);
  const freqData = new Uint8Array(64);

  // Speech Recognition Compatibility
  const SpeechRecognition =
    window.SpeechRecognition || window.webkitSpeechRecognition || null;

  // Initialize Speech Synthesis Voices
  function initVoices() {
    if (!("speechSynthesis" in window)) return;
    const voices = window.speechSynthesis.getVoices();
    if (!voices || voices.length === 0) return;

    preferredVoice =
      voices.find(
        (v) =>
          v.lang.startsWith("en") &&
          (v.name.includes("Natural") ||
            v.name.includes("Google") ||
            v.name.includes("Samantha") ||
            v.name.includes("Premium") ||
            v.name.includes("Enhanced") ||
            v.name.includes("Daniel") ||
            v.name.includes("Karen")),
      ) ||
      voices.find((v) => v.lang.startsWith("en")) ||
      voices[0];
  }

  if ("speechSynthesis" in window) {
    initVoices();
    window.speechSynthesis.onvoiceschanged = initVoices;
  }

  // Clean raw markdown text for smooth TTS pronunciation
  function cleanForSpeech(raw) {
    if (!raw) return "";
    return raw
      .replace(/```[\s\S]*?```/g, "")
      .replace(/`([^`]+)`/g, "$1")
      .replace(/https?:\/\/\S+/g, "")
      .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
      .replace(/(\*\*|__)(.*?)\1/g, "$2")
      .replace(/(\*|_)(.*?)\1/g, "$2")
      .replace(/^#{1,6}\s+/gm, "")
      .replace(/^>\s+/gm, "")
      .replace(/^[\s*-+]+(?=\S)/gm, "")
      .replace(/^\d+\.\s+/gm, "")
      .replace(/<\|.*?\|>/g, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  // Update Status Pill & UI States
  function setState(state, customMessage = null) {
    currentState = state;
    if (!stageEl || !statusPillEl || !statusTextEl) return;

    stageEl.classList.remove("state-idle", "state-listening", "state-thinking", "state-speaking");
    stageEl.classList.add(`state-${state}`);

    statusPillEl.classList.remove("state-ready", "state-listening", "state-thinking", "state-speaking");

    if (orbEl) {
      if (state === "listening") {
        orbEl.innerHTML = '<i class="fa-solid fa-microphone"></i>';
      } else if (state === "thinking") {
        orbEl.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i>';
      } else if (state === "speaking") {
        orbEl.innerHTML = '<i class="fa-solid fa-volume-high"></i>';
      } else {
        orbEl.innerHTML = '<i class="fa-solid fa-microphone"></i>';
      }
    }

    if (state === "idle") {
      statusPillEl.classList.add("state-ready");
      statusTextEl.textContent = customMessage || "AI Model Ready";
    } else if (state === "listening") {
      statusPillEl.classList.add("state-listening");
      statusTextEl.textContent = customMessage || "Listening... Speak now";
    } else if (state === "thinking") {
      statusPillEl.classList.add("state-thinking");
      statusTextEl.textContent = customMessage || "AI Model Thinking...";
    } else if (state === "speaking") {
      statusPillEl.classList.add("state-speaking");
      statusTextEl.textContent = customMessage || "AI Model Speaking...";
    }
  }

  // Update Fixed Bottom Live Caption (Shows only current live text, 0 page growth)
  function setLiveCaption(type, text) {
    if (!liveCardEl || !liveBadgeEl || !liveTextEl) return;

    liveCardEl.classList.remove("active-user", "active-ai");
    liveBadgeEl.classList.remove("badge-ready", "badge-user", "badge-ai", "badge-thinking");
    liveTextEl.classList.remove("text-user", "text-ai");

    if (type === "user") {
      liveCardEl.classList.add("active-user");
      liveBadgeEl.classList.add("badge-user");
      liveBadgeEl.innerHTML = '<i class="fa-solid fa-microphone"></i>';
      liveTextEl.classList.add("text-user");
      liveTextEl.textContent = text || "Listening...";
    } else if (type === "ai") {
      liveCardEl.classList.add("active-ai");
      liveBadgeEl.classList.add("badge-ai");
      liveBadgeEl.innerHTML = '<i class="fa-solid fa-volume-high"></i>';
      liveTextEl.classList.add("text-ai");
      liveTextEl.textContent = text || "Speaking...";
    } else if (type === "thinking") {
      liveBadgeEl.classList.add("badge-thinking");
      liveBadgeEl.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i>';
      liveTextEl.textContent = text || "Thinking...";
    } else {
      liveBadgeEl.classList.add("badge-ready");
      liveBadgeEl.innerHTML = '<i class="fa-solid fa-microphone"></i>';
      liveTextEl.textContent = text || "AI Model ready • Tap orb to start conversation";
    }
  }

  // Real-time Canvas Radial Spectrum Visualizer
  function initVisualizer() {
    if (!canvas || !ctx) return;

    function resizeCanvas() {
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.scale(dpr, dpr);
    }

    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);

    let time = 0;

    function renderLoop() {
      animFrameId = requestAnimationFrame(renderLoop);
      time += 0.04;

      const width = canvas.offsetWidth;
      const height = canvas.offsetHeight;
      const centerX = width / 2;
      const centerY = height / 2;
      const orbRadius = orbEl ? orbEl.offsetWidth / 2 : 65;
      const baseRadius = orbRadius + 6;

      ctx.clearRect(0, 0, width, height);

      // Check if real Web Audio analyser data is available
      let hasRealAudio = false;
      if (analyser && currentState === "listening") {
        analyser.getByteFrequencyData(freqData);
        let sum = 0;
        for (let i = 0; i < freqData.length; i++) sum += freqData[i];
        if (sum > 40) {
          hasRealAudio = true;
          speechEnergy = Math.min(1.0, speechEnergy + 0.15);
        }
      }

      // Smooth decay of speech energy
      speechEnergy *= 0.93;

      // Compute targets for each radial equalizer bar
      for (let i = 0; i < NUM_BARS; i++) {
        let targetHeight = 3;

        if (currentState === "listening") {
          if (hasRealAudio) {
            // Sample real microphone frequency spectrum bins
            const binIndex = Math.floor((i / NUM_BARS) * (freqData.length * 0.7));
            const rawVal = freqData[binIndex] || 0;
            targetHeight = Math.max(5, (rawVal / 255) * 65);
          } else {
            // Dynamic speech wave synthesizer whenever listening / speech detected
            const wave1 = Math.sin(time * 7 + i * 0.5) * 0.5 + 0.5;
            const wave2 = Math.cos(time * 11 + i * 0.8) * 0.5 + 0.5;
            const combinedWave = wave1 * 0.6 + wave2 * 0.4;
            const boost = speechEnergy > 0.05 ? speechEnergy * 55 : 4;
            targetHeight = Math.max(4, combinedWave * boost + (isRecognizing ? 8 : 3));
          }
        } else if (currentState === "speaking") {
          const speakWave = Math.sin(time * 8 + i * 0.4) * 0.5 + 0.5;
          targetHeight = Math.max(6, speakWave * 38);
        } else if (currentState === "thinking") {
          const theta = (i / NUM_BARS) * Math.PI * 2;
          const sweep = (Math.sin(theta - time * 3) + 1) / 2;
          targetHeight = Math.max(3, Math.pow(sweep, 3) * 28);
        } else {
          // Idle state subtle breathing
          const idleWave = Math.sin(time * 2 + i * 0.3) * 0.5 + 0.5;
          targetHeight = Math.max(2, idleWave * 5);
        }

        // Smooth interpolation for fluid dancing bars
        barValues[i] += (targetHeight - barValues[i]) * 0.3;
      }

      // Draw Radial Equalizer Bars
      for (let i = 0; i < NUM_BARS; i++) {
        const angle = (i / NUM_BARS) * Math.PI * 2;
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        const innerR = baseRadius;
        const outerR = innerR + barValues[i];

        const x1 = centerX + cos * innerR;
        const y1 = centerY + sin * innerR;
        const x2 = centerX + cos * outerR;
        const y2 = centerY + sin * outerR;

        const grad = ctx.createLinearGradient(x1, y1, x2, y2);
        if (currentState === "listening") {
          grad.addColorStop(0, "rgba(0, 214, 121, 0.85)");
          grad.addColorStop(1, "rgba(125, 249, 255, 0.95)");
        } else if (currentState === "thinking") {
          grad.addColorStop(0, "rgba(251, 191, 36, 0.65)");
          grad.addColorStop(1, "rgba(125, 249, 255, 0.9)");
        } else if (currentState === "speaking") {
          grad.addColorStop(0, "rgba(125, 249, 255, 0.85)");
          grad.addColorStop(1, "rgba(0, 214, 121, 0.95)");
        } else {
          grad.addColorStop(0, "rgba(0, 214, 121, 0.3)");
          grad.addColorStop(1, "rgba(125, 249, 255, 0.4)");
        }

        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.strokeStyle = grad;
        ctx.lineWidth = 3.2;
        ctx.lineCap = "round";
        ctx.stroke();

        // Glowing particle at the tip of energetic spectrum bars
        if (barValues[i] > 12) {
          ctx.beginPath();
          ctx.arc(x2, y2, 2.2, 0, Math.PI * 2);
          ctx.fillStyle = currentState === "thinking" ? "#fbbf24" : "#7df9ff";
          ctx.shadowColor = "#7df9ff";
          ctx.shadowBlur = 6;
          ctx.fill();
          ctx.shadowBlur = 0;
        }
      }

      // Draw faint luminous base ring
      ctx.beginPath();
      ctx.arc(centerX, centerY, baseRadius, 0, Math.PI * 2);
      ctx.strokeStyle =
        currentState === "listening"
          ? "rgba(0, 214, 121, 0.45)"
          : currentState === "speaking"
          ? "rgba(125, 249, 255, 0.45)"
          : "rgba(30, 41, 59, 0.4)";
      ctx.lineWidth = 1.2;
      ctx.stroke();
    }

    renderLoop();
  }

  // Attach Microphone to Web Audio Analyser
  async function setupAudioContext() {
    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) return;
      if (!audioCtx) {
        audioCtx = new AudioContextClass();
      }
      if (audioCtx.state === "suspended") {
        await audioCtx.resume();
      }
      if (!analyser) {
        analyser = audioCtx.createAnalyser();
        analyser.fftSize = 128;
      }
      if (!micStream && navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const source = audioCtx.createMediaStreamSource(micStream);
        source.connect(analyser);
      }
    } catch (e) {
      console.warn("AudioContext / mic stream visualizer access:", e);
    }
  }

  // Setup Speech Recognition
  function initRecognition() {
    if (!SpeechRecognition) return null;

    const rec = new SpeechRecognition();
    rec.continuous = false;
    rec.interimResults = true;
    rec.lang = navigator.language || "en-US";

    rec.onstart = () => {
      isRecognizing = true;
      setState("listening", "Listening... Speak now");
      setLiveCaption("user", "Listening to your voice... (speak now)");
      stopSpeaking();
    };

    rec.onspeechstart = () => {
      speechEnergy = 1.0;
      setState("listening", "Listening to your voice...");
    };

    rec.onsoundstart = () => {
      speechEnergy = Math.max(speechEnergy, 0.85);
    };

    rec.onaudiostart = () => {
      speechEnergy = Math.max(speechEnergy, 0.7);
    };

    rec.onresult = (event) => {
      speechEnergy = 1.0;
      let interim = "";
      let final = "";

      for (let i = event.resultIndex; i < event.results.length; ++i) {
        const text = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          final += text;
        } else {
          interim += text;
        }
      }

      const current = final || interim;
      if (current) {
        lastCapturedText = current;
        // Live text caption updates with current utterance only
        setLiveCaption("user", current);
      }
    };

    rec.onerror = (event) => {
      isRecognizing = false;
      console.warn("Speech Recognition Error:", event.error);
      if (event.error === "not-allowed" || event.error === "permission-denied") {
        sessionActive = false;
        setState("idle", "Microphone access blocked");
        setLiveCaption("ready", "Microphone blocked. Please allow mic permissions in your browser.");
      } else if (event.error === "no-speech") {
        if (sessionActive) {
          setTimeout(() => {
            if (sessionActive && currentState !== "speaking" && currentState !== "thinking") {
              startListening();
            }
          }, 300);
        } else {
          setState("idle");
          setLiveCaption("ready", "AI Model ready • Tap orb to talk");
        }
      } else {
        if (!sessionActive) {
          setState("idle");
          setLiveCaption("ready", "AI Model ready • Tap orb to talk");
        }
      }
    };

    rec.onend = () => {
      isRecognizing = false;
      if (lastCapturedText && lastCapturedText.trim().length > 0) {
        const query = lastCapturedText.trim();
        lastCapturedText = "";
        handleAgentResponse(query);
      } else if (sessionActive && currentState !== "speaking" && currentState !== "thinking") {
        // Auto turn-taking re-listen if silence occurred without query
        setTimeout(() => {
          if (sessionActive && currentState !== "speaking" && currentState !== "thinking") {
            startListening();
          }
        }, 300);
      } else {
        setState("idle");
        setLiveCaption("ready", "AI Model ready • Tap orb to talk");
      }
    };

    return rec;
  }

  // Conversational Knowledge Engine
  function getKnowledgeResponse(prompt) {
    const q = prompt.toLowerCase();

    if (q.includes("knee") || q.includes("rsna") || q.includes("mri") || q.includes("jumped") || q.includes("osteoarthritis")) {
      return "For the RSNA Knee Osteoarthritis Detection challenge on Kaggle, I built a 3D MRI pipeline that processed volumetric DICOM scans with coordinate-aligned bounding boxes. That solution jumped 4,900 ranks on the leaderboard into the top 8%!";
    }

    if (q.includes("vibe ml") || q.includes("studio") || q.includes("vibe-ml") || q.includes("vml")) {
      return "Vibe ML Studio is my open-source, zero-code machine learning platform. It allows developers to train, evaluate, and export PyTorch, Scikit-Learn, and ONNX models directly through an interactive GUI.";
    }

    if (q.includes("vaiga") || q.includes("hackathon") || q.includes("pepper") || q.includes("winner")) {
      return "At the Vaiga 2023 National Hackathon, our team won First Prize for building an autonomous Pepper Harvesting Robotic System powered by computer vision and real-time edge AI.";
    }

    if (q.includes("skill") || q.includes("stack") || q.includes("tech") || q.includes("experience") || q.includes("framework")) {
      return "My core AI stack centers on PyTorch, ONNX, Scikit-Learn, and edge deployment using WebAssembly and WebGPU. I also specialize in 3D medical imaging, autonomous AI agents, and computer vision.";
    }

    if (q.includes("who are you") || q.includes("what is this") || q.includes("about you") || q.includes("what do you do")) {
      return "I'm VSP Voice Bot, an AI assistant representing Vishnu Suresh Perumbavoor. You can ask me about his machine learning research, hackathon wins, Kaggle breakthroughs, or technical stack!";
    }

    if (q.includes("song") || q.includes("music") || q.includes("beat") || q.includes("cover")) {
      return "Vishnu produces AI cover songs and original beats, including 'No Crown Given' and 'I'm Running This', available in the Songs section of this portfolio.";
    }

    if (q.includes("blog") || q.includes("article") || q.includes("post") || q.includes("write")) {
      return "Vishnu writes deep-dive technical articles on 3D computer vision, zero-code ML, and edge inference. You can read them directly in the Blogs section!";
    }

    if (q.includes("contact") || q.includes("hire") || q.includes("email") || q.includes("reach") || q.includes("github")) {
      return "You can connect with Vishnu on GitHub at vishnusureshperumbavoor or reach out via LinkedIn and email from the Contact section of this portfolio.";
    }

    if (q.includes("hello") || q.includes("hi") || q.includes("hey") || q.includes("morning") || q.includes("afternoon")) {
      return "Hello! I'm VSP Voice Bot. How can I help you explore Vishnu's projects and AI research today?";
    }

    return `That's a great question about "${prompt}". Vishnu specializes in machine learning research, edge WebAssembly inference, and computer vision systems. You can also explore his detailed technical write-ups in the Blogs section!`;
  }

  // Handle Response & Speak
  async function handleAgentResponse(userQuery) {
    setState("thinking", "AI Model Thinking...");
    setLiveCaption("thinking", "Processing your question...");

    // Natural processing pause
    await new Promise((r) => setTimeout(r, 400));

    const answer = getKnowledgeResponse(userQuery);
    speakMessage(answer);
  }

  // Speech Synthesis
  function stopSpeaking() {
    if (!("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    if (currentState === "speaking") {
      setState("idle");
    }
  }

  function speakMessage(text) {
    if (!("speechSynthesis" in window)) {
      setState("idle");
      setLiveCaption("ready", "AI Model ready • Tap orb to talk");
      return;
    }

    stopSpeaking();
    setState("speaking", "AI Model Speaking...");

    const clean = cleanForSpeech(text);
    if (!clean) {
      if (sessionActive) {
        startListening();
      } else {
        setState("idle");
        setLiveCaption("ready", "AI Model ready • Tap orb to talk");
      }
      return;
    }

    // Split into sentences for reliable speech and live subtitle chunking
    const sentences = clean.match(/[^.!?\n]+[.!?\n]+|[^.!?\n]+$/g) || [clean];
    const valid = sentences.map((s) => s.trim()).filter((s) => s.length > 0);

    if (valid.length === 0) {
      if (sessionActive) {
        startListening();
      } else {
        setState("idle");
        setLiveCaption("ready", "AI Model ready • Tap orb to talk");
      }
      return;
    }

    if (!preferredVoice) initVoices();

    valid.forEach((sentence, idx) => {
      const utter = new SpeechSynthesisUtterance(sentence);
      if (preferredVoice) utter.voice = preferredVoice;
      utter.rate = 1.02;
      utter.pitch = 1.0;

      const isLast = idx === valid.length - 1;

      utter.onstart = () => {
        // Live text displays strictly the current sentence being spoken!
        setLiveCaption("ai", sentence);
      };

      utter.onend = () => {
        if (isLast) {
          // Automatic Turn-Taking: seamlessly resume listening when speech finishes!
          if (sessionActive) {
            setTimeout(() => {
              if (sessionActive && currentState !== "speaking" && currentState !== "thinking") {
                startListening();
                setLiveCaption("ready", "Listening... (Speak your next question)");
              }
            }, 300);
          } else {
            setState("idle");
            setLiveCaption("ready", "AI Model ready • Tap orb to talk");
          }
        }
      };

      utter.onerror = () => {
        if (isLast) {
          if (sessionActive) {
            setTimeout(() => {
              if (sessionActive && currentState !== "speaking" && currentState !== "thinking") {
                startListening();
              }
            }, 300);
          } else {
            setState("idle");
            setLiveCaption("ready", "AI Model ready • Tap orb to talk");
          }
        }
      };

      window.speechSynthesis.speak(utter);
    });
  }

  // Hands-Free Listening Manager
  function startListening() {
    if (!SpeechRecognition) return;
    if (currentState === "speaking") {
      stopSpeaking();
    }
    if (isRecognizing) return;

    try {
      if (!recognition) {
        recognition = initRecognition();
      }
      recognition.start();
    } catch (e) {
      try {
        recognition.abort();
        setTimeout(() => {
          if (sessionActive) recognition.start();
        }, 150);
      } catch (_err) {}
    }
  }

  function stopSession() {
    sessionActive = false;
    stopSpeaking();
    if (isRecognizing && recognition) {
      recognition.stop();
    }
    setState("idle");
    setLiveCaption("ready", "AI Model ready • Tap orb to talk");
  }

  // Toggle Voice Input Session via Orb
  async function toggleVoiceSession() {
    if (!SpeechRecognition) {
      alert("Speech Recognition is not supported by your browser. Please use Chrome, Edge, or Safari.");
      return;
    }

    // Set up Web Audio in background without blocking recognition
    setupAudioContext().catch((err) => console.warn(err));

    if (sessionActive) {
      // User tapped orb while active -> pause/stop session
      stopSession();
    } else {
      // User tapped orb to start -> begin continuous hands-free session
      sessionActive = true;
      startListening();
    }
  }

  // Event Listeners
  if (orbEl) {
    orbEl.addEventListener("click", toggleVoiceSession);
  }

  // Initialize
  initVisualizer();
  setState("idle", "AI Model Ready");
  setLiveCaption("ready", "AI Model ready • Tap orb to start conversation");
})();
