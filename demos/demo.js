// Theme toggle for the demo pages, matching the home page's (main.js): the same
// circular reveal from the button, and the same remembered choice
// (localStorage "pf-theme"), so switching here switches the portfolio too.
// The choice itself is applied before first paint by the inline script in <head>.

(function () {
  var html = document.documentElement;
  var toggle = document.querySelector('.toggle');
  if (!toggle) return;

  var sun = toggle.querySelector('[data-icon="sun"]');
  var moon = toggle.querySelector('[data-icon="moon"]');
  var mark = document.querySelector('linearGradient[id^="mark-"]');
  var strokes = document.querySelectorAll('[stroke^="url(#mark-"]');
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  function current() { return html.getAttribute('data-theme') === 'light' ? 'light' : 'dark'; }

  function sync(theme) {
    toggle.setAttribute('aria-label', theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme');
    toggle.setAttribute('aria-pressed', String(theme === 'light'));
    sun.hidden = theme !== 'dark';
    moon.hidden = theme !== 'light';
    // Renaming the logo's gradient makes the browser re-read its stops in the new colours.
    if (mark) {
      mark.id = 'mark-' + theme;
      for (var i = 0; i < strokes.length; i++) strokes[i].setAttribute('stroke', 'url(#mark-' + theme + ')');
    }
  }

  sync(current());

  toggle.addEventListener('click', function () {
    var next = current() === 'dark' ? 'light' : 'dark';
    var r = toggle.getBoundingClientRect();
    html.style.setProperty('--vt-x', r.left + r.width / 2 + 'px');
    html.style.setProperty('--vt-y', r.top + r.height / 2 + 'px');
    var swap = function () {
      if (next === 'light') html.setAttribute('data-theme', 'light');
      else html.removeAttribute('data-theme');
      sync(next);
      try { localStorage.setItem('pf-theme', next); } catch (e) { /* not remembered */ }
    };
    if (document.startViewTransition && !reduce) document.startViewTransition(swap);
    else swap();
  });
})();
