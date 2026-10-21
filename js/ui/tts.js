// "Listen" buttons: the browser's own text-to-speech, English voice, prefers local voices.
import { icon } from './icons.js';

export const ttsOk = () => typeof window !== 'undefined' && 'speechSynthesis' in window && typeof SpeechSynthesisUtterance === 'function';

function pickVoice() {
  try {
    const vs = speechSynthesis.getVoices().filter((v) => /^en[-_]/i.test(v.lang));
    return vs.find((v) => v.localService && /en[-_]US/i.test(v.lang)) || vs.find((v) => v.localService) || vs.find((v) => /en[-_]US/i.test(v.lang)) || vs[0] || null;
  } catch { return null; }
}

export function say(text, { rate = 0.92, onend } = {}) {
  if (!ttsOk()) return false;
  try {
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'en-US';
    u.rate = rate;
    const v = pickVoice();
    if (v) u.voice = v;
    if (onend) { u.onend = onend; u.onerror = onend; }
    speechSynthesis.speak(u);
    return true;
  } catch { return false; }
}

export function listenBtn(label = 'הקשב') {
  if (!ttsOk()) return '';
  return `<button class="btn ghost sm" data-say>${icon('volume')} ${label}</button>`;
}

// Bind every [data-say] in root to speak `text` (or data-text on the button).
export function bindListen(root, text) {
  root.querySelectorAll('[data-say]').forEach((b) => {
    b.addEventListener('click', () => {
      const t = b.dataset.text || text;
      b.classList.add('speaking');
      const slow = b.dataset.slow === '1';
      if (!say(t, { rate: slow ? 0.7 : 0.92, onend: () => b.classList.remove('speaking') })) b.classList.remove('speaking');
    });
  });
}
