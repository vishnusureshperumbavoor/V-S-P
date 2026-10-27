# Vishnu Suresh Perumbavoor (VSP) Portfolio & In-Browser AI Assistant

Personal website and interactive in-browser AI portfolio featuring local edge SLM inference via WebAssembly (Wasm) and GGUF quantization.

---

## 🚀 Quick Start (Local Development)

To run the website and test the local in-browser GGUF model bot with live reloading:

```bash
npx live-server --port=5500
```

Then open your browser and navigate to:
* **Home**: [http://127.0.0.1:5500/index.html](http://127.0.0.1:5500/index.html)
* **VSP Bot (Full Page)**: [http://127.0.0.1:5500/bot/index.html](http://127.0.0.1:5500/bot/index.html)

> **Note**: An active local HTTP server is required for WebAssembly and Cache Storage to load GGUF models in the browser (`file://` protocol is not supported by browser security policies).

---

## 🤖 In-Browser AI Bot Architecture

The website features an edge AI assistant that runs 100% locally in the user's browser without sending user messages to any external server:

- **Engine**: [@wllama/wllama](https://github.com/mangled/wllama) (Wasm + Web Workers)
- **Base Model**: `Qwen/Qwen2-0.5B-Instruct`
- **Fine-Tuning**: 300 Epochs Alpaca Instruct Dataset (Trained on [Vibe ML Studio](https://github.com/vishnusureshperumbavoor/Vibe-ML-Studio))
- **Quantization**: `Q4_K_M` GGUF (~379 MB)
- **Prompt Format**: ChatML (`<|im_start|>role\ncontent<|im_end|>`)
- **Storage**: Browser-managed CacheStorage + IndexedDB with in-app one-click cache purge
- **Voice Interaction**: Native browser Speech Recognition (STT dictation) & Speech Synthesis (TTS voice responses with read-aloud controls)

---

## 📂 Project Structure

```text
V-S-P/
├── assets/
│   ├── css/
│   │   └── style-starter.css      # Core styles & dark theme
│   ├── js/
│   │   └── vspbot-gguf.js         # In-browser Wllama AI bot engine
│   └── images/                    # Profile images & project graphics
├── bot/
│   └── index.html                 # Dedicated full-page bot view
├── index.html                     # Main portfolio page with floating bot widget
└── blogs.html                     # Tech articles and case studies
```
