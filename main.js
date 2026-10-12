// Behaviour of the home page, ported from the design's component logic
// (Main.dc.html) to plain JavaScript:
//
//   - the theme switch, with the circular reveal from the toggle;
//   - the hero parallax, four layers moving at different depths;
//   - scroll reveals. Where the browser supports scroll-driven animations the
//     CSS does all of it, scrubbed by scroll position (the `sd-on` class); a
//     two-way IntersectionObserver is the fallback (`rv-on`). Both classes are
//     chosen before first paint by the inline script at the top of the page.

(function () {
  var root = document.getElementById('pf');
  var html = document.documentElement;
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  // --- theme ------------------------------------------------------------------

  var toggle = root.querySelector('.toggle');
  var sun = toggle.querySelector('[data-icon="sun"]');
  var moon = toggle.querySelector('[data-icon="moon"]');
  var mark = root.querySelector('linearGradient[id^="pf-mark-"]');
  var markStrokes = root.querySelectorAll('[stroke^="url(#pf-mark-"]');
  var theme = root.classList.contains('theme-light') ? 'light' : 'dark';

  function applyTheme(next) {
    theme = next;
    root.classList.toggle('theme-dark', next === 'dark');
    root.classList.toggle('theme-light', next === 'light');
    html.classList.toggle('pf-light', next === 'light');
    toggle.setAttribute('aria-label', next === 'dark' ? 'Switch to light theme' : 'Switch to dark theme');
    toggle.setAttribute('aria-pressed', String(next === 'light'));
    sun.hidden = next !== 'dark';
    moon.hidden = next !== 'light';
    // The design names the logo gradient per theme, so its stops are re-read
    // with the new theme's colours.
    mark.id = 'pf-mark-' + next;
    for (var i = 0; i < markStrokes.length; i++) markStrokes[i].setAttribute('stroke', 'url(#pf-mark-' + next + ')');
  }

  applyTheme(theme);

  toggle.addEventListener('click', function () {
    var next = theme === 'dark' ? 'light' : 'dark';
    var r = toggle.getBoundingClientRect();
    html.style.setProperty('--vt-x', r.left + r.width / 2 + 'px');
    html.style.setProperty('--vt-y', r.top + r.height / 2 + 'px');
    var swap = function () {
      applyTheme(next);
      try { localStorage.setItem('pf-theme', next); } catch (e) { /* not remembered */ }
    };
    if (document.startViewTransition && !reduce) document.startViewTransition(swap);
    else swap();
  });

  // --- hero parallax --------------------------------------------------------------

  var hero = document.getElementById('top');
  var layer = function (name) { return root.querySelector('[data-layer="' + name + '"]'); };
  var tilt = layer('tilt');
  var glow = layer('glow');
  var near = layer('near');
  var text = layer('text');
  var mx = 0;
  var my = 0;
  var frame = 0;

  function clamp(v) { return Math.max(-1, Math.min(1, v)); }

  function place(x, y) {
    tilt.style.transform = 'rotateX(' + (-y * 7).toFixed(2) + 'deg) rotateY(' + (x * 10).toFixed(2) + 'deg)';
    glow.style.transform = 'translate3d(' + (x * -28).toFixed(1) + 'px,' + (y * -20).toFixed(1) + 'px,0)';
    near.style.transform = 'translate3d(' + (x * 34).toFixed(1) + 'px,' + (y * 26).toFixed(1) + 'px,0)';
    text.style.transform = 'translate3d(' + (x * -8).toFixed(1) + 'px,' + (y * -5).toFixed(1) + 'px,0)';
  }

  hero.addEventListener('mousemove', function (e) {
    var r = hero.getBoundingClientRect();
    mx = clamp(((e.clientX - r.left) / r.width - 0.5) * 2);
    my = clamp(((e.clientY - r.top) / r.height - 0.5) * 2);
    if (frame) return;
    frame = requestAnimationFrame(function () {
      frame = 0;
      place(mx, my);
    });
  });

  hero.addEventListener('mouseleave', function () {
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
    place(0, 0);
  });

  // --- scroll reveals: IntersectionObserver fallback ------------------------------
  //
  // Elements carrying data-reveal are watched; every element sharing a group in
  // data-rv gets `.in` while any watched element of that group is on screen,
  // and loses it again when none is — so scrolling back up plays in reverse.

  if (!root.classList.contains('rv-on')) return;

  var visible = new Map();
  var targets = root.querySelectorAll('[data-rv]');

  var observer = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) { visible.set(entry.target, entry.isIntersecting); });
    var seen = {};
    visible.forEach(function (isVisible, el) {
      if (isVisible) seen[el.getAttribute('data-reveal')] = true;
    });
    for (var i = 0; i < targets.length; i++) {
      targets[i].classList.toggle('in', !!seen[targets[i].getAttribute('data-rv')]);
    }
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0.01 });

  root.querySelectorAll('[data-reveal]').forEach(function (el) { observer.observe(el); });
})();
