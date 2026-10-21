// Soft 3D-feel illustrations, pure inline SVG. Gradient ids are unique per call.
let n = 0;
const uid = () => `a${++n}`;

// Gold cup with a purple star (design: "Illustration Trophy").
export function artTrophy(size = 150) {
  const i = uid();
  return `<svg width="${size}" height="${size}" viewBox="0 0 220 220" aria-hidden="true" class="art">
  <defs>
    <linearGradient id="${i}c" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FFE08A"/><stop offset=".45" stop-color="#FFC233"/><stop offset="1" stop-color="#F59A00"/></linearGradient>
    <linearGradient id="${i}h" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFD15C"/><stop offset="1" stop-color="#F0A000"/></linearGradient>
    <radialGradient id="${i}s" cx="40%" cy="35%" r="70%"><stop offset="0" stop-color="#A47BFF"/><stop offset=".6" stop-color="#6C3BF5"/><stop offset="1" stop-color="#4A1FC4"/></radialGradient>
    <radialGradient id="${i}sh" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#B26A00" stop-opacity=".28"/><stop offset="1" stop-color="#B26A00" stop-opacity="0"/></radialGradient>
  </defs>
  <ellipse cx="110" cy="204" rx="58" ry="9" fill="url(#${i}sh)"/>
  <path d="M58 62c-30 0-40 18-36 34 5 20 26 30 48 32" fill="none" stroke="url(#${i}h)" stroke-width="13" stroke-linecap="round"/>
  <path d="M162 62c30 0 40 18 36 34-5 20-26 30-48 32" fill="none" stroke="url(#${i}h)" stroke-width="13" stroke-linecap="round"/>
  <path d="M50 40h120v38c0 40-27 68-60 68S50 118 50 78z" fill="url(#${i}c)"/>
  <ellipse cx="110" cy="40" rx="60" ry="10" fill="#FFE7A3"/>
  <ellipse cx="110" cy="41" rx="52" ry="6" fill="#F5A300" opacity=".55"/>
  <path d="M64 52c0 30 6 52 22 70" fill="none" stroke="#fff" stroke-width="8" stroke-linecap="round" opacity=".55"/>
  <path d="M110 64l9.4 19 21 3-15.2 14.8 3.6 20.9L110 112l-18.8 9.7 3.6-20.9L79.6 86l21-3z" fill="url(#${i}s)" stroke="#5A2BE0" stroke-width="2" stroke-linejoin="round"/>
  <path d="M102 80l5-9" stroke="#fff" stroke-width="4" stroke-linecap="round" opacity=".6"/>
  <path d="M98 144h24l4 18H94z" fill="url(#${i}h)"/>
  <rect x="88" y="158" width="44" height="10" rx="5" fill="#FFC233"/>
  <path d="M76 170h68a6 6 0 0 1 6 6v14H70v-14a6 6 0 0 1 6-6z" fill="url(#${i}c)"/>
  <rect x="70" y="186" width="80" height="10" rx="5" fill="#F0A000"/>
  <g class="art-float"><path d="M30 120l3 8 8 3-8 3-3 8-3-8-8-3 8-3z" fill="#C9B6FF"/></g>
  <g class="art-float d2"><path d="M190 22l2.5 6.5 6.5 2.5-6.5 2.5-2.5 6.5-2.5-6.5-6.5-2.5 6.5-2.5z" fill="#C9B6FF"/></g>
</svg>`;
}

