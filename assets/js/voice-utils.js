/**
 * ============================================================================
 * VSP Shared Voice Utilities
 * - Natural-voice selection across Edge / Chrome / Safari / Android
 * - Markdown cleanup that preserves prosody cues (punctuation)
 * - Sentence grouping so intonation flows instead of resetting per sentence
 * Loaded as a classic script before the bot modules; exposed on window.VSPVoice
 * ============================================================================
 */
(function (global) {
  "use strict";

  // Voices that sound genuinely natural when present.
  const PREMIUM_HINTS = [
    "natural", "neural", "online", "enhanced", "premium", "wavenet", "studio",
  ];

  // Clearly synthetic / novelty voices we never want to fall back to.
  const ROBOTIC_HINTS = [
    "espeak", "festival", "flite", "pico", "sam", "albert", "zarvox",
    "trinoids", "bells", "boing", "bubbles", "cellos", "deranged",
    "hysterical", "jester", "organ", "superstar", "wobble", "bahh",
    "bessel", "bad news", "good news", "princess",
  ];

  // Lower quality variants that should lose to better options.
  const LOW_QUALITY_HINTS = ["compact", "desktop", "eloquence"];

  const FEMALE_HINTS = [
    "female", "woman", "aria", "jenny", "sonia", "neerja", "heera", "veena",
    "samantha", "serena", "victoria", "karen", "ava", "emma", "zoe", "moira",
    "tessa", "fiona", "allison", "susan", "catherine", "linda", "hazel",
    "elena", "salli", "joanna", "kendra", "kimberly", "ivy", "amy", "natasha",
    "clara", "libby", "maisie", "olivia", "zira", "michelle", "monica",
  ];

  const MALE_HINTS = [
    "male", "david", "mark", "george", "daniel", "james", "fred", "ralph",
    "arthur", "guy", "ryan", "brian", "matthew", "eric", "roger", "steffan",
    "thomas", "oliver", "henry", "alex", "aaron", "liam",
  ];

  function lower(value) {
    return (value || "").toLowerCase();
  }

  function scoreVoice(voice) {
    const name = lower(voice.name);
    const lang = lower(voice.lang);
    let score = 0;

    // Language preference: English only, slight edge to natural variants.
    if (/^en([-_]|$)/.test(lang)) {
      score += 20;
      if (lang.startsWith("en-in")) score += 8;
      else if (lang.startsWith("en-gb")) score += 6;
      else if (lang.startsWith("en-us")) score += 5;
    } else {
      score -= 10;
    }

    for (const hint of PREMIUM_HINTS) {
      if (name.includes(hint)) score += 60;
    }
    for (const hint of ROBOTIC_HINTS) {
      if (name.includes(hint)) score -= 90;
    }
    for (const hint of LOW_QUALITY_HINTS) {
      if (name.includes(hint)) score -= 20;
    }
    for (const hint of FEMALE_HINTS) {
      if (name.includes(hint)) score += 30;
    }
    for (const hint of MALE_HINTS) {
      if (name.includes(hint)) score -= 45;
    }

    // Google system voices are consistently clean on Chrome/Android.
    if (name.includes("google")) score += 45;
    // Apple Siri / premium voices.
    if (name.includes("siri")) score += 20;

    return score;
  }

  function selectVoice(voices) {
    if (!voices || voices.length === 0) return null;

    const english = voices.filter((v) => /^en([-_]|$)/i.test(v.lang || ""));
    const pool = english.length > 0 ? english : voices;

    let best = null;
    let bestScore = -Infinity;
    for (const voice of pool) {
      const score = scoreVoice(voice);
      if (score > bestScore) {
        bestScore = score;
        best = voice;
      }
    }
    return best || pool[0];
  }

  function cleanForSpeech(raw) {
    if (!raw) return "";
    let text = String(raw)
      .replace(/```[\s\S]*?```/g, " ")
      .replace(/`([^`]+)`/g, "$1")
      .replace(/https?:\/\/\S+/g, " ")
      .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
      .replace(/(\*\*|__)(.*?)\1/g, "$2")
      .replace(/(\*|_)(.*?)\1/g, "$2")
      .replace(/^#{1,6}\s+/gm, "")
      .replace(/^>\s?/gm, "")
      .replace(/^\s*[-*+\u2022]\s+/gm, "")
      .replace(/<\|.*?\|>/g, " ")
      // Strip emoji / pictographs so they are not read aloud.
      .replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{200D}]/gu, " ")
      .replace(/&/g, " and ")
      .replace(/%/g, " percent ")
      .replace(/\r/g, "")
      .replace(/\n{2,}/g, ". ")
      .replace(/\n/g, " ")
      .replace(/[ \t]+/g, " ")
      .replace(/\s{2,}/g, " ")
      .trim();

    // Make sure punctuation is followed by a space so TTS pauses correctly.
    text = text.replace(/([.!?])([A-Za-z])/g, "$1 $2").trim();
    if (text && !/[.!?]$/.test(text)) text += ".";
    return text;
  }

  function hardWrap(sentence, maxLen) {
    const words = sentence.split(/\s+/);
    const lines = [];
    let line = "";
    for (const word of words) {
      if ((line + " " + word).trim().length <= maxLen) {
        line = (line + " " + word).trim();
      } else {
        if (line) lines.push(line);
        line = word;
      }
    }
    if (line) lines.push(line);
    return lines;
  }

  function chunkForSpeech(text, maxLen = 240) {
    const source = String(text || "").trim();
    if (!source) return [];

    const paragraphs = source.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
    const chunks = [];

    for (const paragraph of paragraphs) {
      const sentences =
        paragraph.match(/[^.!?]+[.!?]+["')\]]*|[^.!?]+$/g) || [paragraph];
      let current = "";
      for (const rawSentence of sentences) {
        const sentence = rawSentence.trim();
        if (!sentence) continue;
        if ((current + " " + sentence).trim().length <= maxLen) {
          current = (current + " " + sentence).trim();
        } else {
          if (current) chunks.push(current);
          if (sentence.length <= maxLen) {
            current = sentence;
          } else {
            const lines = hardWrap(sentence, maxLen);
            for (let i = 0; i < lines.length - 1; i += 1) chunks.push(lines[i]);
            current = lines[lines.length - 1] || "";
          }
        }
      }
      if (current) chunks.push(current);
    }

    return chunks;
  }

  global.VSPVoice = {
    selectVoice,
    cleanForSpeech,
    chunkForSpeech,
    SPEECH_RATE: 1.0,
    SPEECH_PITCH: 1.0,
  };
})(window);
