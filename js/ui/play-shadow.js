// Shadow: see the word and a Hebrew hint, listen, then say the sentence. Mic checks the words.
import { esc } from './dom.js';
import { icon } from './icons.js';
import { micPanel, takeScore } from './mic.js';
import { listenBtn, bindListen, ttsOk } from './tts.js';

export function mount(el, item, { ctx, finish }) {
  const { A } = ctx;
  const toks = A.tokenize(item.sentence_en);
  const wordNorm = String(item.word || '').toLowerCase();
  // Sentence as token spans, keeping punctuation between them.
  let pos = 0;
  const parts = [];
  toks.forEach((t, k) => {
    parts.push(esc(item.sentence_en.slice(pos, t.start)));
    const key = t.norm === wordNorm ? ' key' : '';
    parts.push(`<span class="tw${key}" data-k="${k}">${esc(t.w)}</span>`);
    pos = t.end;
  });
  parts.push(esc(item.sentence_en.slice(pos)));

  el.innerHTML = `<div class="stack">
    <div class="card word-card">
      <div class="en word-big" dir="ltr" lang="en">${esc(item.word)}</div>
      <p class="hint">${icon('volume')} <span>${esc(item.hint_he)}</span></p>
      ${ttsOk() ? `<div class="row" style="justify-content:center">
        <button class="btn ghost sm" data-say data-text="${esc(item.word)}" data-slow="1">${icon('volume')} המילה, לאט</button>
        ${listenBtn('כל המשפט')}
      </div>` : ''}
    </div>
    <div class="card">
      <div class="tiny muted" style="margin-bottom:6px">אמור בקול:</div>
      <p class="en en-lg sentence" dir="ltr" lang="en">${parts.join('')}</p>
      ${item.why_he ? `<p class="why small muted">${icon('bulb')} ${esc(item.why_he)}</p>` : ''}
    </div>
    <div data-mic></div>
  </div>`;
  bindListen(el, item.sentence_en);

  const spans = Array.from(el.querySelectorAll('.tw'));
  const light = (text) => {
    const said = new Set(A.tokenize(text).map((t) => t.norm));
    spans.forEach((s, k) => s.classList.toggle('hit', said.has(toks[k].norm)));
  };

  micPanel(el.querySelector('[data-mic]'), ctx, {
    target: item.sentence_en,
    label: 'הקלט את המשפט',
    onLive: (_a, text) => light(text),
    onDone: (take) => {
      if (take.transcript) light(take.transcript);
      finish({ score: takeScore(take), take });
    },
  });
}
