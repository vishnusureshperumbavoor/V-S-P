import {
  Wllama,
  LoggerWithoutDebug,
} from "https://cdn.jsdelivr.net/npm/@wllama/wllama@2.2.1/esm/index.js";
import WasmFromCDN from "https://cdn.jsdelivr.net/npm/@wllama/wllama@2.2.1/esm/wasm-from-cdn.js";

const MODEL_URL =
  "https://huggingface.co/Qwen/Qwen2-0.5B-Instruct-GGUF/resolve/main/qwen2-0_5b-instruct-q2_k.gguf";
const MODEL_NAME = "Qwen2.5 0.5B GGUF (q2_k)";
const MODEL_SIZE_HINT_BYTES = 230 * 1024 * 1024;
const MODEL_READY_KEY = "vspbot_model_ready_qwen2_0_5b_q2k";
const MODEL_SIZE_KEY = "vspbot_model_size_qwen2_0_5b_q2k";
const SYSTEM_PROMPT = `You are Virtual VSP: the digital voice of Vishnu Suresh Perumbavoor (VSP).

Identity rules:
- Answer personal/profile questions using only the facts below.
- If a detail is not in the facts, say you do not have that info yet instead of guessing.

Known facts about VSP:
- Full name: Vishnu Suresh Perumbavoor (VSP).
- From Perumbavoor, Kochi, Kerala, India; currently in Trivandrum.
- Role: Software Engineer, ML Researcher, AI/full-stack developer.
- Domain focus: Medical imaging and radiology workflows.
- Stack includes: Cornerstone, OHIF, React, Node.js, FastAPI, Docker, Python, TypeScript.
- Notable work: Vibe ML Studio, 3D DICOM Segmentation Viewer, VSP Agents.
- Achievements include Vaiga Hackathon 2023 winner and Agentic AI Hackathon 2026 special mention.

Response behavior:
- For bio/about questions, stay faithful to the known facts above.
- Scope is strict: answer only VSP, VSP projects, VSP website content, career, tech stack, events, and contact links.
- If a question is unrelated to VSP or website context (for example general politics, random trivia, celebrities, or world news), reply briefly: "I handle only VSP-related topics here." and suggest asking about VSP profile or projects.`;

const state = {
  wllama: null,
  modelReady: false,
  loading: null,
  modelTotalBytes: null,
  hasCachedModelHint: false,
  cacheCheck: null,
  messages: [{ role: "system", content: SYSTEM_PROMPT }],
};

const bodyElement = document.body;
const toggler = document.querySelector(".vspbot-toggler");
const panel = document.querySelector(".vspbot");
const closeIconHeader = panel?.querySelector("header .fa-xmark");
const chatbox = document.getElementById("vspbot-chatbox");
const statusEl = document.getElementById("vspbot-status");
const inputEl = document.getElementById("user-input");
const sendBtn = document.getElementById("vspbot-send");
const firstIcon = toggler?.querySelector(".fa-robot");
const closeIcon = toggler?.querySelector(".fa-xmark");
const progressWrapEl = document.getElementById("vspbot-progress-wrap");
const progressBarEl = document.getElementById("vspbot-progress-bar");
const progressPercentEl = document.getElementById("vspbot-progress-percent");
const modelSizeEl = document.getElementById("vspbot-model-size");
const storageInfoEl = document.getElementById("vspbot-storage-info");
const downloadedEl = document.getElementById("vspbot-downloaded");

function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes < 0) return "Unknown";
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const exp = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    units.length - 1,
  );
  const value = bytes / 1024 ** exp;
  return `${value.toFixed(exp === 0 ? 0 : 1)} ${units[exp]}`;
}

function getCachedModelSize() {
  try {
    const raw = localStorage.getItem(MODEL_SIZE_KEY);
    const parsed = Number(raw);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  } catch (_error) {
    return null;
  }
}

function markModelCached(sizeBytes) {
  try {
    localStorage.setItem(MODEL_READY_KEY, "1");
    if (Number.isFinite(sizeBytes) && sizeBytes > 0) {
      localStorage.setItem(MODEL_SIZE_KEY, String(sizeBytes));
    }
  } catch (_error) {
    // Ignore storage write failures.
  }
}

function readCachedModelHint() {
  try {
    return localStorage.getItem(MODEL_READY_KEY) === "1";
  } catch (_error) {
    return false;
  }
}

