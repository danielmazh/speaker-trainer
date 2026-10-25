// analyze.js - pure transcript analysis. Runs in node and in the browser.
// No DOM, no network, no storage. Input is text, output is plain objects.
//
// Exports (see CONTRACT.md):
//   tokenize(text)                          -> [{ w, norm, i, start, end, boundary }]
//   analyze(transcript, durationSec, opts)  -> metrics, score 0..100, Hebrew tips
//   highlight(transcript)                   -> [{ text, kind }] covering the whole text
//
// All detection is heuristic. It is tuned for one speaker (Hebrew native,
// technical talks) and prefers missing a case over a false alarm.

// ---------------------------------------------------------------------------
// Tokens

// "a.m." / "p.m." is one token (norm "am" / "pm"), so its "m" is never read as "um".
// The final dot stays outside the token, so a sentence end after it is still a boundary.
const TOKEN_RE = /[0-9]+(?:[.,][0-9]+)*%?|(?<![A-Za-zÀ-ɏ])[AaPp]\.\s?[Mm](?![A-Za-zÀ-ɏ])|[A-Za-zÀ-ɏ]+(?:['’][A-Za-z]+)*/g;
const AMPM_RE = /^([AaPp])\.\s?[Mm]$/;
const CLAUSE_PUNCT = /[.,!?;:]/;

/** Split text into word tokens. `i` is the token index, `start`/`end` are char offsets.
 *  `boundary` is true when the token starts a clause (text start or punctuation before it).
 *  `commaBefore` is true when only a comma separates it from the previous token. */
export function tokenize(text) {
  const src = String(text ?? '');
  const out = [];
  let m;
  let lastEnd = 0;
  TOKEN_RE.lastIndex = 0;
  while ((m = TOKEN_RE.exec(src)) !== null) {
    const w = m[0];
    const gap = src.slice(lastEnd, m.index);
    out.push({
      w,
      norm: AMPM_RE.test(w) ? w[0].toLowerCase() + 'm' : w.toLowerCase().replace(/’/g, "'"),
      i: out.length,
      start: m.index,
      end: m.index + w.length,
      boundary: out.length === 0 || CLAUSE_PUNCT.test(gap),
      // Only a comma before it (no full stop, question mark, colon or semicolon).
      commaBefore: out.length > 0 && gap.includes(',') && !/[.!?;:]/.test(gap),
    });
    lastEnd = m.index + w.length;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Word lists

const set = (s) => new Set(s.split(/\s+/).filter(Boolean));

const HESITATIONS = { um: /^u+m+$|^h+m+$|^m{2,}$/, uh: /^u+h+$|^a+h+$/, erm: /^e+r+m*$/ };

const CLAUSE_JOINERS = set('and but or well because then okay ok yeah now also');
const SO_NOT_FILLER_NEXT = set('that far much many long called good bad cool important easy hard big fast slow simple sure');
// "like" is a real verb or comparison after these words.
const LIKE_KEEP_PREV = set(`would i'd you'd we'd they'd he'd she'd i you we they he she people don't doesn't didn't
  really also just look looks looked looking feel feels felt seem seems seemed sound sounds sounded
  something anything nothing things stuff more exactly much be is was are were it's that's not`);
const LIKE_KEEP_NEXT = set('this that these those');
const LIKE_SUBJ_NEXT = set('i we they you he she it people everyone everybody');
// Words that end in -s but are not plural nouns, so "like" after them can still be a filler.
const NOT_PLURAL_S = set(`was has does this its yes thus plus always perhaps sometimes unless
  besides towards afterwards across less`);
const YOU_KNOW_KEEP_PREV = set("do did don't didn't if whether");
const YOU_KNOW_KEEP_NEXT = set('how where why when who which whether if');
const KIND_KEEP_PREV = set('a the this that what some any which every one each another');

// Words that end in -ing but are not verb forms (or are fine without "is/are").
const ING_NOT_VERB = set(`thing things something nothing anything everything morning evening during string ceiling
  king ring spring bring sing wing sting swing ping bing meeting building setting settings pricing logging
  training testing onboarding scaling being including regarding according following nothing`);

const SUBJ_ALWAYS = set('i we they he she');
const SUBJ_REL = set('that who which');
const SUBJ_LIMITED = set('it you');
const SUBJ_OPENERS = set(`and but so if when because that now then maybe okay ok well where while since
  think know guess see mean said say hope believe`);
const THAT_CLAUSE_VERBS = set(`see saw seen think thought know knew say said believe mean means meant hope notice noticed
  show shows showed feel felt guess sure is was so understand understood realize realized remember`);
const QUANTIFIERS = set('both all some none each two three many most one any several');
const MIDDLE_ADVERBS = set('also still just now already always really actually currently all both only');
const FINITE_AFTER_GERUND = set(`is was are were makes made helps gives means takes saves costs requires seems becomes
  became can will would should could might may must isn't wasn't won't can't`);
const SCAN_STOP = set('that which who where when because and but so if');
const PASSIVE_NEXT = set('to with by');
const BE_FOR = { i: 'am', we: 'are', they: 'are', you: 'are', them: 'are', he: 'is', she: 'is', it: 'is', that: 'is', who: 'is', which: 'is' };

// Third person present: "it make" should be "it makes".
const BASE_VERBS = set(`make take give work run use need have do go know mean look seem help get want show call send
  write save cost contain depend support allow create return handle store load start stop keep try come say see
  change include require check build process connect cause fit sound feel happen matter`);
const AUX_BEFORE_SUBJ = set(`do does did can could will would should may might must doesn't didn't don't can't won't
  let make makes made help helps see saw watch have has had`);

const HE_WORDS = set("he him his he's himself he'll he'd");
const TECH_WORDS = set('model models agent agents ai llm llms it bot bots system chatbot gpt assistant tool');
const HUMAN_WORDS = set(`colleague guy man boss manager friend customer client user developer engineer person alex ceo cto
  father brother son dad husband boyfriend teacher lead architect`);

// Weight used for the filler rate: "again" is often real, so it counts half.
const FILLER_WEIGHT = { again: 0.5 };
// Weight per be-drop kind for the score: missing -s is a light error.
const DROP_WEIGHT = { be: 1, gonna: 1, passive: 0.6, s: 0.5 };

// ---------------------------------------------------------------------------
// Detection core (shared by analyze and highlight)

function scan(tokens) {
  const n = tokens.length;
  const at = (k) => (k >= 0 && k < n ? tokens[k].norm : '');
  const fillers = []; // { key, from, to }
  const drops = []; // { kind, from, to, text, index, fix }
  const he = []; // token index
  const used = new Set();

  const addFiller = (key, from, to = from) => {
    for (let k = from; k <= to; k++) used.add(k);
    fillers.push({ key, from, to });
  };

  // Is token k a clause subject position? (start of clause, or after an opener word)
  const subjStart = (k) => tokens[k].boundary || SUBJ_OPENERS.has(at(k - 1));

  for (let k = 0; k < n; k++) {
    const t = tokens[k];
    const w = t.norm;
    if (used.has(k)) continue;

    // Two-word fillers first.
    const w2 = at(k + 1);
    const nextCommaOrEnd = k + 1 >= n || tokens[k + 1].boundary;
    if ((w === "let's" || w === 'lets') && w2 === 'say') { addFiller("let's say", k, k + 1); continue; }
    if (w === 'you' && w2 === 'know' && !YOU_KNOW_KEEP_PREV.has(at(k - 1)) && !YOU_KNOW_KEEP_NEXT.has(at(k + 2))) {
      addFiller('you know', k, k + 1); continue;
    }
    if ((w === 'kind' || w === 'sort') && w2 === 'of' && !KIND_KEEP_PREV.has(at(k - 1))) {
      addFiller(w + ' of', k, k + 1); continue;
    }

    // Hesitation sounds.
    let hes = null;
    for (const key of Object.keys(HESITATIONS)) if (HESITATIONS[key].test(w)) { hes = key; break; }
    if (hes) { addFiller(hes, k); continue; }

    if (w === 'basically' || w === 'whatever') { addFiller(w, k); continue; }
    // "again" is a filler at a clause start ("Again, ..."); at the end it is real ("say that again").
    if (w === 'again' && (t.boundary || CLAUSE_JOINERS.has(at(k - 1)))) { addFiller(w, k); continue; }
    // "actually" is a filler only at a clause start or before a comma ("what actually happened" is real).
    if (w === 'actually') {
      const commaAfter = k + 1 < n && tokens[k + 1].boundary;
      if (t.boundary || commaAfter || CLAUSE_JOINERS.has(at(k - 1))) { addFiller(w, k); continue; }
    }

    if (w === 'so') {
      const doubled = at(k - 1) === 'so' || w2 === 'so';
      const clauseStart = t.boundary || CLAUSE_JOINERS.has(at(k - 1));
      // ", so we ..." joins two clauses (= therefore). A filler "so" opens a sentence.
      const conjunction = t.commaBefore && k + 1 < n && !tokens[k + 1].boundary;
      if (doubled || (clauseStart && !conjunction && !SO_NOT_FILLER_NEXT.has(w2))) { addFiller('so', k); continue; }
    }

    if (w === 'like') {
      const commaAfter = k + 1 < n && tokens[k + 1].boundary;
      // After a plural noun or a name, "like" is a verb or "such as": "users like it", "tools like Git".
      const prevTok = k > 0 ? tokens[k - 1] : null;
      const nounBefore = !!prevTok && (
        (/^[a-z]{3,}s$/.test(prevTok.norm) && !NOT_PLURAL_S.has(prevTok.norm)) ||
        (/^[A-Z]/.test(prevTok.w) && !prevTok.boundary && prevTok.norm !== 'i'));
      // ", like they do today": "like" = "as", before a subject.
      const asConj = t.commaBefore && LIKE_SUBJ_NEXT.has(w2) && k + 2 < n && !tokens[k + 1].boundary && !tokens[k + 2].boundary;
      // "What's the weather like where you are?": a real "like" after "what's/what is".
      let whatLike = false;
      for (let j = k - 1; j >= Math.max(0, k - 5) && !whatLike; j--) {
        if (at(j) === "what's" || (at(j) === 'what' && /^(is|was|are|were)$/.test(at(j + 1)))) whatLike = true;
        if (tokens[j].boundary) break;
      }
      if (asConj || whatLike) continue;
      const isFiller = t.boundary || commaAfter ||
        (!nounBefore && !LIKE_KEEP_PREV.has(at(k - 1)) && !LIKE_KEEP_NEXT.has(w2) && !nextCommaOrEnd);
      if (isFiller) { addFiller('like', k); continue; }
    }
  }

  // Be-drops.
  const isIngVerb = (w) => w.length >= 5 && w.endsWith('ing') && !ING_NOT_VERB.has(w);
  const isEdVerb = (w) => w.length >= 5 && w.endsWith('ed') && !/eed$/.test(w);

  for (let k = 0; k < n; k++) {
    const s = at(k);
    let isSubj = false;
    if (SUBJ_ALWAYS.has(s)) isSubj = !AUX_BEFORE_SUBJ.has(at(k - 1)) || tokens[k].boundary;
    else if (SUBJ_LIMITED.has(s)) isSubj = subjStart(k);
    else if (SUBJ_REL.has(s)) isSubj = !THAT_CLAUSE_VERBS.has(at(k - 1)) && !tokens[k].boundary && k > 0;
    else if (s === 'them') isSubj = at(k - 1) === 'of' && QUANTIFIERS.has(at(k - 2));
    if (!isSubj) continue;

    // Allow one adverb between subject and verb: "we still using".
    let v = k + 1;
    if (v < n && !tokens[v].boundary && MIDDLE_ADVERBS.has(at(v)) && v + 1 < n && !tokens[v + 1].boundary) v += 1;
    if (v >= n || tokens[v].boundary) continue;
    const verb = at(v);
    const span = tokens.slice(k, v + 1).map((x) => x.w).join(' ');
    const aux = BE_FOR[s] || 'is';
    const push = (kind, fix) => drops.push({ kind, from: k, to: v, text: span, index: k, fix });

    if (verb === 'gonna') { push('gonna', `${tokens[k].w} ${aux} gonna`); continue; }

    if (isIngVerb(verb)) {
      // Gerund subject ("that using X is easy"): a finite verb follows in the same clause.
      if (SUBJ_REL.has(s) || SUBJ_LIMITED.has(s)) {
        let gerund = false;
        for (let j = v + 1; j < Math.min(n, v + 7); j++) {
          if (tokens[j].boundary || SCAN_STOP.has(at(j))) break;
          if (FINITE_AFTER_GERUND.has(at(j))) { gerund = true; break; }
        }
        if (gerund) continue;
      }
      push('be', `${tokens[k].w} ${aux} ${tokens[v].w}`);
      continue;
    }

    // "a brain that connected" -> "that is connected" (relative + participle + to/with/by/end).
    if ((s === 'that' || s === 'which') && v === k + 1 && isEdVerb(verb) && verb !== 'used') {
      const nx = v + 1 < n ? tokens[v + 1] : null;
      if (!nx || nx.boundary || PASSIVE_NEXT.has(nx.norm)) { push('passive', `${tokens[k].w} is ${tokens[v].w}`); continue; }
    }

    // "it make" -> "it makes" (light).
    if ((s === 'he' || s === 'she' || s === 'it') && v === k + 1 && BASE_VERBS.has(verb)) {
      const fixed = verb === 'have' ? 'has' : verb === 'do' ? 'does' : verb === 'go' ? 'goes' :
        /(s|sh|ch|x)$/.test(verb) ? verb + 'es' : /[^aeiou]y$/.test(verb) ? verb.slice(0, -1) + 'ies' : verb + 's';
      push('s', `${tokens[k].w} ${fixed}`);
    }
  }

  // "he" used for a model or system: nearest marker word within 8 tokens before decides.
  for (let k = 0; k < n; k++) {
    if (!HE_WORDS.has(at(k))) continue;
    for (let j = k - 1; j >= Math.max(0, k - 8); j--) {
      const b = at(j);
      if (HUMAN_WORDS.has(b) || HE_WORDS.has(b)) break;
      if (TECH_WORDS.has(b)) { he.push(k); break; }
    }
  }

  return { fillers, drops, he };
}

// ---------------------------------------------------------------------------
// Normalization for target and must comparison

const PRON_IS = set("it's he's she's that's what's there's here's who's where's how's");
const UNITS = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9,
  ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16,
  seventeen: 17, eighteen: 18, nineteen: 19,
};
const TENS = { twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90 };
const SCALES = { thousand: 1e3, million: 1e6, billion: 1e9 };
// Ordinal words from "third" up. "first" and "second" only count inside a run ("twenty-first"),
// because alone they are usually plain words ("first", "one second").
const ORDINALS = {
  third: 3, fourth: 4, fifth: 5, sixth: 6, seventh: 7, eighth: 8, ninth: 9, tenth: 10, eleventh: 11,
  twelfth: 12, thirteenth: 13, fourteenth: 14, fifteenth: 15, sixteenth: 16, seventeenth: 17,
  eighteenth: 18, nineteenth: 19, twentieth: 20, thirtieth: 30,
};
const ORD_IN_RUN = { first: 1, second: 2, ...ORDINALS };
const ORD_SUFFIX = set('st nd rd th');
const DIGITS_RE = /^[0-9]+(?:\.[0-9]+)?$/;
const DROP_FROM_SPOKEN = /^(u+m+|h+m+|m{2,}|u+h+|a+h+|e+r+m*)$/;

function ordSuffix(n) {
  const t = n % 100;
  if (t >= 11 && t <= 13) return 'th';
  return ['th', 'st', 'nd', 'rd'][n % 10] || 'th';
}

function expandWord(norm) {
  let w = norm.replace(/’/g, "'");
  if (w.endsWith('%')) return [...expandWord(w.slice(0, -1)), 'percent'];
  w = w.replace(/,/g, '');
  if (w === 'dollar') return ['dollars'];
  if (w === 'gonna') return ['going', 'to'];
  if (w === 'wanna') return ['want', 'to'];
  if (w === 'gotta') return ['got', 'to'];
  if (w === 'okay' || w === 'ok') return ['okay'];
  if (w === 'cannot' || w === "can't") return ['can', 'not'];
  if (w === "won't") return ['will', 'not'];
  if (w === "i'm") return ['i', 'am'];
  if (w === "let's") return ['let', 'us'];
  if (PRON_IS.has(w)) return [w.slice(0, -2), 'is'];
  let m;
  if ((m = w.match(/^(.+)n't$/))) return [m[1], 'not'];
  if ((m = w.match(/^(.+)'re$/))) return [m[1], 'are'];
  if ((m = w.match(/^(.+)'ve$/))) return [m[1], 'have'];
  if ((m = w.match(/^(.+)'ll$/))) return [m[1], 'will'];
  if ((m = w.match(/^(.+)'d$/))) return [m[1], 'would'];
  return [w];
}

// Parse one number run that starts at words[i]. Returns { text, end, value, simple } or null.
// Handles "twenty one" -> 21, "three thousand" -> 3000, "a hundred" -> 100, "3 thousand" -> 3000,
// "1.5 million" -> 1500000, "three point five" -> 3.5, "twenty third" -> 23rd, "3 rd" -> 3rd.
function parseNumber(words, i) {
  const n = words.length;
  const w0 = words[i];
  // Digits, maybe followed by a scale word or an ordinal suffix.
  if (DIGITS_RE.test(w0)) {
    let v = parseFloat(w0), j = i + 1, scaled = false;
    while (j < n && SCALES[words[j]]) { v *= SCALES[words[j]]; j++; scaled = true; }
    if (!scaled && j < n && words[j] === 'hundred') { v *= 100; j++; scaled = true; }
    if (scaled) return { text: String(Math.round(v * 1000) / 1000), end: j, value: v, simple: false };
    if (/^[0-9]+$/.test(w0) && j < n && ORD_SUFFIX.has(words[j])) return { text: w0 + words[j], end: j + 1, value: v, simple: false };
    return null;
  }
  let j = i;
  if (w0 === 'a' && (words[i + 1] === 'hundred' || SCALES[words[i + 1]])) j = i; // "a thousand"
  else if (!(w0 in UNITS) && !(w0 in TENS) && !(w0 in ORDINALS)) return null;
  let total = 0, cur = 0, last = null, any = false, ordinal = false, firstKind = null;
  while (j < n) {
    const w = words[j];
    if (w === 'a' && j === i) { cur = 1; last = 'unit'; any = true; j++; continue; }
    if (w in UNITS) {
      const v = UNITS[w];
      if (last === 'unit' || last === 'teen' || (last === 'tens' && v >= 10)) break;
      cur += v; last = v >= 10 ? 'teen' : 'unit';
    } else if (w in TENS) {
      if (last === 'unit' || last === 'teen' || last === 'tens') break;
      cur += TENS[w]; last = 'tens';
    } else if (w === 'hundred') {
      if (last === 'hundred' || last === null) break;
      cur = (cur || 1) * 100; last = 'hundred';
    } else if (w in SCALES) {
      if (last === null || last === 'scale') break;
      total += (cur || 1) * SCALES[w]; cur = 0; last = 'scale';
    } else if (w === 'and' && (last === 'hundred' || last === 'scale') && j + 1 < n &&
      (words[j + 1] in UNITS || words[j + 1] in TENS)) {
      j++; continue;
    } else if ((last === 'tens' || last === 'hundred' || last === 'scale') && w in ORD_IN_RUN) {
      cur += ORD_IN_RUN[w]; ordinal = true; j++; any = true; break;
    } else if (last === null && w in ORDINALS) {
      cur += ORDINALS[w]; ordinal = true; j++; any = true; break;
    } else break;
    if (!firstKind) firstKind = last;
    any = true; j++;
  }
  if (!any) return null;
  let value = total + cur;
  if (ordinal) return { text: value + ordSuffix(value), end: j, value, simple: false };
  // "three point five" -> 3.5
  if (words[j] === 'point' && j + 1 < n && words[j + 1] in UNITS && UNITS[words[j + 1]] < 10) {
    let dec = '';
    let k = j + 1;
    while (k < n && words[k] in UNITS && UNITS[words[k]] < 10) { dec += UNITS[words[k]]; k++; }
    return { text: `${value}.${dec}`, end: k, value: parseFloat(`${value}.${dec}`), simple: false };
  }
  const simple = total === 0 && value < 100 && (firstKind === 'tens' || firstKind === 'teen');
  return { text: String(value), end: j, value, simple };
}

// Turn number-word runs into digit strings, in place of the words. orig is merged the same way.
function mergeNumbers(words, orig) {
  const ow = [], oo = [];
  const joinOrig = (from, to) => {
    let s = '';
    for (let k = from; k < to; k++) {
      const o = orig[k];
      if (!o) continue;
      s = !s ? o : /-$/.test(s) ? s + o : `${s} ${o}`;
    }
    return s;
  };
  let i = 0;
  while (i < words.length) {
    const r = parseNumber(words, i);
    if (!r) { ow.push(words[i]); oo.push(orig[i]); i++; continue; }
    let { text, end } = r;
    // Years said in two parts: "twenty twenty-six" -> 2026, "nineteen ninety" -> 1990.
    if (r.simple && (r.value === 19 || r.value === 20)) {
      const r2 = parseNumber(words, end);
      if (r2 && r2.simple && r2.value >= 10) { text = `${r.value}${r2.value}`; end = r2.end; }
    }
    ow.push(text); oo.push(joinOrig(i, end));
    i = end;
  }
  return { words: ow, orig: oo };
}

// Text -> normalized words plus the original text of each word (casing and trailing
// punctuation kept) for display. When one token expands to several words ("gonna"),
// the first word carries the whole original and the rest carry ''. A "$" before a number
// adds the word "dollars" after it, so "$3,000" matches "three thousand dollars".
function normWordsOrig(text, { dropHesitations = false } = {}) {
  const src = String(text ?? '');
  const toks = tokenize(src);
  const words = [], orig = [];
  let dollar = false;
  toks.forEach((t, k) => {
    if (dropHesitations && DROP_FROM_SPOKEN.test(t.norm)) return;
    const next = k + 1 < toks.length ? toks[k + 1].start : src.length;
    let raw = src.slice(t.start, next).replace(/\s.*$/s, '');
    if (k === 0) raw = src.slice(0, t.start).trim() + raw;
    if (t.start > 0 && src[t.start - 1] === '$' && /^[0-9]/.test(t.norm)) dollar = true;
    expandWord(t.norm).forEach((w, j) => { words.push(w); orig.push(j ? '' : raw); });
    const nx = k + 1 < toks.length ? toks[k + 1].norm : '';
    if (dollar && !SCALES[nx] && nx !== 'hundred' && nx !== 'dollars' && nx !== 'dollar') {
      words.push('dollars'); orig.push(''); dollar = false;
    }
  });
  return mergeNumbers(words, orig);
}

function normWords(text, opts) {
  return normWordsOrig(text, opts).words;
}

function containsSeq(hay, needle) {
  if (!needle.length) return false;
  outer: for (let i = 0; i + needle.length <= hay.length; i++) {
    for (let j = 0; j < needle.length; j++) if (hay[i + j] !== needle[j]) continue outer;
    return true;
  }
  return false;
}

function countSeq(hay, needle) {
  let c = 0;
  if (!needle.length) return 0;
  outer: for (let i = 0; i + needle.length <= hay.length; i++) {
    for (let j = 0; j < needle.length; j++) if (hay[i + j] !== needle[j]) continue outer;
    c++;
  }
  return c;
}

// LCS alignment of target words (a) and spoken words (b) -> diff in reading order.
// ao / bo (optional): original display text per word, copied to `orig` on each entry.
function alignDiff(a, b, ao = null, bo = null) {
  const n = a.length, m = b.length;
  const dp = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const diff = [];
  let i = 0, j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) { diff.push(ent(a[i], 'ok', ao && ao[i])); i++; j++; }
    else if (dp[i + 1][j] >= dp[i][j + 1]) { diff.push(ent(a[i], 'miss', ao && ao[i])); i++; }
    else { diff.push(ent(b[j], 'extra', bo && bo[j])); j++; }
  }
  while (i < n) { diff.push(ent(a[i], 'miss', ao && ao[i])); i++; }
  while (j < m) { diff.push(ent(b[j], 'extra', bo && bo[j])); j++; }
  return { diff, ok: dp[0][0] };
}

function ent(w, status, orig) {
  return orig == null ? { w, status } : { w, status, orig };
}

// ---------------------------------------------------------------------------
// analyze

const ALL_FILLER_WORDS = set("so basically whatever like um uh erm let's say again actually you know kind sort of");
// One-word fillers only. Used to ignore filler extras in precision and length; "you", "of" and
// "know" are real words when they are not part of "you know" or "kind of".
const SOLO_FILLERS = set('so basically whatever like um uh erm again actually');
const clamp01 = (x) => Math.max(0, Math.min(1, x));

/*
 * Score formula (0..100):
 *   Components, each 0..1:
 *     target   = targetScore                       (only when a target sentence is given)
 *     must     = mustHit / must.length              (only when must phrases are given)
 *     fluency  = 1 - fillersPerMin / 4             (0/min = 1, 4+/min = 0; "again" counts 0.5;
 *                fillers that are also in the target do not count; under 8 words the rate is per answer)
 *     grammar  = 1 - 0.34 * weightedBeDrops        (be/gonna = 1, passive = 0.6, missing -s = 0.5; 3 drops = 0)
 *     pace     = 1 inside 110..160 wpm, linear to 0 at 60 and 220
 *                (only when durationSec >= 5 and at least 5 words)
 *     reference = key words of the reference answer that were said / 75 % of the key words
 *                (only when opts.reference is given; 5 to 8 content words, stopwords dropped)
 *   Weights: target 0.45, reference 0.35, must 0.25, fluency 0.15, grammar 0.10, pace 0.05.
 *   Missing components are dropped and the remaining weights are rescaled to sum 1.
 *   Then, when opts.minWords is given and the answer is shorter, the score is multiplied by
 *   lengthFactor = effectiveWords / minWords (fillers do not count, must-phrase words count half,
 *   so an answer made only of the must phrases stays low).
 *   Then minus 10 points per banned word or phrase hit (max 30). Empty transcript = 0.
 *   Then, when opts.avoid is given (the wrong sentence of a fix drill) and the speech matches it
 *   better than the target, the score is capped at 30.
 *
 * targetScore = 0.85 * recall + 0.15 * precision, on normalized words
 *   (contractions expanded, numbers as digits, um/uh removed, filler extras ignored for precision).
 */
export function analyze(transcript, durationSec, { target, must, banned, avoid, reference, minWords } = {}) {
  const text = String(transcript ?? '');
  const tokens = tokenize(text);
  const words = tokens.length;
  const dur = Number(durationSec) > 0 ? Number(durationSec) : 0;
  const wpm = dur > 0 ? Math.round(words / (dur / 60)) : 0;
  // Minutes for the filler rate: real duration, else estimate at 130 wpm. Floor 15 s.
  // A rate is not fair on a very short answer (one "so" in 2 s = 30/min), so under 8 words
  // fillers count per answer: the floor is 1 minute.
  const minutes = Math.max(dur > 0 ? dur / 60 : words / 130, words < 8 ? 1 : 0.25);

  const { fillers: allHits, drops, he } = scan(tokens);
  // Fillers that are part of the target text ("basically" inside a quote to recite) are not
  // the speaker's fillers: each one in the target forgives one of the same kind in the speech.
  const forgive = {};
  if (typeof target === 'string' && target.trim()) {
    for (const f of scan(tokenize(target)).fillers) forgive[f.key] = (forgive[f.key] || 0) + 1;
  }
  const fHits = allHits.filter((f) => {
    if (!forgive[f.key]) return true;
    forgive[f.key]--;
    return false;
  });
  const fillers = {};
  let weighted = 0;
  for (const f of fHits) {
    fillers[f.key] = (fillers[f.key] || 0) + 1;
    weighted += FILLER_WEIGHT[f.key] ?? 1;
  }
  const fillerTotal = fHits.length;
  const fillersPerMin = words ? Math.round((weighted / minutes) * 10) / 10 : 0;
  const beDrops = drops.map((d) => ({ text: d.text, index: d.index, kind: d.kind, fix: d.fix }));
  const heForIt = he.length;

  const spokenO = normWordsOrig(text, { dropHesitations: true });
  const spoken = spokenO.words;

  // must phrases
  const mustHit = [], mustMiss = [];
  for (const p of Array.isArray(must) ? must : []) {
    (containsSeq(spoken, normWords(p)) ? mustHit : mustMiss).push(p);
  }

  // banned
  const bannedHits = [];
  for (const p of Array.isArray(banned) ? banned : []) {
    const c = countSeq(spoken, normWords(p));
    if (c) bannedHits.push({ phrase: p, count: c });
  }

  // target
  let targetScore = null, diff = [];
  const hasTarget = typeof target === 'string' && target.trim();
  if (hasTarget) {
    const tO = normWordsOrig(target);
    const al = alignDiff(tO.words, spoken, tO.orig, spokenO.orig);
    diff = al.diff;
    targetScore = matchScore(tO.words.length, al.ok, spoken);
  }

  // avoid: the wrong sentence of a fix drill. Reading it unchanged must not pass.
  let avoidScore = null, saidAvoid = false;
  if (typeof avoid === 'string' && avoid.trim() && words) {
    const aw = normWords(avoid, { dropHesitations: true }).filter((w) => !PLACEHOLDER.test(w));
    if (aw.length) {
      avoidScore = matchScore(aw.length, alignDiff(aw, spoken).ok, spoken);
      saidAvoid = targetScore !== null ? avoidScore > targetScore : avoidScore >= 0.85;
    }
  }

  // reference: key content words of a model answer (Q&A). Coverage, not word order.
  let referenceScore = null;
  const keyHit = [], keyMiss = [];
  if (typeof reference === 'string' && reference.trim()) {
    const keys = keyWords(reference);
    if (keys.length) {
      const said = new Set(spoken.map(stem));
      for (const k of keys) (said.has(stem(k)) ? keyHit : keyMiss).push(k);
      referenceScore = Math.round((keyHit.length / keys.length) * 1000) / 1000;
    }
  }

  // length: effective words (no fillers, must-phrase words count half) vs minWords.
  let lengthFactor = null;
  const minW = Number(minWords) > 0 ? Number(minWords) : 0;
  if (minW) {
    const content = spoken.filter((w) => !SOLO_FILLERS.has(w)).length;
    let mustWords = 0;
    for (const p of mustHit) mustWords += normWords(p).length;
    const effective = Math.max(0, content - 0.5 * Math.min(mustWords, content));
    lengthFactor = Math.round(clamp01(effective / minW) * 1000) / 1000;
  }

  // score
  const parts = [];
  if (targetScore !== null) parts.push([0.45, targetScore]);
  if (referenceScore !== null) parts.push([0.35, clamp01(referenceScore / 0.75)]);
  if (Array.isArray(must) && must.length) parts.push([0.25, mustHit.length / must.length]);
  parts.push([0.15, clamp01(1 - fillersPerMin / 4)]);
  const dropLoad = drops.reduce((s, d) => s + (DROP_WEIGHT[d.kind] ?? 1), 0);
  parts.push([0.1, clamp01(1 - 0.34 * dropLoad)]);
  if (dur >= 5 && words >= 5) {
    const pace = wpm < 110 ? clamp01((wpm - 60) / 50) : wpm > 160 ? clamp01((220 - wpm) / 60) : 1;
    parts.push([0.05, pace]);
  }
  const wsum = parts.reduce((s, p) => s + p[0], 0);
  let score = words ? (parts.reduce((s, p) => s + p[0] * p[1], 0) / wsum) * 100 : 0;
  if (lengthFactor !== null) score *= lengthFactor;
  const bannedCount = bannedHits.reduce((s, b) => s + b.count, 0);
  score -= Math.min(30, bannedCount * 10);
  if (saidAvoid) score = Math.min(score, AVOID_CAP);
  score = Math.round(Math.max(0, Math.min(100, score)));

  const tips_he = buildTips({ words, fillers, drops, heForIt, mustMiss, targetScore, diff, wpm, dur, bannedHits,
    saidAvoid, lengthFactor, referenceScore, keyMiss });

  return {
    words, wpm, fillers, fillerTotal, fillersPerMin, beDrops, heForIt,
    mustHit, mustMiss, targetScore, diff, score, tips_he,
    banned: bannedHits,
    avoidScore, saidAvoid, referenceScore, keyHit, keyMiss, lengthFactor,
  };
}

/*
 * Must / banned words for a fix drill (right vs wrong sentence). Built on the same normalized
 * words analyze() uses (contractions expanded, numbers as digits), then checked with analyze()
 * itself: a must word is kept only when the right sentence hits it, a banned word only when the
 * right sentence does not. So saying the right sentence can never lose points to these lists.
 */
export function fixWordSets(right, wrong) {
  const r = String(right || ''), w = String(wrong || '');
  const rightW = normWords(r, { dropHesitations: true }).filter((x) => !PLACEHOLDER.test(x));
  const wrongW = normWords(w, { dropHesitations: true }).filter((x) => !PLACEHOLDER.test(x));
  const must = [...new Set(rightW.filter((x) => !wrongW.includes(x)))]
    .filter((x) => analyze(r, 3, { must: [x] }).mustHit.length === 1);
  const banned = [...new Set(wrongW.filter((x) => !rightW.includes(x)))]
    .filter((x) => analyze(r, 3, { banned: [x] }).banned.length === 0);
  return { must, banned };
}

const AVOID_CAP = 30;
const PLACEHOLDER = /^[xyzn]$/;

// 0.85 * recall + 0.15 * precision. Filler extras do not count against precision.
function matchScore(targetLen, ok, spoken) {
  const recall = targetLen ? ok / targetLen : 0;
  const spokenContent = spoken.filter((w) => !SOLO_FILLERS.has(w)).length;
  const precision = spokenContent ? Math.min(1, ok / spokenContent) : 0;
  return Math.round((0.85 * recall + 0.15 * precision) * 1000) / 1000;
}

const STOPWORDS = set(`a an the and or but if then so than that this these those there here it its is are was were be been
  being am do does did done have has had having will would can could should may might must shall not no yes
  i me my mine we us our ours you your yours he him his she her they them their what which who whom whose
  when where why how all any both each few more most other some such only own same too very just also
  of to in on at by for with from up down out over under about into through after before again once
  as because while until during off per get got go going went make made say said know think like want
  one thing things way lot really well okay now today still even much many every first`);

// Crude stem so "retries" matches "retry", "failed" matches "fail".
function stem(w) {
  if (/^[0-9]/.test(w)) return w;
  return w.replace(/'s$/, '').replace(/(ies)$/, 'y').replace(/(ing|ed|es|s)$/, '') || w;
}

// 5 to 8 key content words of a reference answer, in reading order.
// Longer words and numbers are preferred when there are more than 8.
function keyWords(text) {
  const seen = new Set();
  const cand = [];
  normWords(text).forEach((w, pos) => {
    if (STOPWORDS.has(w) || ALL_FILLER_WORDS.has(w) || PLACEHOLDER.test(w)) return;
    if (!/^[0-9]/.test(w) && w.length < 3) return;
    const s = stem(w);
    if (seen.has(s)) return;
    seen.add(s);
    cand.push({ w, pos, rank: /^[0-9]/.test(w) ? 20 : w.length });
  });
  if (cand.length <= 8) return cand.map((c) => c.w);
  return cand.slice().sort((a, b) => b.rank - a.rank || a.pos - b.pos).slice(0, 8)
    .sort((a, b) => a.pos - b.pos).map((c) => c.w);
}

function buildTips({ words, fillers, drops, heForIt, mustMiss, targetScore, diff, wpm, dur, bannedHits,
  saidAvoid = false, lengthFactor = null, referenceScore = null, keyMiss = [] }) {
  const tips = [];
  if (!words) return ['לא שמעתי מילים. נסה שוב, קרוב יותר למיקרופון.'];
  if (saidAvoid) tips.push('זה המשפט עם הטעות. נסה את הגרסה המתוקנת.');
  if (lengthFactor !== null && lengthFactor < 1) tips.push('התשובה קצרה מדי. הוסף עוד משפט או שניים.');

  if (drops.length) {
    const d = drops.find((x) => x.kind !== 's') || drops[0];
    if (d.kind === 's') tips.push(`אחרי he, she או it מוסיפים s לפועל: "${d.text}" -> "${d.fix}".`);
    else tips.push(`חסר is או are: "${d.text}" -> "${d.fix}".`);
  }

  const top = Object.entries(fillers).sort((a, b) => b[1] - a[1])[0];
  if (top && top[1] >= 2) {
    tips.push(`מילת מילוי "${top[0]}" חזרה ${top[1]} פעמים. במקומה: עצירה קצרה ונשימה.`);
  } else if (top && top[0] !== 'again' && tips.length < 2) {
    tips.push(`שים לב ל-"${top[0]}". הפסקה קצרה עדיפה על מילת מילוי.`);
  }

  if (heForIt) tips.push('על מודל, סוכן או מערכת אומרים it, לא he או him.');
  if (mustMiss.length) tips.push(`חסר בתשובה: ${mustMiss.slice(0, 2).map((p) => `"${p}"`).join(', ')}.`);
  if (targetScore !== null && targetScore < 0.8) {
    const missed = diff.filter((d) => d.status === 'miss').slice(0, 3).map((d) => d.w);
    if (missed.length) tips.push(`חסרו מילים מהמשפט: ${missed.join(', ')}.`);
  }
  if (bannedHits.length) tips.push(`נסה בלי "${bannedHits[0].phrase}".`);
  if (referenceScore !== null && referenceScore < 0.5 && keyMiss.length) {
    tips.push(`אפשר להוסיף גם: ${keyMiss.slice(0, 3).join(', ')}.`);
  }
  if (dur >= 10 && words >= 5) {
    if (wpm > 160) tips.push(`דיברת מהר (${wpm} מילים לדקה). כוון לבערך 130.`);
    else if (wpm < 110) tips.push(`הקצב איטי (${wpm} מילים לדקה). נסה לחבר משפטים ברצף.`);
  }
  if (!tips.length) tips.push('יפה מאוד. שמור על הקצב והבהירות.');
  return tips.slice(0, 3);
}

// ---------------------------------------------------------------------------
// highlight

/** Split the transcript into segments. Concatenating all `text` values gives back the input.
 *  Spaces and punctuation are 'word' segments. Multi-word hits are one segment. */
export function highlight(transcript) {
  const text = String(transcript ?? '');
  const tokens = tokenize(text);
  const { fillers, drops, he } = scan(tokens);
  // Spans in token indexes. Priority: bedrop > he > filler.
  const kindAt = new Array(tokens.length).fill(null);
  const spanEnd = new Array(tokens.length).fill(-1);
  const mark = (from, to, kind) => {
    for (let k = from; k <= to; k++) if (kindAt[k]) return;
    for (let k = from; k <= to; k++) kindAt[k] = kind;
    spanEnd[from] = to;
  };
  for (const d of drops) mark(d.from, d.to, 'bedrop');
  for (const k of he) mark(k, k, 'he');
  for (const f of fillers) mark(f.from, f.to, 'filler');

  const out = [];
  const push = (t, kind) => {
    if (!t) return;
    const last = out[out.length - 1];
    if (last && last.kind === 'word' && kind === 'word') last.text += t;
    else out.push({ text: t, kind });
  };
  let pos = 0;
  for (let k = 0; k < tokens.length; k++) {
    const t = tokens[k];
    push(text.slice(pos, t.start), 'word');
    if (kindAt[k] && spanEnd[k] >= k) {
      const endTok = tokens[spanEnd[k]];
      push(text.slice(t.start, endTok.end), kindAt[k]);
      pos = endTok.end;
      k = spanEnd[k];
    } else {
      push(t.w, 'word');
      pos = t.end;
    }
  }
  push(text.slice(pos), 'word');
  return out;
}
