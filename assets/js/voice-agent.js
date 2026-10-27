/**
 * ============================================================================
 * VSP Voice Bot AI - Conversational Voice Agent Engine
 * Features:
 * - Continuous Hands-Free Conversational Loop (Silence Detection & Auto Turn-Taking)
 * - Web Speech API Speech Recognition & Speech Synthesis
 * - Web Audio API Real-Time Audio Frequency Wave Visualizer
 * ============================================================================
 */

(function () {
  "use strict";

  // DOM Elements
  const stageEl = document.getElementById("voice-stage");
  const orbEl = document.getElementById("voice-orb");
  const statusTextEl = document.getElementById("voice-status-text");
  const canvas = document.getElementById("voice-canvas");
  const ctx = canvas ? canvas.getContext("2d") : null;
  const transcriptCard = document.getElementById("voice-transcript-card");

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
  let syntheticPulse = 0;
  let lastCapturedText = "";

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

  // Update UI States
  function setState(state, statusMessage = null) {
    currentState = state;
    if (!stageEl || !statusTextEl) return;

    stageEl.classList.remove("state-idle", "state-listening", "state-thinking", "state-speaking");
    stageEl.classList.add(`state-${state}`);

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

    const defaultMessages = {
      idle: "Ready",
      listening: "Listening...",
      thinking: "Thinking...",
      speaking: "Speaking...",
    };

    statusTextEl.textContent = statusMessage || defaultMessages[state] || "Ready";
  }

  // Render Transcript on HUD Card
  function updateTranscript(userText = null, aiText = null) {
    if (!transcriptCard) return;

    if (!userText && !aiText) {
      transcriptCard.style.display = "none";
      transcriptCard.innerHTML = "";
      return;
    }

    transcriptCard.style.display = "flex";

    let html = "";
    if (userText) {
      html += `
        <div class="transcript-entry transcript-user">
          <span class="icon-badge"><i class="fa-solid fa-user"></i></span>
          <p class="transcript-text">${escapeHtml(userText)}</p>
        </div>
      `;
    }

    if (aiText) {
      html += `
        <div class="transcript-entry transcript-ai">
          <span class="icon-badge"><i class="fa-solid fa-robot"></i></span>
          <p class="transcript-text">${escapeHtml(aiText)}</p>
        </div>
      `;
    }

    transcriptCard.innerHTML = html;
  }

  function escapeHtml(str) {
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  // Real-time Canvas Wave Visualizer
  function initVisualizer() {
    if (!canvas || !ctx) return;

    function resizeCanvas() {
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.scale(dpr, dpr);
    }

    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);

    const freqData = new Uint8Array(64);

    function renderLoop() {
      animFrameId = requestAnimationFrame(renderLoop);

      const width = canvas.offsetWidth;
      const height = canvas.offsetHeight;
      const centerX = width / 2;
      const centerY = height / 2;
      const baseRadius = width * 0.28;

      ctx.clearRect(0, 0, width, height);

      let avgVolume = 0;

      if (analyser && currentState === "listening") {
        analyser.getByteFrequencyData(freqData);
        let sum = 0;
        for (let i = 0; i < freqData.length; i++) {
          sum += freqData[i];
        }
        avgVolume = sum / freqData.length / 255;
      } else if (currentState === "speaking") {
        syntheticPulse += 0.08;
        avgVolume = (Math.sin(syntheticPulse) * 0.5 + 0.5) * 0.65;
      } else if (currentState === "thinking") {
        syntheticPulse += 0.05;
        avgVolume = (Math.sin(syntheticPulse) * 0.3 + 0.3) * 0.4;
      } else {
        avgVolume = 0.05;
      }

      // Draw pulsating frequency rings
      const ringCount = 3;
      for (let r = 0; r < ringCount; r++) {
        const radiusOffset = (r + 1) * (14 + avgVolume * 35);
        const radius = baseRadius + radiusOffset;
        const alpha = Math.max(0.08, (1 - (r / ringCount) * 0.6) * (avgVolume * 1.2));

        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);

        if (currentState === "listening") {
          ctx.strokeStyle = `rgba(0, 214, 121, ${alpha})`;
          ctx.lineWidth = 1.5 + avgVolume * 2;
        } else if (currentState === "thinking") {
          ctx.strokeStyle = `rgba(125, 249, 255, ${alpha})`;
          ctx.lineWidth = 1.5;
        } else if (currentState === "speaking") {
          ctx.strokeStyle = `rgba(0, 214, 121, ${alpha})`;
          ctx.lineWidth = 2 + avgVolume * 3;
        } else {
          ctx.strokeStyle = `rgba(30, 41, 59, 0.4)`;
          ctx.lineWidth = 1;
        }

        ctx.stroke();
      }
    }

    renderLoop();
  }

  // Attach Microphone to Web Audio Analyser
  async function setupAudioContext() {
    if (audioCtx && analyser) return;
    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) return;
      audioCtx = new AudioContextClass();
      analyser = audioCtx.createAnalyser();
      analyser.fftSize = 128;

      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const source = audioCtx.createMediaStreamSource(micStream);
        source.connect(analyser);
      }
    } catch (e) {
      console.warn("AudioContext / mic stream visualizer access error:", e);
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
      setState("listening");
      stopSpeaking();
    };

    rec.onresult = (event) => {
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
        updateTranscript(current, null);
      }
    };

    rec.onerror = (event) => {
      isRecognizing = false;
      console.warn("Speech Recognition Error:", event.error);
      if (event.error === "not-allowed" || event.error === "permission-denied") {
        sessionActive = false;
        setState("idle", "Microphone access blocked");
      } else if (event.error === "no-speech") {
        if (sessionActive) {
          // Automatic re-listen if silence occurred without query
          setTimeout(() => {
            if (sessionActive && currentState !== "speaking" && currentState !== "thinking") {
              startListening();
            }
          }, 350);
        } else {
          setState("idle");
        }
      } else {
        if (!sessionActive) {
          setState("idle");
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
        // Auto-resume listening if session is still open
        setTimeout(() => {
          if (sessionActive && currentState !== "speaking" && currentState !== "thinking") {
            startListening();
          }
        }, 350);
      } else {
        setState("idle");
      }
    };

    return rec;
  }

  // Conversational Knowledge Engine
  function getKnowledgeResponse(prompt) {
    const q = prompt.toLowerCase();

    if (q.includes("knee") || q.includes("rsna") || q.includes("mri") || q.includes("jumped")) {
      return "For the RSNA Knee Osteoarthritis Detection challenge on Kaggle, I built a 3D MRI pipeline that processed volumetric DICOM scans with coordinate-aligned bounding boxes. That solution jumped 4,900 ranks on the leaderboard into the top 8%!";
    }

    if (q.includes("vibe ml") || q.includes("studio") || q.includes("vibe-ml")) {
      return "Vibe ML Studio is my open-source, zero-code machine learning platform. It allows developers to train, evaluate, and export PyTorch, Scikit-Learn, and ONNX models directly through an interactive GUI.";
    }

    if (q.includes("vaiga") || q.includes("hackathon") || q.includes("pepper")) {
      return "At the Vaiga 2023 National Hackathon, our team won First Prize for building an autonomous Pepper Harvesting Robotic System powered by computer vision and real-time edge AI.";
    }

    if (q.includes("skill") || q.includes("stack") || q.includes("tech") || q.includes("experience")) {
      return "My core AI stack centers on PyTorch, ONNX, Scikit-Learn, and edge deployment using WebAssembly and WebGPU. I also specialize in 3D medical imaging and autonomous AI agents.";
    }

    if (q.includes("who are you") || q.includes("what is this") || q.includes("about you")) {
      return "I'm VSP Voice Bot, an AI assistant representing Vishnu Suresh Perumbavoor. You can ask me about his machine learning research, hackathon wins, Kaggle breakthroughs, or technical stack!";
    }

    if (q.includes("song") || q.includes("music") || q.includes("cover")) {
      return "Vishnu produces AI cover songs and original beats, including 'No Crown Given' and 'I'm Running This', available in the Songs section of this portfolio.";
    }

    if (q.includes("hello") || q.includes("hi") || q.includes("hey")) {
      return "Hello! I'm VSP Voice Bot. How can I help you explore Vishnu's projects and AI research today?";
    }

    return `That's an interesting question about "${prompt}". Vishnu specializes in machine learning research, edge WebAssembly inference, and computer vision systems. You can also explore his detailed technical write-ups in the Blogs section!`;
  }

  // Handle Response & Speak
  async function handleAgentResponse(userQuery) {
    setState("thinking");

    // Artificial thinking cadence for smooth conversational feel
    await new Promise((r) => setTimeout(r, 450));

    const answer = getKnowledgeResponse(userQuery);
    updateTranscript(userQuery, answer);

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
      return;
    }

    stopSpeaking();
    setState("speaking");

    const clean = cleanForSpeech(text);
    if (!clean) {
      if (sessionActive) {
        startListening();
      } else {
        setState("idle");
      }
      return;
    }

    // Split into sentences for reliable speech across all browsers
    const sentences = clean.match(/[^.!?\n]+[.!?\n]+|[^.!?\n]+$/g) || [clean];
    const valid = sentences.map((s) => s.trim()).filter((s) => s.length > 0);

    if (valid.length === 0) {
      if (sessionActive) {
        startListening();
      } else {
        setState("idle");
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
      utter.onend = () => {
        if (isLast) {
          // Automatic Turn-Taking: seamlessly resume listening when speech finishes!
          if (sessionActive) {
            setTimeout(() => {
              if (sessionActive && currentState !== "speaking" && currentState !== "thinking") {
                startListening();
              }
            }, 300);
          } else {
            setState("idle");
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
  }

  // Toggle Voice Input Session via Orb
  async function toggleVoiceSession() {
    if (!SpeechRecognition) {
      alert("Speech Recognition is not supported by your browser. Please use Chrome, Edge, or Safari.");
      return;
    }

    await setupAudioContext();
    if (audioCtx && audioCtx.state === "suspended") {
      await audioCtx.resume();
    }

    if (sessionActive) {
      // User tapped orb while active -> stop/pause session
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
  setState("idle");
})();
