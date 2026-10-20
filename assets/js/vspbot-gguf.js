import {
  Wllama,
  LoggerWithoutDebug,
} from "https://cdn.jsdelivr.net/npm/@wllama/wllama@2.2.1/esm/index.js";
import WasmFromCDN from "https://cdn.jsdelivr.net/npm/@wllama/wllama@2.2.1/esm/wasm-from-cdn.js";

const MODEL_URL =
  "https://huggingface.co/vishnusureshperumbavoor/vsp_alpaca-instruct-300ep-v2-vml/resolve/main/vsp_alpaca-instruct-300ep-v2-instruct-q4_k_m.gguf";
const MODEL_SIZE_HINT_BYTES = 380 * 1024 * 1024;
const MODEL_READY_KEY = "vspbot_model_ready_vsp_alpaca_300ep_v2_instruct_q4km";
const MODEL_SIZE_KEY = "vspbot_model_size_vsp_alpaca_300ep_v2_instruct_q4km";

const state = {
  wllama: null,
  modelReady: false,
  loading: null,
  modelTotalBytes: null,
  hasCachedModelHint: false,
  cacheCheck: null,
  messages: [],
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
      modelSizeEl.innerHTML = `<i class="fa-solid fa-microchip"></i> Model: ${formatBytes(total)} (GGUF Q4_K_M)`;
    } else {
      modelSizeEl.innerHTML = `<i class="fa-solid fa-microchip"></i> Model: ~${formatBytes(MODEL_SIZE_HINT_BYTES)} (GGUF Q4_K_M)`;
    }
  }

  if (downloadedEl) {
    if (Number.isFinite(loaded) && loaded >= 0) {
      const totalText =
        Number.isFinite(total) && total > 0 ? formatBytes(total) : "...";
      downloadedEl.innerHTML = `<i class="fa-solid fa-cloud-arrow-down"></i> Downloaded: ${formatBytes(loaded)} / ${totalText}`;
    } else {
      downloadedEl.innerHTML = `<i class="fa-solid fa-cloud-arrow-down"></i> Status: Ready on demand`;
    }
  }

  if (storageInfoEl) {
    storageInfoEl.innerHTML =
      `<i class="fa-solid fa-database"></i> Storage: IndexedDB (Client-Side)`;
  }
}

function showProgressPanel(show = true) {
  if (!progressWrapEl) return;
  progressWrapEl.classList.remove("is-collapsed");
  progressWrapEl.classList.add("is-visible");
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

function cleanupLegacyStorageKeys() {
  try {
    const toRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (
        k &&
        k.startsWith("vspbot_") &&
        k !== MODEL_READY_KEY &&
        k !== MODEL_SIZE_KEY
      ) {
        toRemove.push(k);
      }
    }
    toRemove.forEach((k) => localStorage.removeItem(k));
  } catch (_e) {}
}

function updateDownloadButtonsUi(statusState, percent = null) {
  const preloadBtn = document.getElementById("vspbot-preload-btn");
  const trayDownloadBtn = document.getElementById("vspbot-download-model-btn");

  if (statusState === "cached" || statusState === "ready") {
    if (preloadBtn) {
      preloadBtn.className = "vspbot-download-chip is-cached";
      preloadBtn.disabled = true;
      preloadBtn.title = "Model ready in browser storage";
      preloadBtn.innerHTML = `<i class="fa-solid fa-circle-check"></i>`;
    }
    if (trayDownloadBtn) {
      trayDownloadBtn.className = "vspbot-tray-icon-btn";
      trayDownloadBtn.disabled = true;
      trayDownloadBtn.title = "Model cached & ready in browser storage";
      trayDownloadBtn.innerHTML = `<i class="fa-solid fa-circle-check"></i>`;
    }
  } else if (statusState === "loading") {
    const pctText = percent !== null ? ` ${percent}%` : "";
    if (preloadBtn) {
      preloadBtn.className = "vspbot-download-chip is-loading";
      preloadBtn.disabled = true;
      preloadBtn.title = `Downloading model...${pctText}`;
      preloadBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i><span class="vspbot-btn-pct">${pctText}</span>`;
    }
    if (trayDownloadBtn) {
      trayDownloadBtn.className = "vspbot-tray-icon-btn";
      trayDownloadBtn.disabled = true;
      trayDownloadBtn.title = `Downloading model...${pctText}`;
      trayDownloadBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i>`;
    }
  } else {
    // idle / not downloaded
    if (preloadBtn) {
      preloadBtn.className = "vspbot-download-chip";
      preloadBtn.disabled = false;
      preloadBtn.title = "Download model weights (380 MB)";
      preloadBtn.innerHTML = `<i class="fa-solid fa-cloud-arrow-down"></i>`;
    }
    if (trayDownloadBtn) {
      trayDownloadBtn.className = "vspbot-tray-icon-btn";
      trayDownloadBtn.disabled = false;
      trayDownloadBtn.title = "Download model weights into browser storage (380 MB)";
      trayDownloadBtn.innerHTML = `<i class="fa-solid fa-cloud-arrow-down"></i>`;
    }
  }
}