async function hasCachedModelArtifacts() {
  if (!("caches" in window)) return false;

  try {
    const cacheNames = await caches.keys();
    for (const cacheName of cacheNames) {
      const cache = await caches.open(cacheName);
      const response = await cache.match(MODEL_URL);
      if (response) {
        const headerSize = Number(response.headers.get("content-length"));
        if (Number.isFinite(headerSize) && headerSize > 0) {
          state.modelTotalBytes = headerSize;
        }
        return true;
      }
    }
  } catch (_error) {
    return false;
  }

  return false;
}

function setStatus(message) {
  if (statusEl) statusEl.textContent = message;
}

function setProgress(percent) {
  if (!progressBarEl || !progressPercentEl) return;
  const safePercent = Math.max(0, Math.min(100, Math.round(percent)));
  progressBarEl.style.width = `${safePercent}%`;
  progressPercentEl.textContent = `${safePercent}%`;
}

function setDownloadMeta({ loaded = null, total = null } = {}) {
  if (modelSizeEl) {
    if (Number.isFinite(total) && total > 0) {
      modelSizeEl.textContent = `Model size: ${formatBytes(total)}`;
    } else {
      modelSizeEl.textContent = `Model size: approx ${formatBytes(MODEL_SIZE_HINT_BYTES)} (will auto-detect)`;
    }
  }

  if (downloadedEl) {
    if (Number.isFinite(loaded) && loaded >= 0) {
      const totalText =
        Number.isFinite(total) && total > 0 ? formatBytes(total) : "...";
      downloadedEl.textContent = `Downloaded: ${formatBytes(loaded)} / ${totalText}`;
    } else {
      downloadedEl.textContent = "Downloaded: waiting to start";
    }
  }

  if (storageInfoEl) {
    storageInfoEl.textContent =
      "Storage location: browser-managed cache/IndexedDB in your browser profile (path is browser and OS specific).";
  }
}

function showProgressPanel(show) {
  if (!progressWrapEl) return;
  progressWrapEl.classList.toggle("is-visible", show);
}

function addMessage(role, content, extraClass = "") {
  const item = document.createElement("li");
  item.className =
    `chat ${role === "user" ? "outgoing" : "incoming"} ${extraClass}`.trim();

  if (role !== "user") {
    const icon = document.createElement("span");
    icon.className = "fa-solid fa-robot";
    item.appendChild(icon);
  }

  const bubble = document.createElement("p");
  bubble.textContent = content;
  item.appendChild(bubble);
  chatbox.appendChild(item);
  chatbox.scrollTop = chatbox.scrollHeight;
  return bubble;
}

function createTokenSpeedEl(chatItem) {
  if (!chatItem) return null;
  const metricEl = document.createElement("div");
  metricEl.className = "vspbot-token-speed";
  metricEl.textContent = "Speed: -- tok/s";
  chatItem.appendChild(metricEl);
  return metricEl;
}

function buildPrompt(messages) {
  return (
    messages
      .map(
        (message) =>
          `<|im_start|>${message.role}\n${message.content}<|im_end|>`,
      )
      .join("\n") + "\n<|im_start|>assistant\n"
  );
}

async function initializeModelUi() {
  showProgressPanel(true);
  setStatus("Checking local model cache...");

  state.hasCachedModelHint = readCachedModelHint();
  const cachedSize = getCachedModelSize();

  const hasCacheArtifacts =
    state.hasCachedModelHint || (await hasCachedModelArtifacts());

  if (hasCacheArtifacts) {
    state.hasCachedModelHint = true;
    const sizeToUse =
      cachedSize || state.modelTotalBytes || MODEL_SIZE_HINT_BYTES;
    setDownloadMeta({ loaded: sizeToUse, total: sizeToUse });
    setProgress(100);
    setStatus("VSP Bot is ready");
    markModelCached(sizeToUse);
  } else {
    setDownloadMeta();
    setProgress(0);
    setStatus("Model not loaded yet. Send a message to start local loading.");
  }
}

