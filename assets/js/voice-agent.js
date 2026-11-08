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
  let micSource = null;
  let animFrameId = null;
  let speechEnergy = 0;
  let lastCapturedText = "";
  let speechGenId = 0;
  let speechWatchdog = null;
  let speechPrimed = false;
  const activeUtterances = [];

  // Mobile browsers (especially Android Chrome) cannot reliably share the mic
  // between getUserMedia (visualizer) and SpeechRecognition, and they require
  // speech synthesis to be unlocked inside a real user gesture.
  function isMobileDevice() {
    return (
      (navigator.maxTouchPoints && navigator.maxTouchPoints > 0) ||
      /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent || "")
    );
  }

  // Radial Spectrum Visualizer Configuration
  const NUM_BARS = 48;
  const barValues = new Float32Array(NUM_BARS);
  const freqData = new Uint8Array(64);

  // Speech Recognition Compatibility
  const SpeechRecognition =
    window.SpeechRecognition || window.webkitSpeechRecognition || null;

  // Select the most natural available voice (delegated to shared voice utils)
  function findFemaleVoice(voices) {
    if (window.VSPVoice) return window.VSPVoice.selectVoice(voices);
    return (voices && voices[0]) || null;
  }

  // Initialize Speech Synthesis Voices
  function initVoices() {
    if (!("speechSynthesis" in window)) return;
    const voices = window.speechSynthesis.getVoices();
    if (!voices || voices.length === 0) return;

    preferredVoice = findFemaleVoice(voices);
  }

  if ("speechSynthesis" in window) {
    initVoices();
    window.speechSynthesis.onvoiceschanged = initVoices;
  }

  // Clean raw markdown text for smooth TTS pronunciation
  function cleanForSpeech(raw) {
    if (window.VSPVoice) return window.VSPVoice.cleanForSpeech(raw);
    if (!raw) return "";
    return String(raw).replace(/\s+/g, " ").trim();
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
        orbEl.title = "Listening (Tap to stop)";
        orbEl.setAttribute("aria-label", "Stop voice session");
      } else if (state === "thinking") {
        orbEl.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i>';
        orbEl.title = "Thinking (Tap to stop)";
        orbEl.setAttribute("aria-label", "Stop voice session");
      } else if (state === "speaking") {
        orbEl.innerHTML = '<i class="fa-solid fa-volume-high"></i>';
        orbEl.title = "Speaking (Tap to stop)";
        orbEl.setAttribute("aria-label", "Stop speaking");
      } else {
        orbEl.innerHTML = '<i class="fa-solid fa-microphone"></i>';
        orbEl.title = "Click to speak";
        orbEl.setAttribute("aria-label", "Start voice conversation");
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
        micSource = audioCtx.createMediaStreamSource(micStream);
        micSource.connect(analyser);
      }
    } catch (e) {
      console.warn("AudioContext / mic stream visualizer access:", e);
    }
  }

  // Release the visualizer microphone so SpeechRecognition can own the mic.
  // Android Chrome does not reliably allow both to capture at the same time.
  function releaseMic() {
    try {
      if (micSource) {
        micSource.disconnect();
        micSource = null;
      }
      if (micStream) {
        micStream.getTracks().forEach((track) => track.stop());
        micStream = null;
      }
    } catch (e) {
      console.warn("Failed to release microphone:", e);
    }
  }

  // Unlock speech synthesis inside a user gesture (required on Android Chrome).
  function primeSpeechSynthesis() {
    if (speechPrimed || !("speechSynthesis" in window)) return;
    speechPrimed = true;
    try {
      const utter = new SpeechSynthesisUtterance(".");
      utter.volume = 0;
      utter.rate = 2;
      window.speechSynthesis.speak(utter);
    } catch (_) {}
  }

  // Setup Speech Recognition
  function initRecognition() {
    if (!SpeechRecognition) return null;

    const rec = new SpeechRecognition();
    rec.continuous = false;
    rec.interimResults = true;
    const navLang = navigator.language || "en-US";
    rec.lang = /^en/i.test(navLang) ? navLang : "en-US";

    rec.onstart = () => {
      isRecognizing = true;
      lastCapturedText = "";
      setState("listening", "Listening... Speak now");
      setLiveCaption("user", "Listening to your voice... (speak now)");
      // Do not cancel the silent priming utterance used to unlock mobile TTS.
      if (activeUtterances.length > 0) {
        stopSpeaking();
      }
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

      for (let i = 0; i < event.results.length; ++i) {
        const text = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          final += text;
        } else {
          interim += text;
        }
      }

      const current = final || interim;
      if (current) {
        // Live text caption updates with the current utterance only.
        setLiveCaption("user", current);
      }
      // Only finalized speech becomes a query, so partial/noise cannot trigger replies.
      if (final) {
        lastCapturedText = final;
      }
    };

    rec.onerror = (event) => {
      isRecognizing = false;
      console.warn("Speech Recognition Error:", event.error);
      if (event.error === "not-allowed" || event.error === "permission-denied") {
        sessionActive = false;
        setState("idle", "Microphone access blocked");
        setLiveCaption("ready", "Microphone blocked. Please allow mic permissions in your browser.");
      } else if (event.error === "audio-capture") {
        sessionActive = false;
        setState("idle", "No microphone found");
        setLiveCaption("ready", "No microphone detected. Check your device mic and try again.");
      } else if (event.error === "network") {
        sessionActive = false;
        setState("idle", "Speech service offline");
        setLiveCaption("ready", "Speech recognition needs an internet connection. Check your network and retry.");
      } else if (event.error === "service-not-allowed") {
        sessionActive = false;
        setState("idle", "Speech service unavailable");
        setLiveCaption("ready", "Speech recognition is disabled on this browser. Enable Google Speech Services and retry.");
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
      if (!sessionActive) {
        setState("idle");
        setLiveCaption("ready", "AI Model ready • Tap orb to start conversation");
        return;
      }
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
        setLiveCaption("ready", "AI Model ready • Tap orb to start conversation");
      }
    };

    return rec;
  }

  // Local GGUF model response (no canned fallbacks)
  async function getModelResponse(prompt) {
    // The model module is a deferred ES module; wait briefly for it to expose its API.
    for (let i = 0; i < 50 && typeof window.vspGenerateReply !== "function"; i += 1) {
      await new Promise((r) => setTimeout(r, 100));
    }
    if (typeof window.vspGenerateReply !== "function") {
      return "The local AI model is not available on this page yet. Please refresh and try again.";
    }
    try {
      return await window.vspGenerateReply(prompt);
    } catch (err) {
      console.error("Local voice model error:", err);
      return "Sorry, I couldn't run the local AI model. Please try again.";
    }
  }

  // Surface first-run model download progress in the voice caption.
  window.addEventListener("vsp-model-progress", (event) => {
    if (!sessionActive || currentState !== "thinking") return;
    const percent = event.detail && event.detail.percent;
    if (Number.isFinite(percent)) {
      setLiveCaption("thinking", `Loading local AI model... ${percent}%`);
    }
  });

  // Time-aware welcome message spoken when a voice session starts
  function getWelcomeMessage() {
    const hour = new Date().getHours();
    const greeting =
      hour < 12
        ? "Good morning"
        : hour < 17
        ? "Good afternoon"
        : "Good evening";

    const intros = [
      "I'm VSP Voice Bot. How can I help?",
      "VSP Voice Bot here. What would you like to know?",
      "I'm listening. Ask me anything about VSP.",
      "Ready when you are. What can I tell you?"
    ];

    const intro = intros[Math.floor(Math.random() * intros.length)];
    return `${greeting}! ${intro}`;
  }

  // Handle Response & Speak
  async function handleAgentResponse(userQuery) {
    if (!sessionActive) return;
    setState("thinking", "AI Model Thinking...");
    setLiveCaption("thinking", "Thinking...");

    const answer = await getModelResponse(userQuery);
    if (!sessionActive) return;
    speakMessage(answer);
  }

  // Speech Synthesis
  function clearSpeechWatchdog() {
    if (speechWatchdog) {
      clearInterval(speechWatchdog);
      speechWatchdog = null;
    }
  }

  function stopSpeaking() {
    speechGenId++;
    clearSpeechWatchdog();
    activeUtterances.length = 0;
    if ("speechSynthesis" in window) {
      try {
        window.speechSynthesis.cancel();
      } catch (_) {}
    }
    if (currentState === "speaking") {
      setState("idle");
    }
  }

  function finishSpeakingAndListen(genId) {
    if (genId !== speechGenId) return;
    speechGenId++;
    clearSpeechWatchdog();
    activeUtterances.length = 0;

    if (sessionActive) {
      // Transition out of "speaking" immediately so UI is ready and turn-taking proceeds
      setState("listening", "Listening... Speak now");
      setLiveCaption("user", "Listening to your voice... (speak now)");
      setTimeout(() => {
        if (sessionActive && currentState !== "speaking" && currentState !== "thinking") {
          startListening();
        }
      }, 250);
    } else {
      setState("idle");
      setLiveCaption("ready", "AI Model ready • Tap orb to start conversation");
    }
  }

  function speakMessage(text) {
    if (!sessionActive) return;

    if (!("speechSynthesis" in window)) {
      if (sessionActive) {
        setState("listening", "Listening... Speak now");
        setLiveCaption("user", "Listening to your voice... (speak now)");
        startListening();
      } else {
        setState("idle");
        setLiveCaption("ready", "AI Model ready • Tap orb to start conversation");
      }
      return;
    }

    stopSpeaking();
    if (!sessionActive) return;
    const myGenId = ++speechGenId;
    setState("speaking", "AI Model Speaking...");

    const clean = cleanForSpeech(text);
    if (!clean) {
      finishSpeakingAndListen(myGenId);
      return;
    }

    // Group sentences so intonation flows instead of resetting every sentence.
    const chunks = window.VSPVoice
      ? window.VSPVoice.chunkForSpeech(clean, 240)
      : [clean];

    if (chunks.length === 0) {
      finishSpeakingAndListen(myGenId);
      return;
    }

    if (!preferredVoice) initVoices();
    setLiveCaption("ai", chunks[0]);

    const rate = window.VSPVoice ? window.VSPVoice.SPEECH_RATE : 1.0;
    const pitch = window.VSPVoice ? window.VSPVoice.SPEECH_PITCH : 1.0;

    let hasStartedSpeaking = false;
    const startTime = Date.now();

    chunks.forEach((chunk, idx) => {
      const utter = new SpeechSynthesisUtterance(chunk);
      // Keep reference in module array to prevent browser GC from dropping onend events
      activeUtterances.push(utter);

      if (preferredVoice) utter.voice = preferredVoice;
      utter.rate = rate;
      utter.pitch = pitch;

      const isLast = idx === chunks.length - 1;

      utter.onstart = () => {
        if (myGenId !== speechGenId || !sessionActive) return;
        hasStartedSpeaking = true;
        // Live text displays strictly the current chunk being spoken!
        setLiveCaption("ai", chunk);
      };

      utter.onend = () => {
        if (myGenId !== speechGenId || !sessionActive) return;
        if (isLast) {
          finishSpeakingAndListen(myGenId);
        }
      };

      utter.onerror = (e) => {
        if (e && (e.error === "canceled" || e.error === "interrupted")) {
          return;
        }
        if (myGenId !== speechGenId || !sessionActive) return;
        if (isLast) {
          finishSpeakingAndListen(myGenId);
        }
      };

      window.speechSynthesis.speak(utter);
    });

    // Watchdog: handles Chromium pause bug & ensures turn-taking even if browser drops onend
    speechWatchdog = setInterval(() => {
      if (myGenId !== speechGenId || currentState !== "speaking" || !sessionActive) {
        clearSpeechWatchdog();
        return;
      }
      if (window.speechSynthesis.paused) {
        window.speechSynthesis.resume();
      }
      const isBusy = window.speechSynthesis.speaking || window.speechSynthesis.pending;
      if (isBusy) {
        hasStartedSpeaking = true;
      } else if (hasStartedSpeaking || Date.now() - startTime > 1500) {
        finishSpeakingAndListen(myGenId);
      }
    }, 250);
  }

  // Hands-Free Listening Manager
  function startListening() {
    if (!sessionActive || !SpeechRecognition) return;
    if (currentState === "speaking") {
      stopSpeaking();
    }
    if (isRecognizing) return;

    // SpeechRecognition must own the mic; release the visualizer stream first
    // or Android Chrome may start but never capture audio.
    if (isMobileDevice()) {
      releaseMic();
    }

    try {
      if (!recognition) {
        recognition = initRecognition();
      }
      recognition.start();
    } catch (e) {
      try {
        recognition.abort();
        setTimeout(() => {
          if (sessionActive && !isRecognizing) recognition.start();
        }, 150);
      } catch (_err) {}
    }
  }

  function stopSession() {
    sessionActive = false;
    lastCapturedText = "";
    
    // Stop any in-progress speech synthesis immediately
    stopSpeaking();
    
    // Abort recognition immediately to drop pending audio buffers
    if (recognition) {
      try {
        recognition.abort();
      } catch (_) {}
    }
    isRecognizing = false;
    speechEnergy = 0;
    releaseMic();
    
    setState("idle", "AI Model Ready");
    setLiveCaption("ready", "AI Model ready • Tap orb to start conversation");
  }

  // Toggle Voice Input Session via Orb / Voice UI
  function toggleVoiceSession(e) {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }

    if (!SpeechRecognition) {
      alert("Speech Recognition is not supported by your browser. Please use Chrome, Edge, or Safari.");
      return;
    }

    if (sessionActive) {
      // User tapped voice UI while active -> IMMEDIATELY stop everything
      stopSession();
    } else {
      // User tapped voice UI while idle -> start session
      sessionActive = true;
      // Unlock TTS while we are still inside the user gesture (Android Chrome).
      primeSpeechSynthesis();
      if (!isMobileDevice()) {
        setupAudioContext().catch((err) => console.warn(err));
      }
      // Speak a time-aware welcome, then automatically fall into listening.
      speakMessage(getWelcomeMessage());
    }
  }

  // Event Listeners: Tapping orb, wrapper, status pill or dock toggles / stops the voice
  if (orbEl) {
    orbEl.addEventListener("click", toggleVoiceSession);
  }
  const orbWrapperEl = document.querySelector(".voice-orb-wrapper");
  if (orbWrapperEl) {
    orbWrapperEl.addEventListener("click", (e) => {
      if (e.target !== orbEl && !orbEl.contains(e.target)) {
        toggleVoiceSession(e);
      }
    });
  }
  if (statusPillEl) {
    statusPillEl.style.cursor = "pointer";
    statusPillEl.addEventListener("click", toggleVoiceSession);
  }
  if (liveCardEl) {
    liveCardEl.style.cursor = "pointer";
    liveCardEl.addEventListener("click", toggleVoiceSession);
  }

  // Initialize in idle state waiting for user interaction (no auto-start)
  initVisualizer();
  setState("idle", "AI Model Ready");
  if (SpeechRecognition) {
    setLiveCaption("ready", "AI Model ready • Tap orb to start conversation");
  } else {
    setState("idle", "Browser Unsupported");
    setLiveCaption("ready", "Speech recognition not supported in this browser");
  }
})();