async function initializeModelUi() {
  cleanupLegacyStorageKeys();
  setStatus("Checking model cache...");

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
    setStatus("Model Cached • Ready in Browser");
    markModelCached(sizeToUse);
    updateDownloadButtonsUi("cached");
  } else {
    setDownloadMeta();
    setProgress(0);
    setStatus("Ready to download • Local WASM LLM");
    updateDownloadButtonsUi("idle");
  }
}

async function loadModel() {
  if (state.modelReady) return;
  if (state.loading) return state.loading;

  state.loading = (async () => {
    updateDownloadButtonsUi("loading", 0);
    setDownloadMeta();
    showProgressPanel(true);
    setProgress(0);
    setStatus("Downloading model weights... 0%");

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
        setStatus(`Downloading model weights... ${percent}%`);
        updateDownloadButtonsUi("loading", percent);
      },
    });

    state.modelReady = true;
    setProgress(100);
    const finalSize = state.modelTotalBytes || MODEL_SIZE_HINT_BYTES;
    setDownloadMeta({ loaded: finalSize, total: finalSize });
    setStatus("VSP Bot is ready");
    markModelCached(finalSize);
    state.hasCachedModelHint = true;
    updateDownloadButtonsUi("ready");
  })().catch((err) => {
    state.loading = null;
    updateDownloadButtonsUi("idle");
    throw err;
  });

  return state.loading;
}

async function sendMessage() {
  const text = inputEl?.value.trim();
  if (!text || !sendBtn || sendBtn.disabled) return;

  if (state.cacheCheck) {
    await state.cacheCheck;
  }

  inputEl.value = "";
  inputEl.style.height = "38px";
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
  let firstTokenTime = 0;
  let ttftMs = 0;
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
        temp: 0.1,
        top_k: 40,
        top_p: 0.9,
      },
      stopWords: ["<|im_end|>", "<|endoftext|>", "<|im_start|>"],
      onNewToken: (_token, _piece, currentText) => {
        tokenCount += 1;
        answer = currentText;
        const now = performance.now();

        if (tokenCount === 1) {
          firstTokenTime = now;
          ttftMs = Math.round(firstTokenTime - generationStart);
        }

        const evalSec = (now - firstTokenTime) / 1000;
        const tps =
          evalSec > 0 && tokenCount > 1
            ? (tokenCount - 1) / evalSec
            : tokenCount / Math.max(0.001, (now - generationStart) / 1000);

        if (speedEl && (now - lastSpeedUpdate > 250 || tokenCount === 1)) {
          speedEl.textContent = `Speed: ${tps.toFixed(1)} tok/s | TTFT: ${ttftMs} ms`;
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
      const totalEvalSec = (performance.now() - firstTokenTime) / 1000;
      const finalTps =
        totalEvalSec > 0 && tokenCount > 1
          ? (tokenCount - 1) / totalEvalSec
          : tokenCount /
            Math.max(0.001, (performance.now() - generationStart) / 1000);
      speedEl.textContent = `Speed: ${finalTps.toFixed(1)} tok/s | ${tokenCount} tokens | TTFT: ${ttftMs} ms`;
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
  const handleToggle = (e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    bodyElement.classList.toggle("show-vspbot");
  };
  toggler.addEventListener("click", handleToggle);
}

if (closeIconHeader) {
  closeIconHeader.addEventListener("click", (e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    bodyElement.classList.remove("show-vspbot");
  });
}

sendBtn?.addEventListener("click", sendMessage);

inputEl?.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    sendMessage();
  }
});

inputEl?.addEventListener("input", () => {
  inputEl.style.height = "auto";
  inputEl.style.height = `${Math.min(Math.max(inputEl.scrollHeight, 38), 120)}px`;
});

window.sendMessage = sendMessage;