async function loadModel() {
  if (state.modelReady) return;
  if (state.loading) return state.loading;

  state.loading = (async () => {
    setDownloadMeta();
    showProgressPanel(true);
    setProgress(0);
    setStatus("Downloading local model... 0%");

    state.wllama = new Wllama(WasmFromCDN, {
      logger: LoggerWithoutDebug,
      parallelDownloads: 3,
    });

    if (window.location.protocol === "file:") {
      throw new Error(
        "Please run this site with a local web server. Browser GGUF loading will not work from file://.",
      );
    }

    await state.wllama.loadModelFromUrl(MODEL_URL, {
      n_threads: 1,
      progressCallback: ({ loaded, total }) => {
        if (total) state.modelTotalBytes = total;
        const percent = total ? Math.round((loaded / total) * 100) : 0;
        setProgress(percent);
        setDownloadMeta({ loaded, total });
        setStatus(`Downloading local model... ${percent}%`);
      },
    });

    state.modelReady = true;
    setProgress(100);
    const finalSize = state.modelTotalBytes || MODEL_SIZE_HINT_BYTES;
    setDownloadMeta({ loaded: finalSize, total: finalSize });
    setStatus("VSP Bot is ready");
    markModelCached(finalSize);
    state.hasCachedModelHint = true;
    showProgressPanel(true);
  })();

  return state.loading;
}

async function sendMessage() {
  const text = inputEl?.value.trim();
  if (!text || !sendBtn || sendBtn.disabled) return;

  if (state.cacheCheck) {
    await state.cacheCheck;
  }

  inputEl.value = "";
  sendBtn.disabled = true;
  addMessage("user", text);

  const needsModelLoad = !state.modelReady;
  const preparingText = needsModelLoad
    ? state.hasCachedModelHint
      ? "Preparing local model from browser cache..."
      : "Preparing local model download. Please wait..."
    : "Generating response...";
  const botBubble = addMessage("assistant", preparingText);
  const botItem = botBubble.closest(".chat");
  const speedEl = createTokenSpeedEl(botItem);
  let tokenCount = 0;
  let generationStart = 0;
  let lastSpeedUpdate = 0;

  try {
    await loadModel();
    state.messages.push({ role: "user", content: text });

    let answer = "";
    botBubble.closest(".chat")?.classList.add("thinking");
    botBubble.textContent = "Thinking";
    setStatus("Generating reply...");
    generationStart = performance.now();
    lastSpeedUpdate = generationStart;

    answer = await state.wllama.createCompletion(buildPrompt(state.messages), {
      nPredict: 256,
      sampling: {
        temp: 0.7,
        top_k: 40,
        top_p: 0.9,
      },
      onNewToken: (_token, _piece, currentText) => {
        tokenCount += 1;
        answer = currentText;
        const now = performance.now();
        const elapsedSec = (now - generationStart) / 1000;
        if (
          speedEl &&
          elapsedSec > 0 &&
          (now - lastSpeedUpdate > 250 || tokenCount === 1)
        ) {
          const tps = tokenCount / elapsedSec;
          speedEl.textContent = "Speed: " + tps.toFixed(1) + " tok/s";
          lastSpeedUpdate = now;
        }
        botBubble.closest(".chat")?.classList.remove("thinking");
        botBubble.textContent = answer;
        if (chatbox) chatbox.scrollTop = chatbox.scrollHeight;
      },
    });

    const cleanAnswer =
      answer.trim() || "I could not generate a reply. Please try again.";
    botBubble.closest(".chat")?.classList.remove("thinking");
    botBubble.textContent = cleanAnswer;
    state.messages.push({ role: "assistant", content: cleanAnswer });
    setStatus("VSP Bot is ready");
    if (speedEl) {
      const elapsedSec = (performance.now() - generationStart) / 1000;
      const finalTps = elapsedSec > 0 ? tokenCount / elapsedSec : 0;
      speedEl.textContent =
        "Speed: " +
        finalTps.toFixed(1) +
        " tok/s | " +
        tokenCount +
        " tokens | " +
        elapsedSec.toFixed(2) +
        " s";
    }
  } catch (error) {
    console.error(error);
    botBubble.closest(".chat")?.classList.remove("thinking");
    botBubble.textContent = `Could not run the local GGUF model: ${error.message}`;
    setStatus("Model failed to load. Check console and local server setup.");
    showProgressPanel(true);
    if (speedEl && tokenCount === 0) {
      speedEl.textContent = "Speed: 0.0 tok/s";
    }
  } finally {
    sendBtn.disabled = false;
    inputEl?.focus();
  }
}

state.cacheCheck = initializeModelUi();

if (toggler) {
  toggler.addEventListener("click", () => {
    bodyElement.classList.toggle("show-vspbot");
    firstIcon?.classList.toggle("hidden");
    closeIcon?.classList.toggle("hidden");
  });
}

closeIconHeader?.addEventListener("click", () => {
  bodyElement.classList.remove("show-vspbot");
});

sendBtn?.addEventListener("click", sendMessage);

inputEl?.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    sendMessage();
  }
});

window.sendMessage = sendMessage;
