/* Mohamed Amar Selmani · portfolio · "Contact Sheet".
 * The Halation runtime (assets/halation/halation-motion.js) does the reveals, assembly, cursor light, magnet,
 * grain and film cuts. This file adds the page's own moves:
 *   marks      grease-pencil circles and underlines, drawn by hand around [data-mark]
 *   table      the work carousel: prints on a light table (arrows, drag, swipe, keys) and a loupe on desktop
 *   counts     numbers that count up once
 *   proof      the "try to break it" challenges
 *   tabs       the services panels (deep links: services.html#mobile)
 *   inquiry    a form that opens WhatsApp or e-mail with the message ready (nothing is stored)
 *   chrome     theme (paper / safelight), ambient pause, phone menu
 */
(function () {
  'use strict';

  var html = document.documentElement;
  var H = window.Halation, gsap = window.gsap, ST = window.ScrollTrigger;
  var fr = html.lang === 'fr';

  window.HalationGlyphs.mount();
  // remembered so pages without a language of their own (the Naftal AI app) can link back to the right portfolio
  try { localStorage.setItem('pf-lang', fr ? 'fr' : 'en'); } catch (e) { /* private mode */ }
  H.init({ vignette: false });
  var tier = H.tier, calm = tier === 'calm', full = tier === 'full';
  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function glyph(el, name) { var u = el.querySelector('use'); if (u) u.setAttribute('href', '#g-' + name); }

  // ================================================================ chrome
  var themeBtn = $('[data-theme-toggle]');
  function syncTheme() {
    if (!themeBtn) return;
    var dark = html.getAttribute('data-theme') === 'dark';
    themeBtn.setAttribute('aria-pressed', String(dark));
    themeBtn.setAttribute('aria-label', themeBtn.getAttribute(dark ? 'data-to-light' : 'data-to-dark'));
    glyph(themeBtn, dark ? 'sun' : 'moon');
  }
  syncTheme();
  if (themeBtn) themeBtn.addEventListener('click', function () {
    var dark = html.getAttribute('data-theme') !== 'dark';
    H.cut(function () {
      html.setAttribute('data-theme', dark ? 'dark' : 'light');
      if (dark) html.removeAttribute('data-tint'); else html.setAttribute('data-tint', 'selmani');
      try { localStorage.setItem('pf-theme', dark ? 'dark' : 'light'); } catch (e) { /* private mode */ }
      syncTheme();
    });
  });

  var motionBtn = $('[data-motion]');
  if (motionBtn) motionBtn.addEventListener('click', function () {
    var paused = motionBtn.getAttribute('aria-pressed') !== 'true';
    if (paused) H.pause(); else H.resume();
    motionBtn.setAttribute('aria-pressed', String(paused));
    motionBtn.setAttribute('aria-label', motionBtn.getAttribute(paused ? 'data-play' : 'data-pause'));
    glyph(motionBtn, paused ? 'play' : 'pause');
  });

  var menu = $('#menu'), openBtn = $('[data-menu-open]');
  if (menu && openBtn && menu.showModal) {
    openBtn.addEventListener('click', function () { menu.showModal(); });
    menu.addEventListener('click', function (e) {
      if (e.target === menu || e.target.closest('[data-menu-close]') || e.target.closest('a')) menu.close();
    });
  }

  // ================================================================ marks: grease pencil, drawn by hand
  var SVGNS = 'http://www.w3.org/2000/svg';
  function hash(s) { var h = 2166136261; for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0) % 2147483646 + 1; }
  function rng(seed) { return function () { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }; }
  // Catmull-Rom through the points, written as cubic Béziers
  function smooth(p) {
    var d = 'M' + p[0][0].toFixed(1) + ' ' + p[0][1].toFixed(1);
    for (var i = 0; i < p.length - 1; i++) {
      var a = p[i - 1] || p[i], b = p[i], c = p[i + 1], e = p[i + 2] || c;
      d += ' C' + (b[0] + (c[0] - a[0]) / 6).toFixed(1) + ' ' + (b[1] + (c[1] - a[1]) / 6).toFixed(1) + ' ' +
        (c[0] - (e[0] - b[0]) / 6).toFixed(1) + ' ' + (c[1] - (e[1] - b[1]) / 6).toFixed(1) + ' ' + c[0].toFixed(1) + ' ' + c[1].toFixed(1);
    }
    return d;
  }
  // a loose loop around a box: starts top-left, goes a little past one turn and spirals out so the ends don't meet
  function loop(x, y, w, h, r, tight) {
    var cx = x + w / 2, cy = y + h / 2;
    // text boxes include the line's leading, so the loop hugs the glyphs rather than the box
    var rx = w / 2 + (tight ? 2 : Math.max(8, h * 0.16)), ry = tight ? h / 2 + 2 : Math.max(h * 0.42, 12);
    var a0 = -Math.PI * 0.68 + (r() - 0.5) * 0.35, turn = 1.1 + r() * 0.08, tilt = (r() - 0.5) * 0.1;
    var f1 = r() * 6.28, f2 = r() * 6.28, n = 40, pts = [];
    for (var i = 0; i <= n; i++) {
      var t = i / n, ang = a0 + t * turn * 2 * Math.PI;
      var k = 1 + 0.035 * Math.sin(3 * ang + f1) + 0.02 * Math.sin(5 * ang + f2) + t * 0.08;
      var px = Math.cos(ang) * rx * k, py = Math.sin(ang) * ry * k;
      pts.push([cx + px * Math.cos(tilt) - py * Math.sin(tilt), cy + px * Math.sin(tilt) + py * Math.cos(tilt)]);
    }
    return [smooth(pts)];
  }
  // one stroke under each line of text, with a small upward flick at the end of the last one
  function under(rects, r) {
    return rects.map(function (b, i) {
      var y = b.y + b.h * 0.94, x0 = b.x - 3, x1 = b.x + b.w + 4, pts = [];
      for (var j = 0; j <= 6; j++) pts.push([x0 + (x1 - x0) * j / 6, y + (r() - 0.5) * 3.2 + Math.sin(j) * 1.2]);
      if (i === rects.length - 1) pts.push([x1 + 6, y - 7 - r() * 4]);
      return smooth(pts);
    });
  }
  function lineRects(el, host) {
    var hb = host.getBoundingClientRect(), out = [];
    var range = document.createRange(); range.selectNodeContents(el);
    var list = range.getClientRects();
    for (var i = 0; i < list.length; i++) {
      var b = list[i]; if (b.width < 2) continue;
      var last = out[out.length - 1];
      if (last && Math.abs(last.y - (b.top - hb.top)) < 4) { last.w = b.right - hb.left - last.x; continue; } // same line
      out.push({ x: b.left - hb.left, y: b.top - hb.top, w: b.width, h: b.height });
    }
    return out;
  }
  function drawMark(el, animate) {
    if (!el.getClientRects().length) return false;
    // measure against the nearest block box: an inline parent that wraps onto two lines skews absolute positions
    var host = el.parentElement;
    while (host.parentElement && getComputedStyle(host).display === 'inline') host = host.parentElement;
    if (getComputedStyle(host).position === 'static') host.style.position = 'relative';
    if (el._svg) el._svg.remove();
    var r = rng(hash((el.textContent || el.className) + (el.getAttribute('data-mark') || '')));
    var kind = el.getAttribute('data-mark'), paths;
    if (kind === 'underline') paths = under(lineRects(el, host), r);
    else {
      var hb = host.getBoundingClientRect(), b = el.getBoundingClientRect();
      paths = loop(b.left - hb.left, b.top - hb.top, b.width, b.height, r, el.classList.contains('mark--box'));
    }
    var svg = document.createElementNS(SVGNS, 'svg');
    svg.setAttribute('class', 'mark-svg');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('width', host.offsetWidth); svg.setAttribute('height', host.offsetHeight);
    var drawn = [];
    paths.forEach(function (d) {
      ['mark-svg__main', 'mark-svg__ghost'].forEach(function (cls, k) {
        var p = document.createElementNS(SVGNS, 'path');
        p.setAttribute('class', cls);
        p.setAttribute('d', d);
        if (k) p.setAttribute('transform', 'translate(1.2 0.9)');
        svg.appendChild(p);
        drawn.push(p);
      });
    });
    host.appendChild(svg);
    el._svg = svg;
    if (animate && gsap && !calm) {
      var at = 0;
      for (var i = 0; i < drawn.length; i += 2) {
        var len = drawn[i].getTotalLength(), dur = Math.min(0.9, 0.35 + len / 1400);
        [drawn[i], drawn[i + 1]].forEach(function (p) { p.style.strokeDasharray = len + 2; p.style.strokeDashoffset = len + 2; });
        gsap.to([drawn[i], drawn[i + 1]], { strokeDashoffset: 0, duration: dur, ease: 'power2.inOut', delay: at });
        at += dur * 0.85;
      }
    }
    return true;
  }
  var marks = $$('[data-mark]');
  function watchMarks() {
    marks.forEach(function (el) {
      if (el.closest('.cap, [role="tabpanel"]')) return; // drawn when shown
      var inHero = !!el.closest('.hero');
      // marks inside something that develops in (a rising print, a frame) wait for it to settle, or they'd be measured mid-move
      var settling = el.closest('[data-reveal], [data-reveal-group]') && !inHero ? 1500 : 520;
      var go = function () { setTimeout(function () { el._drawn = drawMark(el, true); }, inHero ? 950 : settling); };
      if (calm || !ST) { el._drawn = drawMark(el, false); return; }
      ST.create({ trigger: el, start: 'top bottom-=48', once: true, onEnter: go });
    });
  }
  function redrawMarks() { marks.forEach(function (el) { if (el._drawn || el._svg) el._drawn = drawMark(el, false); }); }
  var rT = 0;
  window.addEventListener('resize', function () { clearTimeout(rT); rT = setTimeout(redrawMarks, 180); });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { watchMarks(); redrawMarks(); });
  else watchMarks();
  // hovering a circled word in a heading redraws it
  marks.forEach(function (el) {
    if (el.getAttribute('data-mark') !== 'circle' || !full || el.closest('.cap, .about__print, .frame, .thumb')) return;
    el.addEventListener('pointerenter', function () { if (el._drawn) drawMark(el, true); });
  });

  // ================================================================ light table (work carousel)
  var stage = $('[data-table]');
  if (stage) (function () {
    var prints = $$('.print', stage), n = prints.length, cur = 0, rel = prints.map(function (_, i) { return i; });
    var caps = $$('.cap'), status = $('[data-table-status]'), titles = JSON.parse(stage.getAttribute('data-of') || '[]');
    var base = [-1.6, 1.2, -0.9, 1.7], SIDE = 0.78;
    stage.classList.add('is-live');
    function relOf(i) { var r = ((i - cur) % n + n) % n; return r > n / 2 ? r - n : r; }
    function geom() {
      var pw = prints[0].offsetWidth, W = stage.clientWidth;
      return { pw: pw, gap: Math.max(16, W * 0.03), spacing: pw * 0.5 + pw * SIDE * 0.5 + Math.max(16, W * 0.03) };
    }
    function place(animate, dir) {
      var G = geom();
      var h = Math.max.apply(null, prints.map(function (p) { return p.offsetHeight; }));
      stage.style.height = Math.round(h * 1.04) + 'px';
      prints.forEach(function (p, i) {
        var r = relOf(i), was = rel[i], hidden = Math.abs(r) >= 2;
        var x = hidden ? (dir > 0 ? -2 : 2) * G.spacing : r * G.spacing;
        var vars = { xPercent: -50, x: x, scale: r === 0 ? 1 : SIDE, rotation: r === 0 ? 0 : base[i % 4] + r * 1.4, yPercent: r === 0 ? 0 : 4, opacity: hidden ? 0 : 1, zIndex: r === 0 ? 3 : hidden ? 1 : 2 };
        p.setAttribute('aria-hidden', String(r !== 0));
        p.tabIndex = r === 0 ? 0 : -1;
        if (!animate || calm || !gsap) { if (gsap) gsap.set(p, vars); else p.style.transform = 'translateX(-50%) translateX(' + x + 'px) scale(' + vars.scale + ')'; rel[i] = r; return; }
        if (Math.abs(was) >= 2 && !hidden) gsap.set(p, { x: (r > 0 ? 2 : -2) * G.spacing, opacity: 0 });
        gsap.to(p, Object.assign({ duration: full ? 0.75 : 0.55, ease: 'power3.out', overwrite: true }, vars));
        rel[i] = r;
      });
    }
    function caption() {
      caps.forEach(function (c) {
        var on = +c.getAttribute('data-i') === cur;
        if (on === !c.hidden) return;
        c.hidden = !on;
        if (on) {
          var m = $('[data-mark]', c); if (m) setTimeout(function () { m._drawn = drawMark(m, true); }, calm ? 0 : 220);
          if (gsap && !calm) gsap.fromTo(c, { autoAlpha: 0, y: 14 }, { autoAlpha: 1, y: 0, duration: 0.5, ease: 'power3.out', clearProps: 'transform,opacity,visibility' });
        }
      });
      if (status && titles.length) status.textContent = (fr ? 'Projet ' : 'Project ') + (cur + 1) + (fr ? ' sur ' : ' of ') + n + (fr ? ' : ' : ': ') + titles[cur];
    }
    function go(to, dir) { cur = (to % n + n) % n; place(true, dir); caption(); hideLoupe(); }
    function step(d) { go(cur + d, d); }
    $('[data-prev]').addEventListener('click', function () { step(-1); });
    $('[data-next]').addEventListener('click', function () { step(1); });
    stage.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowLeft') { e.preventDefault(); step(-1); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); step(1); }
    });
    // drag / swipe
    var sx = 0, sy = 0, dx = 0, down = false, dragging = false, moved = false, G0 = null;
    stage.addEventListener('pointerdown', function (e) {
      if (e.button !== 0) return;
      down = true; dragging = false; moved = false; sx = e.clientX; sy = e.clientY; dx = 0; G0 = geom();
    });
    window.addEventListener('pointermove', function (e) {
      if (!down) return;
      dx = e.clientX - sx;
      if (!dragging && Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(e.clientY - sy)) { dragging = true; stage.classList.add('is-dragging'); hideLoupe(); }
      if (dragging && gsap && !calm) prints.forEach(function (p, i) { var r = rel[i]; if (Math.abs(r) < 2) gsap.set(p, { x: r * G0.spacing + dx * 0.6 }); });
    }, { passive: true });
    window.addEventListener('pointerup', function () {
      if (!down) return;
      down = false; stage.classList.remove('is-dragging');
      if (dragging) { moved = true; if (Math.abs(dx) > 60) step(dx < 0 ? 1 : -1); else place(true, 0); }
      dragging = false;
    });
    // a click on a side print brings it to the centre; a click on the centre one opens the demo
    stage.addEventListener('click', function (e) {
      var p = e.target.closest('.print'); if (!p) return;
      if (moved) { e.preventDefault(); moved = false; return; }
      var i = +p.getAttribute('data-i');
      if (i !== cur) { e.preventDefault(); go(i, relOf(i) > 0 ? 1 : -1); }
    });
    window.addEventListener('resize', function () { place(false, 0); });
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { place(false, 0); });
    place(false, 0); caption();
    // the first caption's frame number is circled when the table comes into view
    var firstMark = $('.cap:not([hidden]) [data-mark]');
    if (firstMark) {
      if (calm || !ST) firstMark._drawn = drawMark(firstMark, false);
      else ST.create({ trigger: stage, start: 'top 70%', once: true, onEnter: function () { setTimeout(function () { firstMark._drawn = drawMark(firstMark, true); }, 400); } });
    }

    // ---------------------------------------------------------- loupe (fine pointer, full tier)
    var loupe = null, Z = 2.4;
    function hideLoupe() { if (loupe) loupe.classList.remove('is-on'); }
    if (!full) return;
    loupe = document.createElement('div'); loupe.className = 'loupe'; loupe.setAttribute('aria-hidden', 'true');
    document.body.appendChild(loupe);
    var R = 0, raf = 0, ev = null, active = null;
    function paint() {
      raf = 0; if (!active || !ev) return;
      var img = active, b = img.getBoundingClientRect();
      var nw = img.naturalWidth, nh = img.naturalHeight; if (!nw) return;
      var s = Math.max(b.width / nw, b.height / nh), cw = nw * s, ch = nh * s;
      var pos = (getComputedStyle(img).objectPosition || '0 0').split(' ');
      var px = parseFloat(pos[0]) / 100 || 0, py = parseFloat(pos[1]) / 100 || 0;
      var ox = (b.width - cw) * px, oy = (b.height - ch) * py;
      var mx = ev.clientX - b.left - ox, my = ev.clientY - b.top - oy;
      loupe.style.backgroundImage = 'url("' + (img.currentSrc || img.src) + '")';
      loupe.style.backgroundSize = (cw * Z) + 'px ' + (ch * Z) + 'px';
      loupe.style.backgroundPosition = (R - mx * Z) + 'px ' + (R - my * Z) + 'px';
      loupe.style.transform = 'translate3d(' + (ev.clientX - R) + 'px,' + (ev.clientY - R) + 'px,0)';
    }
    stage.addEventListener('pointermove', function (e) {
      if (dragging || e.pointerType !== 'mouse') return;
      var scr = e.target.closest('.mock__screen');
      var p = e.target.closest('.print');
      if (!scr || !p || +p.getAttribute('data-i') !== cur) { active = null; hideLoupe(); return; }
      active = $('img', scr); ev = e; R = loupe.offsetWidth / 2;
      loupe.classList.add('is-on');
      if (!raf) raf = requestAnimationFrame(paint);
    });
    stage.addEventListener('pointerleave', function () { active = null; hideLoupe(); });
    window.addEventListener('scroll', hideLoupe, { passive: true });
  })();

  // ================================================================ counts
  // thousands separated the way the page's language writes them (1,250,000 / 1 250 000)
  var fmt = function (v) { return Math.round(v).toLocaleString(fr ? 'fr-FR' : 'en-US').replace(/\s/g, ' '); };
  $$('[data-count]').forEach(function (el) {
    var to = +el.getAttribute('data-count');
    el.textContent = fmt(to);
    if (calm || !gsap || !ST) return;
    el.textContent = '0';
    ST.create({ trigger: el, start: 'top 90%', once: true, onEnter: function () {
      var o = { v: 0 };
      gsap.to(o, { v: to, duration: 1.4, ease: 'power3.out', delay: 0.25, onUpdate: function () { el.textContent = fmt(o.v); } });
    } });
  });

  // ================================================================ proof (challenges)
  var proof = $('[data-proof]');
  if (proof) (function () {
    var slides = $$('.proof__slide', proof), n = slides.length, cur = 0, count = $('[data-proof-count]');
    var pad = function (v) { return (v < 10 ? '0' : '') + v; };
    function show(to, dir) {
      var a = slides[cur]; cur = (to % n + n) % n; var b = slides[cur];
      if (count) count.textContent = pad(cur + 1) + ' / ' + pad(n);
      if (!gsap || calm) { a.hidden = true; b.hidden = false; return; }
      var w = full;
      gsap.to(a, w ? { clipPath: dir > 0 ? 'inset(0 100% 0 0)' : 'inset(0 0 0 100%)', duration: 0.4, ease: 'power4.inOut', onComplete: done } : { autoAlpha: 0, x: -24 * dir, duration: 0.25, ease: 'power3.in', onComplete: done });
      function done() {
        a.hidden = true; gsap.set(a, { clearProps: 'all' });
        b.hidden = false;
        gsap.fromTo(b, w ? { clipPath: dir > 0 ? 'inset(0 0 0 100%)' : 'inset(0 100% 0 0)' } : { autoAlpha: 0, x: 24 * dir },
          w ? { clipPath: 'inset(0 0% 0 0%)', duration: 0.5, ease: 'power4.inOut', clearProps: 'clipPath' } : { autoAlpha: 1, x: 0, duration: 0.35, ease: 'power3.out', clearProps: 'all' });
      }
    }
    $('[data-proof-prev]').addEventListener('click', function () { show(cur - 1, -1); });
    $('[data-proof-next]').addEventListener('click', function () { show(cur + 1, 1); });
  })();

  // ================================================================ price list toggle (services page)
  var curBox = $('[data-currency]');
  if (curBox) (function () {
    var btns = $$('button[data-cur]', curBox);
    function set(cur, save, animate) {
      html.setAttribute('data-cur', cur);
      btns.forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-cur') === cur)); });
      if (save) { try { localStorage.setItem('pf-cur', cur); } catch (e) { /* private mode */ } }
      if (animate && gsap && !calm) {
        var shown = $$('.panel:not([hidden]) .cur-' + cur + ' .price__v');
        gsap.fromTo(shown, { autoAlpha: 0, y: 12 }, { autoAlpha: 1, y: 0, duration: 0.4, ease: 'power3.out', clearProps: 'all' });
      }
    }
    set(html.getAttribute('data-cur') === 'dzd' ? 'dzd' : 'eur', false, false);
    btns.forEach(function (b) { b.addEventListener('click', function () { set(b.getAttribute('data-cur'), true, true); }); });
  })();

  // ================================================================ tabs (services page)
  var tablist = $('[data-tabs]');
  if (tablist) (function () {
    var tabs = $$('[role="tab"]', tablist);
    function select(tab, focus, animate) {
      tabs.forEach(function (t) {
        var on = t === tab, panel = document.getElementById(t.getAttribute('aria-controls'));
        t.setAttribute('aria-selected', String(on)); t.tabIndex = on ? 0 : -1;
        if (on === !panel.hidden) return;
        panel.hidden = !on;
        if (on && animate && gsap && !calm) {
          gsap.fromTo(panel, full ? { clipPath: 'inset(0 0 0 100%)' } : { autoAlpha: 0, y: 16 },
            full ? { clipPath: 'inset(0 0 0 0%)', duration: 0.55, ease: 'power4.inOut', clearProps: 'clipPath' } : { autoAlpha: 1, y: 0, duration: 0.32, ease: 'power3.out', clearProps: 'all' });
        }
      });
      if (focus) tab.focus();
    }
    tabs.forEach(function (t, i) {
      t.addEventListener('click', function () { select(t, false, true); try { history.replaceState(null, '', '#' + t.getAttribute('aria-controls')); } catch (e) { /* file:// */ } });
      t.addEventListener('keydown', function (e) {
        var j = e.key === 'ArrowRight' ? i + 1 : e.key === 'ArrowLeft' ? i - 1 : e.key === 'Home' ? 0 : e.key === 'End' ? tabs.length - 1 : null;
        if (j === null) return;
        e.preventDefault(); select(tabs[(j + tabs.length) % tabs.length], true, true);
      });
    });
    function fromHash() {
      var id = (location.hash || '').slice(1), t = id && $('[role="tab"][aria-controls="' + id + '"]', tablist);
      if (t) { select(t, false, false); setTimeout(function () { tablist.scrollIntoView({ block: 'start', behavior: calm ? 'auto' : 'smooth' }); }, 60); }
    }
    fromHash();
    window.addEventListener('hashchange', fromHash);
  })();

  // ================================================================ inquiry form -> WhatsApp / e-mail
  $$('[data-inquiry]').forEach(function (form) {
    var chips = $$('[data-need]', form), msg = form.elements.message, err = $('.h-field__error', form), last = 'wa';
    chips.forEach(function (c) { c.addEventListener('click', function () { c.setAttribute('aria-pressed', String(c.getAttribute('aria-pressed') !== 'true')); }); });
    $$('[data-send]', form).forEach(function (b) { b.addEventListener('click', function () { last = b.getAttribute('data-send'); }); });
    msg.addEventListener('input', function () { if (msg.value.trim()) { err.hidden = true; msg.removeAttribute('aria-invalid'); } });
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var via = (e.submitter && e.submitter.getAttribute('data-send')) || last;
      var text = msg.value.trim();
      if (!text) { err.hidden = false; msg.setAttribute('aria-invalid', 'true'); msg.focus(); return; }
      var name = form.elements.name.value.trim();
      var needs = chips.filter(function (c) { return c.getAttribute('aria-pressed') === 'true'; }).map(function (c) { return c.getAttribute('data-need'); });
      if (form.hasAttribute('data-lower')) needs = needs.map(function (s) { return s.charAt(0).toLowerCase() + s.slice(1); });
      var body = form.getAttribute('data-t-hello') +
        (name ? form.getAttribute('data-t-name').replace('{name}', name) : '') +
        (needs.length ? form.getAttribute('data-t-needs').replace('{needs}', needs.join(', ')) : '') + '\n\n' + text;
      if (via === 'mail') location.href = 'mailto:' + form.getAttribute('data-email') + '?subject=' + encodeURIComponent(form.getAttribute('data-subject')) + '&body=' + encodeURIComponent(body);
      else window.open('https://wa.me/' + form.getAttribute('data-wa') + '?text=' + encodeURIComponent(body), '_blank', 'noopener');
    });
  });
})();