async function clearCachedModel() {
  const confirmed = window.confirm(
    "Are you sure you want to delete the cached GGUF model weights (~380 MB) from your browser storage?"
  );
  if (!confirmed) return;

  const btn = document.getElementById("vspbot-delete-model");
  if (btn) btn.disabled = true;
  setStatus("Purging cached model from browser storage...");

  try {
    if ("caches" in window) {
      const keys = await caches.keys();
      for (const k of keys) {
        await caches.delete(k);
      }
    }
    localStorage.removeItem(MODEL_READY_KEY);
    localStorage.removeItem(MODEL_SIZE_KEY);
    // Remove any legacy vspbot keys
    const toRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith("vspbot_")) {
        toRemove.push(k);
      }
    }
    toRemove.forEach((k) => localStorage.removeItem(k));

    state.modelReady = false;
    state.hasCachedModelHint = false;
    state.wllama = null;
    state.loading = null;
    state.messages = [];
    setProgress(0);
    setDownloadMeta({ loaded: 0, total: null });
    setStatus("Cached model purged. Click 'Download Model' or send a message.");
    showProgressPanel(true);
    if (downloadedEl) downloadedEl.innerHTML = `<i class="fa-solid fa-cloud-arrow-down"></i> Status: Cache cleared (0 B)`;
    updateDownloadButtonsUi("idle");
  } catch (err) {
    console.error("Error clearing model cache:", err);
    setStatus("Failed to clear cache: " + err.message);
  } finally {
    if (btn) btn.disabled = false;
  }
}

const deleteModelBtn = document.getElementById("vspbot-delete-model");
deleteModelBtn?.addEventListener("click", clearCachedModel);
window.clearCachedModel = clearCachedModel;

// Manual Pre-Download Buttons (Preload Card & Telemetry Tray)
const preloadBtn = document.getElementById("vspbot-preload-btn");
const trayDownloadBtn = document.getElementById("vspbot-download-model-btn");

async function handleManualDownload() {
  if (state.modelReady || state.loading) return;
  try {
    showProgressPanel(true);
    await loadModel();
  } catch (err) {
    console.error("Manual model download error:", err);
    setStatus("Model download failed: " + err.message);
  }
}

preloadBtn?.addEventListener("click", handleManualDownload);
trayDownloadBtn?.addEventListener("click", handleManualDownload);

// Diagnostic & Storage HUD toggle button
const diagToggleBtn = document.getElementById("vspbot-diag-toggle");
if (diagToggleBtn && progressWrapEl) {
  diagToggleBtn.addEventListener("click", () => {
    const isCollapsed = progressWrapEl.classList.contains("is-collapsed");
    showProgressPanel(isCollapsed);
  });
}

// Quick Suggestion Chips
document.querySelectorAll(".vspbot-chip").forEach((chip) => {
  chip.addEventListener("click", () => {
    const promptText = chip.getAttribute("data-prompt") || chip.textContent.trim();
    if (inputEl && promptText) {
      inputEl.value = promptText;
      sendMessage();
    }
  });
});

// Mobile Virtual Keyboard & Visual Viewport Synchronization
function initMobileViewportSync() {
  const isMobile = () => window.innerWidth <= 768;

  const updateViewport = () => {
    if (!isMobile()) {
      document.documentElement.style.removeProperty("--vsp-visual-height");
      document.body.classList.remove("keyboard-open");
      return;
    }

    const vv = window.visualViewport;
    const visualHeight = vv ? Math.round(vv.height) : window.innerHeight;
    document.documentElement.style.setProperty("--vsp-visual-height", `${visualHeight}px`);

    const activeEl = document.activeElement;
    const isInputActive =
      activeEl &&
      (activeEl === inputEl ||
        activeEl.tagName === "TEXTAREA" ||
        activeEl.tagName === "INPUT");

    const isKeyboardVisible =
      isInputActive ||
      (window.screen && window.screen.availHeight - visualHeight > 140);

    if (isKeyboardVisible && isInputActive) {
      document.body.classList.add("keyboard-open");
      if (chatbox) {
        requestAnimationFrame(() => {
          chatbox.scrollTop = chatbox.scrollHeight;
        });
      }
    } else if (!isInputActive) {
      document.body.classList.remove("keyboard-open");
    }
  };

  if (window.visualViewport) {
    window.visualViewport.addEventListener("resize", updateViewport);
    window.visualViewport.addEventListener("scroll", () => {
      if (
        document.body.classList.contains("keyboard-open") ||
        document.body.classList.contains("vspbot-full-page")
      ) {
        window.scrollTo(0, 0);
      }
      updateViewport();
    });
  } else {
    window.addEventListener("resize", updateViewport);
  }

  if (inputEl) {
    inputEl.addEventListener("focus", () => {
      if (isMobile()) {
        document.body.classList.add("keyboard-open");
        window.scrollTo(0, 0);
        setTimeout(() => {
          updateViewport();
          if (chatbox) chatbox.scrollTop = chatbox.scrollHeight;
        }, 100);
      }
    });

    inputEl.addEventListener("blur", () => {
      if (isMobile()) {
        setTimeout(() => {
          const activeEl = document.activeElement;
          if (
            !activeEl ||
            (activeEl !== inputEl && activeEl.tagName !== "TEXTAREA")
          ) {
            document.body.classList.remove("keyboard-open");
            updateViewport();
            window.scrollTo(0, 0);
          }
        }, 100);
      }
    });
  }

  // Initial calculation
  updateViewport();
}

initMobileViewportSync();
