import { Wllama, LoggerWithoutDebug } from 'https://cdn.jsdelivr.net/npm/@wllama/wllama@2.2.1/esm/index.js';
import WasmFromCDN from 'https://cdn.jsdelivr.net/npm/@wllama/wllama@2.2.1/esm/wasm-from-cdn.js';

const MODEL_URL =
  "https://huggingface.co/Qwen/Qwen2-0.5B-Instruct-GGUF/resolve/main/qwen2-0_5b-instruct-q2_k.gguf";
const SYSTEM_PROMPT = `You are VSP Bot, a concise assistant on Vishnu Suresh Perumbavoor's portfolio website.
Answer helpfully and naturally. If asked about Vishnu, describe him as a software engineer and AI/full-stack developer from Kerala, India, using only general portfolio context unless the user gives more details.`;

const state = {
  wllama: null,
  modelReady: false,
  loading: null,
  messages: [{ role: 'system', content: SYSTEM_PROMPT }],
};

const bodyElement = document.body;
const toggler = document.querySelector('.vspbot-toggler');
const panel = document.querySelector('.vspbot');
const closeIconHeader = panel?.querySelector('header .fa-xmark');
const chatbox = document.getElementById('vspbot-chatbox');
const statusEl = document.getElementById('vspbot-status');
const inputEl = document.getElementById('user-input');
const sendBtn = document.getElementById('vspbot-send');
const firstIcon = toggler?.querySelector('.fa-robot');
const closeIcon = toggler?.querySelector('.fa-xmark');

function setStatus(message) {
  if (statusEl) statusEl.textContent = message;
}

function addMessage(role, content, extraClass = '') {
  const item = document.createElement('li');
  item.className = `chat ${role === 'user' ? 'outgoing' : 'incoming'} ${extraClass}`.trim();

  if (role !== 'user') {
    const icon = document.createElement('span');
    icon.className = 'fa-solid fa-robot';
    item.appendChild(icon);
  }

  const bubble = document.createElement('p');
  bubble.textContent = content;
  item.appendChild(bubble);
  chatbox.appendChild(item);
  chatbox.scrollTop = chatbox.scrollHeight;
  return bubble;
}

function buildPrompt(messages) {
  return messages
    .map((message) => `<|im_start|>${message.role}\n${message.content}<|im_end|>`)
    .join('\n') + '\n<|im_start|>assistant\n';
}

async function loadModel() {
  if (state.modelReady) return;
  if (state.loading) return state.loading;

  state.loading = (async () => {
    setStatus('Loading VSP Bot powered by Qwen2.5 0.5B... 0%');
    state.wllama = new Wllama(WasmFromCDN, {
      logger: LoggerWithoutDebug,
      parallelDownloads: 3,
    });

    if (window.location.protocol === 'file:') {
      throw new Error('Please run this site with a local web server. Browser GGUF loading will not work from file://.');
    }

    await state.wllama.loadModelFromUrl(MODEL_URL, {
      n_threads: 1,
      progressCallback: ({ loaded, total }) => {
        if (!total) return;
        const percent = Math.round((loaded / total) * 100);
        setStatus(`Loading VSP Bot powered by Qwen2.5 0.5B... ${percent}%`);
      },
    });

    state.modelReady = true;
    setStatus('VSP Bot powered by Qwen2.5 0.5B is ready');
  })();

  return state.loading;
}

async function sendMessage() {
  const text = inputEl.value.trim();
  if (!text || sendBtn.disabled) return;

  inputEl.value = '';
  sendBtn.disabled = true;
  addMessage('user', text);
  const botBubble = addMessage('assistant', 'Thinking', 'thinking');

  try {
    await loadModel();
    state.messages.push({ role: 'user', content: text });

    let answer = '';
    botBubble.closest('.chat')?.classList.add('thinking');
    botBubble.textContent = 'Thinking';
    setStatus('Generating reply...');

    answer = await state.wllama.createCompletion(buildPrompt(state.messages), {
      nPredict: 256,
      sampling: {
        temp: 0.7,
        top_k: 40,
        top_p: 0.9,
      },
      onNewToken: (_token, _piece, currentText) => {
        answer = currentText;
        botBubble.closest('.chat')?.classList.remove('thinking');
        botBubble.textContent = answer;
        chatbox.scrollTop = chatbox.scrollHeight;
      },
    });

    const cleanAnswer = answer.trim() || 'I could not generate a reply. Please try again.';
    botBubble.closest('.chat')?.classList.remove('thinking');
    botBubble.textContent = cleanAnswer;
    state.messages.push({ role: 'assistant', content: cleanAnswer });
    setStatus('VSP Bot powered by Qwen2.5 0.5B is ready');
  } catch (error) {
    console.error(error);
    botBubble.closest('.chat')?.classList.remove('thinking');
    botBubble.textContent = `Could not run the local GGUF model: ${error.message}`;
    setStatus('Model failed to load. Check console and local server setup.');
  } finally {
    sendBtn.disabled = false;
    inputEl.focus();
  }
}

toggler?.addEventListener('click', () => {
  bodyElement.classList.toggle('show-vspbot');
  firstIcon?.classList.toggle('hidden');
  closeIcon?.classList.toggle('hidden');
});

closeIconHeader?.addEventListener('click', () => {
  bodyElement.classList.remove('show-vspbot');
});

sendBtn?.addEventListener('click', sendMessage);

inputEl?.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault();
    sendMessage();
  }
});

window.sendMessage = sendMessage;
