// systems/voice.js — TTS (Web Speech API) + кэш голосов

let enabled = true;
let cachedVoices = [];

export function isVoiceSupported() {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

// Вызывается при первом клике по странице — прогревает список голосов
export function initVoices() {
  if (!isVoiceSupported()) return;
  cachedVoices = window.speechSynthesis.getVoices() || [];
  console.log('[voice] initVoices →', cachedVoices.map(v => `${v.name} (${v.lang})`));

  window.speechSynthesis.onvoiceschanged = () => {
    cachedVoices = window.speechSynthesis.getVoices() || [];
    console.log('[voice] voiceschanged →', cachedVoices.map(v => `${v.name} (${v.lang})`));
  };
}

export function getVoicesList() {
  if (!isVoiceSupported()) return [];
  if (!cachedVoices.length) {
    cachedVoices = window.speechSynthesis.getVoices() || [];
  }
  return cachedVoices;
}

function pickRussianVoice() {
  const voices = getVoicesList();
  const ru =
    voices.find(v => v.lang === 'ru-RU') ||
    voices.find(v => v.lang && v.lang.toLowerCase().startsWith('ru'));
  if (!ru) {
    console.warn('[voice] ❌ русский голос НЕ найден. Доступны:', voices.map(v => v.lang));
    return null;
  }
  console.log('[voice] ✅ выбран голос:', ru.name, ru.lang);
  return ru;
}

// ВАЖНО: speak() должен вызываться синхронно внутри обработчика клика
export function speak(text, opts = {}) {
  if (!isVoiceSupported() || !enabled) return false;
  const clean = String(text || '').replace(/\s+/g, ' ').trim();
  if (!clean) return false;

  try {
    if (window.speechSynthesis.speaking || window.speechSynthesis.pending) {
      window.speechSynthesis.cancel();
    }

    const u = new SpeechSynthesisUtterance(clean);
    u.lang = 'ru-RU';
    u.rate = opts.rate ?? 0.86;
    u.pitch = opts.pitch ?? 0.92;
    u.volume = opts.volume ?? 1;

    const v = pickRussianVoice();
    if (v) u.voice = v;

    u.onstart = () => console.log('[voice] ▶ start');
    u.onend = () => console.log('[voice] ⏹ end');
    u.onerror = (e) => console.error('[voice] ❌ error:', e.error, e);

    window.speechSynthesis.speak(u);
    console.log('[voice] speak() вызван, длина текста:', clean.length);
    return true;
  } catch (e) {
    console.error('[voice] ❌ исключение:', e);
    return false;
  }
}

export function stop() {
  if (!isVoiceSupported()) return;
  try { window.speechSynthesis.cancel(); } catch {}
}

export function isSpeaking() {
  return isVoiceSupported() && !!window.speechSynthesis.speaking;
}

export function setEnabled(v) {
  enabled = !!v;
  if (!enabled) stop();
}

export function isEnabled() {
  return enabled;
}