// Apply the saved theme before first paint (no flash). Classic script, loaded in <head>.
// Kept out of index.html so the Content-Security-Policy can forbid inline scripts.
try {
  var s = JSON.parse(localStorage.getItem('speakerTrainer.v1') || '{}');
  var t = s && s.settings && s.settings.theme;
  if (t === 'light' || t === 'dark') document.documentElement.setAttribute('data-theme', t);
} catch (e) { /* storage blocked: system theme */ }