// Speaker at a podium with a mic (design: "Illustration Speaker").
export function artSpeaker(size = 300) {
  const i = uid();
  return `<svg width="${size}" height="${size}" viewBox="0 0 320 320" aria-hidden="true" class="art">
  <defs>
    <linearGradient id="${i}hood" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8A63FF"/><stop offset="1" stop-color="#5A2BE0"/></linearGradient>
    <linearGradient id="${i}pod" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#B9A4FF"/><stop offset=".25" stop-color="#E4DAFF"/><stop offset="1" stop-color="#D4C6FF"/></linearGradient>
    <linearGradient id="${i}top" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#F1ECFF"/><stop offset="1" stop-color="#CDBEFF"/></linearGradient>
    <linearGradient id="${i}bub" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#F1ECFF"/><stop offset="1" stop-color="#D9CCFF"/></linearGradient>
    <radialGradient id="${i}coin" cx="40%" cy="35%" r="70%"><stop offset="0" stop-color="#FFE08A"/><stop offset="1" stop-color="#F59A00"/></radialGradient>
    <radialGradient id="${i}skin" cx="45%" cy="40%" r="65%"><stop offset="0" stop-color="#FFE1C7"/><stop offset="1" stop-color="#F2B48C"/></radialGradient>
    <linearGradient id="${i}lap" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#8A63FF"/><stop offset="1" stop-color="#4A1FC4"/></linearGradient>
  </defs>
  <!-- speech bubble -->
  <g class="art-float">
    <rect x="128" y="10" width="108" height="64" rx="30" fill="url(#${i}bub)" stroke="#E4DAFF"/>
    <path d="M150 70l-8 22 26-20z" fill="#DCD0FF"/>
    <rect x="150" y="26" width="66" height="7" rx="3.5" fill="#6C3BF5"/>
    <rect x="150" y="40" width="58" height="7" rx="3.5" fill="#7B4DFF"/>
    <rect x="150" y="54" width="48" height="7" rx="3.5" fill="#8A63FF"/>
  </g>
  <!-- coin -->
  <g class="art-float d2"><circle cx="262" cy="98" r="22" fill="url(#${i}coin)"/><circle cx="262" cy="98" r="16" fill="none" stroke="#FFE7A3" stroke-width="2"/>
    <path d="M262 86l3.6 7.4 8.1 1.2-5.9 5.7 1.4 8-7.2-3.8-7.2 3.8 1.4-8-5.9-5.7 8.1-1.2z" fill="#FFD15C" stroke="#E08A00" stroke-width="1.2"/></g>
  <path d="M248 140l3 8 8 3-8 3-3 8-3-8-8-3 8-3z" fill="#C9B6FF"/>
  <path d="M92 58l4 11 11 4-11 4-4 11-4-11-11-4 11-4z" fill="#C9B6FF"/>
  <!-- body -->
  <path d="M84 196c0-38 26-62 64-62h20c38 0 62 24 62 62v34H84z" fill="url(#${i}hood)"/>
  <path d="M134 136h42l-6 94h-30z" fill="#fff"/>
  <path d="M142 136h26l-4 94h-18z" fill="#2A1F55"/>
  <path d="M138 150v40M172 150v40" stroke="#E4DAFF" stroke-width="5" stroke-linecap="round"/>
  <!-- left arm (open hand) -->
  <path d="M96 170c-14 10-22 26-24 40" fill="none" stroke="url(#${i}hood)" stroke-width="26" stroke-linecap="round"/>
  <path d="M60 200c-6-10-2-22 4-18l2 6c2-10 8-12 10-6 4-6 10-2 8 4 6 0 6 8 2 12l-8 10c-6 6-14 2-18-8z" fill="url(#${i}skin)"/>
  <!-- head -->
  <rect x="146" y="120" width="20" height="18" rx="6" fill="#F2B48C"/>
  <circle cx="156" cy="96" r="32" fill="url(#${i}skin)"/>
  <circle cx="125" cy="100" r="8" fill="#F2B48C"/>
  <path d="M124 92c-6-26 14-42 34-40 12-8 30-2 32 12 10 4 10 18 4 24-4-8-10-12-18-12-8 6-22 6-30 2-6 4-10 10-10 16z" fill="#1B1530"/>
  <circle cx="148" cy="98" r="3.6" fill="#1B1530"/><circle cx="170" cy="98" r="3.6" fill="#1B1530"/>
  <circle cx="149" cy="96.8" r="1.1" fill="#fff"/><circle cx="171" cy="96.8" r="1.1" fill="#fff"/>
  <path d="M150 110c6 6 14 6 18 0" fill="#C2410C" stroke="#1B1530" stroke-width="2" stroke-linecap="round"/>
  <circle cx="140" cy="108" r="5" fill="#FF9AA2" opacity=".45"/><circle cx="178" cy="108" r="5" fill="#FF9AA2" opacity=".45"/>
  <!-- right arm holding mic -->
  <path d="M214 176c6-14 4-26-6-34" fill="none" stroke="url(#${i}hood)" stroke-width="24" stroke-linecap="round"/>
  <circle cx="206" cy="138" r="13" fill="url(#${i}skin)"/>
  <path d="M200 132l-14-22" stroke="#1B1530" stroke-width="7" stroke-linecap="round"/>
  <circle cx="184" cy="106" r="10" fill="#2A1F55"/><circle cx="181" cy="103" r="3" fill="#fff" opacity=".35"/>
  <path d="M200 92a20 20 0 0 1 8 18M210 84a32 32 0 0 1 12 30M220 76a44 44 0 0 1 14 42" fill="none" stroke="#7B4DFF" stroke-width="5" stroke-linecap="round"/>
  <!-- podium -->
  <path d="M232 200l-28 10h-46l40-12z" fill="url(#${i}lap)" opacity=".9"/>
  <path d="M206 168l46-6-14 40-46 4z" fill="url(#${i}lap)"/>
  <circle cx="227" cy="184" r="4" fill="#E4DAFF"/>
  <rect x="88" y="204" width="168" height="26" rx="13" fill="url(#${i}top)"/>
  <path d="M100 230h144l-14 76H114z" fill="url(#${i}pod)"/>
  <path d="M100 230h24l4 76h-14z" fill="#A98DFF" opacity=".55"/>
  <rect x="104" y="298" width="136" height="16" rx="8" fill="#6C3BF5"/>
</svg>`;
}

// Winding road with flags: the daily mission map.
export function artMap(size = 150) {
  const i = uid();
  return `<svg width="${size}" height="${size}" viewBox="0 0 160 160" aria-hidden="true" class="art">
  <defs>
    <linearGradient id="${i}p" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#B79BFF"/><stop offset="1" stop-color="#5A2BE0"/></linearGradient>
    <linearGradient id="${i}f" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFD36E"/><stop offset="1" stop-color="#FF9F1A"/></linearGradient>
  </defs>
  <rect x="14" y="20" width="132" height="124" rx="30" fill="url(#${i}p)"/>
  <rect x="22" y="26" width="60" height="22" rx="11" fill="#fff" opacity=".18"/>
  <path d="M36 128c30 0 18-34 48-34s28-36 44-46" fill="none" stroke="#fff" stroke-width="10" stroke-linecap="round" stroke-dasharray="1 16"/>
  <circle cx="36" cy="128" r="9" fill="#fff"/><circle cx="84" cy="94" r="9" fill="#fff"/><circle cx="84" cy="94" r="4" fill="#7B4BFF"/>
  <path d="M126 22v30" stroke="#fff" stroke-width="4" stroke-linecap="round"/>
  <path d="M128 22h20l-6 7 6 7h-20z" fill="url(#${i}f)"/>
  <g class="art-float"><circle cx="40" cy="70" r="12" fill="#fff"/><path d="M35 70l3.5 3.5 6.5-7" fill="none" stroke="#22C55E" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></g>
</svg>`;
}

// Shield with lock: privacy.
export function artShield(size = 150) {
  const i = uid();
  return `<svg width="${size}" height="${size}" viewBox="0 0 160 160" aria-hidden="true" class="art">
  <defs>
    <linearGradient id="${i}s" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#9F7BFF"/><stop offset="1" stop-color="#4A1FC4"/></linearGradient>
    <linearGradient id="${i}l" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFE29A"/><stop offset="1" stop-color="#FFB020"/></linearGradient>
    <radialGradient id="${i}sh" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#2A1070" stop-opacity=".3"/><stop offset="1" stop-color="#2A1070" stop-opacity="0"/></radialGradient>
  </defs>
  <ellipse cx="80" cy="148" rx="40" ry="7" fill="url(#${i}sh)"/>
  <path d="M80 14l50 18v40c0 34-22 58-50 68-28-10-50-34-50-68V32z" fill="url(#${i}s)"/>
  <path d="M80 24v106c-20-8-40-28-40-58V39z" fill="#fff" opacity=".12"/>
  <rect x="58" y="72" width="44" height="36" rx="10" fill="url(#${i}l)"/>
  <path d="M66 72v-8a14 14 0 0 1 28 0v8" fill="none" stroke="#fff" stroke-width="7" stroke-linecap="round"/>
  <circle cx="80" cy="88" r="5" fill="#7A4A00"/><rect x="78" y="90" width="4" height="9" rx="2" fill="#7A4A00"/>
  <g class="art-float"><circle cx="132" cy="112" r="11" fill="#22C55E"/><path d="M127 112l3.5 3.5 6-6.5" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></g>
</svg>`;
}

// Small round 3D-ish medallion for a badge.
export function artBadge(iconSvg, locked = false) {
  const i = uid();
  const a = locked ? '#D8D3E8' : '#FFE29A';
  const b = locked ? '#A9A2C2' : '#FF9F1A';
  return `<span class="medal ${locked ? 'locked' : ''}"><svg viewBox="0 0 64 64" aria-hidden="true">
    <defs><linearGradient id="${i}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs>
    <circle cx="32" cy="32" r="28" fill="url(#${i})"/>
    <circle cx="32" cy="32" r="21" fill="#fff" opacity="${locked ? '.5' : '.9'}"/>
    <path d="M14 22a20 20 0 0 1 14-10" stroke="#fff" stroke-width="3" stroke-linecap="round" fill="none" opacity=".7"/>
  </svg><span class="medal-ico">${iconSvg}</span></span>`;
}
