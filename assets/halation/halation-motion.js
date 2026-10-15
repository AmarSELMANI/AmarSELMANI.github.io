/*! Halation motion runtime 1.0.0
 *
 * Load GSAP + ScrollTrigger first (any GSAP 3.x), then this file, then:
 *   Halation.init({ intro: { title: 'Studio Name' } })
 *
 * Everything is declared in HTML:
 *   data-reveal                  develop in on scroll (group with data-reveal-group on a parent)
 *   data-assemble + data-part    parts arrive from from-start | from-end | from-top | from-bottom | scale | develop
 *   data-frame-open              letterbox bars open on a .h-frame
 *   data-scene="dolly"           scroll-driven scene; children carry data-depth (-1..1), data-scene-in / data-scene-out
 *   data-light                   surface catches a light under the pointer (a flash under the finger on touch)
 *   data-magnetic="0.3"          leans toward the pointer, settles on a spring (fine pointers only)
 *   data-ambient="dust light"    atmosphere inside a section
 *   data-reel                    scroll position as a timecode; a <button> becomes the ambient pause control
 *   data-timecode="84.5"         static timecode readout (seconds)
 *   a[data-cut]                  film cut to another page
 *   data-nav                     gets .is-scrolled after the first 24px
 *
 * Genre, intensity and mode are read from CSS custom properties at each element,
 * so a [data-genre="thriller"] section inside a Drama page moves like a Thriller.
 * Tiers: full (fine pointer), touch (GPU-only versions), calm (prefers-reduced-motion).
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Halation = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var VERSION = '1.0.0';
  var GSAP_EASE = { develop: 'expo.out', dolly: 'power2.inOut', cut: 'power4.inOut', drift: 'sine.inOut', snap: 'power3.out', exit: 'power3.in' };
  var state = { gsap: null, ST: null, tier: 'full', forced: null, opts: {}, cleanups: [], started: false };
  var doc = typeof document !== 'undefined' ? document : null;
  var html = doc ? doc.documentElement : null;

  // ------------------------------------------------------------------ helpers
  function mq(q) { return window.matchMedia ? window.matchMedia(q) : { matches: false }; }
  function num(v, d) { var f = parseFloat(v); return isFinite(f) ? f : d; }
  function secs(v, d) { if (!v) return d; v = String(v).trim(); return /ms$/.test(v) ? num(v, d * 1000) / 1000 : /s$/.test(v) ? num(v, d) : d; }
  function cssVar(el, name) { return getComputedStyle(el).getPropertyValue(name).trim(); }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function wait(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  function $$(sel, scope) { return Array.prototype.slice.call((scope || doc).querySelectorAll(sel)); }
  function on(el, type, fn, opt) { el.addEventListener(type, fn, opt); state.cleanups.push(function () { el.removeEventListener(type, fn, opt); }); }
  function later(fn) { state.cleanups.push(fn); }
  var store = {
    get: function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set: function (k, v) { try { localStorage.setItem(k, v); } catch (e) { /* private mode */ } },
  };
  var session = {
    get: function (k) { try { return sessionStorage.getItem(k); } catch (e) { return null; } },
    set: function (k, v) { try { sessionStorage.setItem(k, v); } catch (e) { /* blocked */ } },
    del: function (k) { try { sessionStorage.removeItem(k); } catch (e) { /* blocked */ } },
  };
  function cssEase(name) { return (html && cssVar(html, '--ease-' + name)) || 'ease-out'; }

  /** Motion settings for an element, from the genre/intensity tokens in its scope, adjusted for the tier. */
  function genre(el) {
    var cs = getComputedStyle(el || html);
    var g = function (n) { return cs.getPropertyValue(n).trim(); };
    var touch = state.tier === 'touch';
    var dF = touch ? num(g('--touch-distance'), 0.6) : 1;
    var tF = touch ? num(g('--touch-duration'), 0.8) : 1;
    return {
      reveal: secs(g('--g-reveal'), 1.2) * tF,
      stagger: secs(g('--g-stagger'), 0.11) * tF,
      distance: num(g('--g-distance'), 32) * num(g('--int-motion'), 1) * dF,
      blur: touch ? 0 : num(g('--g-blur'), 0),
      scale: num(g('--g-scale'), 1),
      transition: secs(g('--g-transition'), 0.9) * tF,
      hold: secs(g('--g-hold'), 0.18),
      scrub: num(g('--g-scrub'), 1),
      intensity: num(g('--int-motion'), 1),
      enter: GSAP_EASE[g('--g-enter')] || 'expo.out',
      move: GSAP_EASE[g('--g-move')] || 'power2.inOut',
      cut: g('--g-cut') || 'fade-black',
      rtl: cs.direction === 'rtl',
    };
  }

  // ------------------------------------------------------------------ tiers
  function detectTier() {
    if (state.forced) return state.forced;
    if (mq('(prefers-reduced-motion: reduce)').matches) return 'calm';
    var n = navigator, conn = n.connection || {};
    var lowEnd = (n.hardwareConcurrency && n.hardwareConcurrency <= 2) || (n.deviceMemory && n.deviceMemory <= 2) || conn.saveData;
    if (mq('(hover: none), (pointer: coarse)').matches || mq('(max-width: 767px)').matches || lowEnd) return 'touch';
    return 'full';
  }
  function applyTier() { state.tier = detectTier(); html.setAttribute('data-tier', state.tier); }

  // ------------------------------------------------------------------ triggers
  // Plays `play` once when `el` nears the viewport. Content already on screen plays immediately,
  // so nothing waits hidden for a scroll. Keyboard focus inside also plays it, so tabbing never lands on invisible content.
  function whenSeen(el, play) {
    var done = false;
    var fire = function () { if (done) return; done = true; el.setAttribute('data-revealed', ''); play(); };
    var rect = el.getBoundingClientRect();
    if (rect.top < innerHeight * 0.9) { requestAnimationFrame(fire); return; }
    on(el, 'focusin', fire);
    if (state.ST) {
      var st = state.ST.create({ trigger: el, start: 'top 90%', once: true, onEnter: fire });
      later(function () { st.kill(); });
    } else if ('IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (entries) { if (entries[0].isIntersecting) { io.disconnect(); fire(); } }, { rootMargin: '0px 0px -10% 0px' });
      io.observe(el);
      later(function () { io.disconnect(); });
    } else fire();
  }
  function isLarge(el) { return el.offsetWidth * el.offsetHeight > 0.35 * innerWidth * innerHeight; }

  // ------------------------------------------------------------------ develop reveal
  function bindReveal() {
    var gs = state.gsap; if (!gs) return;
    var groups = new Map();
    $$('[data-reveal]').forEach(function (el) {
      if (el.hasAttribute('data-revealed')) return;
      var host = el.closest('[data-reveal-group]') || el;
      if (host.hasAttribute('data-revealed') && host !== el) return;
      if (!groups.has(host)) groups.set(host, []);
      groups.get(host).push(el);
    });
    groups.forEach(function (items, host) {
      var c = genre(host), calm = state.tier === 'calm';
      var useBlur = c.blur > 0 && !items.some(isLarge) && host.getAttribute('data-reveal') !== 'rise';
      var from = calm ? { opacity: 0 } : { opacity: 0, y: c.distance, scale: c.scale };
      if (useBlur && !calm) from.filter = 'blur(' + c.blur + 'px)';
      gs.set(items, from);
      whenSeen(host, function () {
        var to = {
          opacity: 1, y: 0, scale: 1,
          duration: calm ? 0.3 : c.reveal, ease: calm ? 'none' : c.enter,
          stagger: calm ? 0 : c.stagger, clearProps: 'filter,transform',
          onComplete: function () { items.forEach(function (i) { i.setAttribute('data-revealed', ''); }); },
        };
        if (from.filter) to.filter = 'blur(0px)';
        gs.to(items, to);
      });
      later(function () { if (!host.hasAttribute('data-revealed')) gs.set(items, { clearProps: 'all' }); });
    });
  }

  // ------------------------------------------------------------------ assembly
  function bindAssemble() {
    var gs = state.gsap; if (!gs) return;
    $$('[data-assemble]').forEach(function (box) {
      if (box.hasAttribute('data-revealed')) return;
      var parts = $$('[data-part]', box); if (!parts.length) return;
      var c = genre(box), calm = state.tier === 'calm';
      var d = c.distance * 1.8, s = c.rtl ? -1 : 1;
      var vec = { 'from-start': [-d * s, 0], 'from-end': [d * s, 0], 'from-top': [0, -d], 'from-bottom': [0, d], scale: [0, 0], develop: [0, 0] };
      var fromOf = function (p) {
        var k = p.getAttribute('data-part'), v = vec[k] || [0, d];
        if (calm) return { opacity: 0 };
        var f = { opacity: 0, x: v[0], y: v[1], scale: k === 'scale' ? 0.9 : 1 };
        if (k === 'develop' && c.blur) f.filter = 'blur(' + c.blur + 'px)';
        return f;
      };
      parts.forEach(function (p) { gs.set(p, fromOf(p)); });
      whenSeen(box, function () {
        var tl = gs.timeline({ defaults: { duration: calm ? 0.3 : c.reveal, ease: calm ? 'none' : c.enter } });
        parts.forEach(function (p, i) {
          var to = { opacity: 1, x: 0, y: 0, scale: 1, clearProps: 'filter,transform' };
          if (fromOf(p).filter) to.filter = 'blur(0px)';
          tl.to(p, to, calm ? 0 : i * c.stagger * 1.4);
        });
      });
      later(function () { if (!box.hasAttribute('data-revealed')) gs.set(parts, { clearProps: 'all' }); });
    });
  }

  // ------------------------------------------------------------------ letterbox frames
  function bindFrames() {
    var gs = state.gsap; if (!gs || state.tier === 'calm') return;
    $$('[data-frame-open]').forEach(function (fr) {
      if (fr.hasAttribute('data-revealed')) return;
      var bars = ['top', 'bottom'].map(function (pos) {
        var b = doc.createElement('span'); b.className = 'h-frame__bar h-frame__bar--' + pos; b.setAttribute('aria-hidden', 'true'); fr.appendChild(b); return b;
      });
      var media = fr.querySelector(':scope > img, :scope > video, :scope > canvas, :scope > .h-frame__media');
      var c = genre(fr);
      gs.set(bars, { scaleY: 1 });
      if (media) gs.set(media, { scale: 1.08 });
      whenSeen(fr, function () {
        gs.to(bars, { scaleY: 0, duration: Math.max(0.5, c.transition * 1.1), ease: GSAP_EASE.cut, onComplete: function () { bars.forEach(function (b) { b.remove(); }); } });
        if (media) gs.to(media, { scale: 1, duration: c.reveal * 1.4, ease: GSAP_EASE.develop, clearProps: 'transform' });
      });
      later(function () { bars.forEach(function (b) { b.remove(); }); if (media && !fr.hasAttribute('data-revealed')) gs.set(media, { clearProps: 'transform' }); });
    });
  }

  // ------------------------------------------------------------------ scroll scenes (dolly)
  function bindScenes() {
    var gs = state.gsap, ST = state.ST; if (!gs || !ST || state.tier === 'calm') return;
    $$('[data-scene="dolly"]').forEach(function (scene) {
      var layers = $$('[data-depth]', scene); if (!layers.length) return;
      var c = genre(scene), full = state.tier === 'full';
      var pin = full && scene.getAttribute('data-pin') !== 'false';
      var amp = full ? 1 : 0.4;
      var tl = gs.timeline({
        defaults: { ease: 'none', duration: 1 },
        scrollTrigger: {
          trigger: scene,
          start: pin ? 'top top' : 'top bottom',
          end: pin ? '+=' + (scene.getAttribute('data-length') || '150%') : 'bottom top',
          pin: pin, scrub: full ? c.scrub : true, anticipatePin: 1, invalidateOnRefresh: true,
        },
      });
      layers.forEach(function (l) {
        var depth = num(l.getAttribute('data-depth'), 0);
        tl.fromTo(l, { yPercent: depth * 16 * amp, scale: 1 }, { yPercent: -depth * 16 * amp, scale: 1 + depth * 0.14 * amp }, 0);
      });
      $$('[data-scene-in]', scene).forEach(function (el) {
        tl.fromTo(el, { opacity: 0, y: c.distance }, { opacity: 1, y: 0, duration: 0.25, ease: c.enter }, num(el.getAttribute('data-scene-in'), 0.15));
      });
      $$('[data-scene-out]', scene).forEach(function (el) {
        tl.to(el, { opacity: 0, duration: 0.2 }, num(el.getAttribute('data-scene-out'), 0.75));
      });
      later(function () { if (tl.scrollTrigger) tl.scrollTrigger.kill(true); tl.kill(); gs.set(layers, { clearProps: 'transform' }); });
    });
  }

  // ------------------------------------------------------------------ cursor light
  function bindLight() {
    $$('[data-light]').forEach(function (el) {
      el.classList.add('h-lit');
      var spot = doc.createElement('span'); spot.className = 'h-spot'; spot.setAttribute('aria-hidden', 'true');
      el.insertBefore(spot, el.firstChild);
      var r = 0, px = 0, py = 0, raf = 0, t = 0;
      var place = function () { raf = 0; spot.style.transform = 'translate3d(' + (px - r) + 'px,' + (py - r) + 'px,0)'; };
      var aim = function (e) { var b = el.getBoundingClientRect(); px = e.clientX - b.left; py = e.clientY - b.top; if (!raf) raf = requestAnimationFrame(place); };
      if (state.tier === 'full') {
        on(el, 'pointerenter', function (e) { r = spot.offsetWidth / 2; aim(e); spot.classList.add('is-on'); });
        on(el, 'pointermove', aim, { passive: true });
        on(el, 'pointerleave', function () { spot.classList.remove('is-on'); });
      } else {
        // touch + calm: light blooms where the finger lands, then fades. It never follows.
        on(el, 'pointerdown', function (e) {
          r = spot.offsetWidth / 2; aim(e); spot.classList.add('is-on');
          clearTimeout(t); t = setTimeout(function () { spot.classList.remove('is-on'); }, 420);
        }, { passive: true });
      }
      later(function () { cancelAnimationFrame(raf); clearTimeout(t); spot.remove(); el.classList.remove('h-lit'); });
    });
  }

  // ------------------------------------------------------------------ magnetic (spring from tokens, no library)
  function springOf(el) {
    var v = cssVar(el, '--spring-magnet').split(/\s+/).map(Number);
    return { k: v[0] || 220, c: v[1] || 12, m: v[2] || 0.6 };
  }
  function makeSpring(cfg, apply) {
    var x = 0, y = 0, vx = 0, vy = 0, tx = 0, ty = 0, raf = 0, last = 0;
    function step(t) {
      var dt = last ? Math.min(0.032, (t - last) / 1000) : 1 / 60; last = t;
      vx += ((-cfg.k * (x - tx) - cfg.c * vx) / cfg.m) * dt; vy += ((-cfg.k * (y - ty) - cfg.c * vy) / cfg.m) * dt;
      x += vx * dt; y += vy * dt;
      if (Math.abs(x - tx) < 0.05 && Math.abs(y - ty) < 0.05 && Math.abs(vx) < 0.5 && Math.abs(vy) < 0.5) { x = tx; y = ty; apply(x, y); raf = 0; last = 0; return; }
      apply(x, y); raf = requestAnimationFrame(step);
    }
    return {
      to: function (nx, ny) { tx = nx; ty = ny; if (!raf) raf = requestAnimationFrame(step); },
      stop: function () { cancelAnimationFrame(raf); raf = 0; apply(0, 0); },
    };
  }
  function bindMagnetic() {
    if (state.tier !== 'full') return;
    $$('[data-magnetic]').forEach(function (el) {
      var strength = num(el.getAttribute('data-magnetic'), 0.3);
      var max = 12 * genre(el).intensity;
      var inner = el.querySelector('[data-magnetic-inner]');
      // `translate` is separate from `transform`, so :active scale and GSAP reveals still compose.
      var sp = makeSpring(springOf(el), function (x, y) {
        el.style.translate = x || y ? x.toFixed(2) + 'px ' + y.toFixed(2) + 'px' : '';
        if (inner) inner.style.translate = x || y ? (x * 0.45).toFixed(2) + 'px ' + (y * 0.45).toFixed(2) + 'px' : '';
      });
      on(el, 'pointermove', function (e) {
        var b = el.getBoundingClientRect();
        sp.to(clamp((e.clientX - b.left - b.width / 2) * strength, -max, max), clamp((e.clientY - b.top - b.height / 2) * strength, -max, max));
      }, { passive: true });
      on(el, 'pointerleave', function () { sp.to(0, 0); });
      later(function () { sp.stop(); });
    });
  }

  // ------------------------------------------------------------------ ambient
  function grainTexture() {
    if (html.style.getPropertyValue('--grain-img')) return;
    var size = 180, cv = doc.createElement('canvas'); cv.width = cv.height = size;
    var ctx = cv.getContext('2d'); if (!ctx) return;
    var img = ctx.createImageData(size, size), d = img.data;
    for (var i = 0; i < d.length; i += 4) { var v = Math.random() < 0.5 ? 0 : 255; d[i] = d[i + 1] = d[i + 2] = v; d[i + 3] = Math.random() * 120; }
    ctx.putImageData(img, 0, 0);
    html.style.setProperty('--grain-img', 'url(' + cv.toDataURL('image/png') + ')');
  }
  function ambientLayers() {
    var o = state.opts;
    if (o.grain !== false && !doc.querySelector('.h-grain')) { grainTexture(); var g = doc.createElement('div'); g.className = 'h-grain'; g.setAttribute('aria-hidden', 'true'); doc.body.appendChild(g); }
    if (o.vignette !== false && !doc.querySelector('.h-vignette')) { var v = doc.createElement('div'); v.className = 'h-vignette'; v.setAttribute('aria-hidden', 'true'); doc.body.appendChild(v); }
  }
  function rand(a, b) { return a + Math.random() * (b - a); }
  function bindAmbient() {
    $$('[data-ambient]').forEach(function (host) {
      var kinds = (host.getAttribute('data-ambient') || '').split(/\s+/);
      host.classList.add('h-ambient-host');
      var stage = doc.createElement('div'); stage.className = 'h-ambient'; stage.setAttribute('aria-hidden', 'true');
      if (kinds.indexOf('light') > -1) { var dr = doc.createElement('div'); dr.className = 'h-drift'; stage.appendChild(dr); }
      if (kinds.indexOf('dust') > -1 && state.tier !== 'calm') {
        var box = doc.createElement('div'); box.className = 'h-dust';
        var base = num(cssVar(html, state.tier === 'full' ? '--dust-full' : '--dust-touch'), state.tier === 'full' ? 22 : 8);
        var count = Math.min(36, Math.round(base * genre(host).intensity));
        for (var i = 0; i < count; i++) {
          var m = doc.createElement('span'); m.className = 'h-mote';
          var dur = rand(9, 18);
          m.style.cssText = '--x:' + rand(0, 100).toFixed(1) + '%;--y:' + rand(15, 100).toFixed(1) + '%;--s:' + rand(1.5, 3.5).toFixed(1) + 'px;--dx:' + rand(-40, 40).toFixed(0) + 'px;--dy:' + rand(-170, -60).toFixed(0) + 'px;--d:' + dur.toFixed(1) + 's;--delay:-' + rand(0, dur).toFixed(1) + 's;--o:' + rand(0.25, 0.8).toFixed(2);
          box.appendChild(m);
        }
        stage.appendChild(box);
      }
      host.insertBefore(stage, host.firstChild);
      later(function () { stage.remove(); host.classList.remove('h-ambient-host'); });
    });
  }
  function setPaused(paused) {
    if (paused) html.setAttribute('data-ambient', 'paused'); else html.removeAttribute('data-ambient');
    $$('[data-reel]').forEach(function (b) {
      if (b.tagName !== 'BUTTON') return;
      b.setAttribute('aria-pressed', String(paused));
      var sr = b.querySelector('.h-sr'); if (sr) sr.textContent = paused ? 'Resume ambient motion' : 'Pause ambient motion';
    });
    $$('video[data-ambient-video]').forEach(function (v) { if (paused) v.pause(); else v.play().catch(function () {}); });
  }

  // ------------------------------------------------------------------ timecodes, reel, nav
  function timecode(sec, fps) {
    fps = fps || 24; sec = Math.max(0, sec);
    var f = Math.floor((sec % 1) * fps), s = Math.floor(sec) % 60, m = Math.floor(sec / 60) % 60, h = Math.floor(sec / 3600);
    return [h, m, s, f].map(function (v) { return (v < 10 ? '0' : '') + v; }).join(':');
  }
  function bindReadouts() {
    $$('[data-timecode]').forEach(function (el) { el.textContent = timecode(num(el.getAttribute('data-timecode'), 0)); el.classList.add('h-tc'); });
    var reels = $$('[data-reel]'), navs = $$('[data-nav]');
    var runtime = reels.length ? num(reels[0].getAttribute('data-runtime'), 120) : 0;
    var raf = 0, last = '';
    var update = function () {
      raf = 0;
      var max = Math.max(1, html.scrollHeight - innerHeight), p = clamp(scrollY / max, 0, 1);
      if (reels.length) {
        var t = timecode(p * runtime);
        if (t !== last) { last = t; reels.forEach(function (r) { (r.querySelector('[data-reel-time]') || r).textContent = t; }); }
      }
      navs.forEach(function (n) { n.classList.toggle('is-scrolled', scrollY > 24); });
    };
    on(window, 'scroll', function () { if (!raf) raf = requestAnimationFrame(update); }, { passive: true });
    update();
    reels.forEach(function (r) {
      if (r.tagName !== 'BUTTON') return;
      r.setAttribute('aria-pressed', String(html.getAttribute('data-ambient') === 'paused'));
      on(r, 'click', function () { setPaused(html.getAttribute('data-ambient') !== 'paused'); });
    });
  }

  // ------------------------------------------------------------------ film cuts
  var shutter = null;
  function ensureShutter() {
    if (shutter && shutter.isConnected) return shutter;
    shutter = doc.createElement('div'); shutter.className = 'h-shutter'; shutter.setAttribute('aria-hidden', 'true');
    shutter.innerHTML = '<span class="h-shutter__edge"></span>';
    doc.body.appendChild(shutter);
    return shutter;
  }
  function cutFrames(type, c) {
    var dir = c.rtl ? -1 : 1;
    if (type === 'wipe') return {
      out: [{ transform: 'translateX(' + -101 * dir + '%)', opacity: 1 }, { transform: 'translateX(0)', opacity: 1 }],
      inn: [{ transform: 'translateX(0)', opacity: 1 }, { transform: 'translateX(' + 101 * dir + '%)', opacity: 1 }],
      outE: cssEase('cut'), inE: cssEase('cut'), split: 0.5,
    };
    if (type === 'dissolve') return {
      out: [{ opacity: 0, transform: 'scale(1.12)' }, { opacity: 0.96, transform: 'scale(1)' }],
      inn: [{ opacity: 0.96, transform: 'scale(1)' }, { opacity: 0, transform: 'scale(0.96)' }],
      outE: cssEase('drift'), inE: cssEase('develop'), split: 0.5,
    };
    return { out: [{ opacity: 0 }, { opacity: 1 }], inn: [{ opacity: 1 }, { opacity: 0 }], outE: cssEase('exit'), inE: cssEase('develop'), split: 0.45 };
  }
  function cutPlan(opts) {
    var c = genre((opts && opts.scope) || html), calm = state.tier === 'calm';
    var type = calm ? 'fade' : (opts && opts.type) || c.cut;
    var ms = calm ? 400 : c.transition * 1000;
    return { c: c, type: type, ms: ms, f: cutFrames(type, c), hold: calm ? 0 : c.hold * 1000 };
  }
  function cutOut(plan) {
    var sh = ensureShutter(); sh.setAttribute('data-cut', plan.type); sh.classList.add('is-active');
    sh.getAnimations().forEach(function (a) { a.cancel(); });
    return sh.animate(plan.f.out, { duration: plan.ms * plan.f.split, easing: plan.f.outE, fill: 'forwards' }).finished;
  }
  function cutIn(plan) {
    var sh = ensureShutter(); sh.setAttribute('data-cut', plan.type); sh.classList.add('is-active');
    var a = sh.animate(plan.f.inn, { duration: plan.ms * (1 - plan.f.split), easing: plan.f.inE, fill: 'forwards' });
    return a.finished.then(function () { sh.classList.remove('is-active'); sh.getAnimations().forEach(function (x) { x.cancel(); }); });
  }
  /** Film cut inside a page or SPA: cover, run `swap` (may return a Promise), reveal. */
  function cut(swap, opts) {
    var plan = cutPlan(opts);
    return cutOut(plan)
      .then(function () { return swap ? swap() : null; })
      .then(function () { return plan.hold ? wait(plan.hold) : null; })
      .then(function () { return cutIn(plan); });
  }
  function bindCutLinks() {
    // Browsers with cross-document View Transitions get the CSS cut from motion.css; others get this one.
    if ('CSSViewTransitionRule' in window) return;
    $$('a[data-cut]').forEach(function (a) {
      on(a, 'click', function (e) {
        if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || a.target === '_blank') return;
        e.preventDefault();
        var plan = cutPlan({ type: a.getAttribute('data-cut') || undefined });
        session.set('h-cut-in', plan.type);
        cutOut(plan).then(function () { location.href = a.href; });
      });
    });
  }
  function resumeIncomingCut() {
    var type = session.get('h-cut-in'); if (!type) return;
    session.del('h-cut-in');
    var plan = cutPlan({ type: type });
    var sh = ensureShutter(); sh.setAttribute('data-cut', plan.type); sh.classList.add('is-active');
    sh.animate([plan.f.out[1], plan.f.out[1]], { duration: 1, fill: 'forwards' });
    requestAnimationFrame(function () { cutIn(plan); });
  }

  // ------------------------------------------------------------------ intro: title sequence
  function intro(o) {
    o = o || {};
    var key = 'h-intro:' + (o.id || location.pathname);
    if (state.tier === 'calm' || (!o.always && store.get(key))) return Promise.resolve(false);
    store.set(key, '1');
    var total = Math.min(num(cssVar(html, '--intro-max'), 1500), o.duration || 1500);
    var el = doc.createElement('div'); el.className = 'h-intro'; el.setAttribute('aria-hidden', 'true');
    el.innerHTML = '<span class="h-intro__bar h-intro__bar--top"></span><span class="h-intro__bar h-intro__bar--bottom"></span>' +
      '<p class="h-intro__title"></p><span class="h-intro__tc h-tc">00:00:00:00</span><span class="h-intro__skip"></span>';
    el.querySelector('.h-intro__title').textContent = o.title || doc.title;
    el.querySelector('.h-intro__skip').textContent = o.skipLabel || 'Skip';
    doc.body.appendChild(el);
    var title = el.querySelector('.h-intro__title'), tc = el.querySelector('.h-intro__tc'), bars = $$('.h-intro__bar', el);
    var blur = state.tier === 'full' ? 'blur(14px)' : 'blur(0px)';
    var anims = [
      title.animate([{ opacity: 0, filter: blur, transform: 'scale(0.97)' }, { opacity: 1, filter: 'blur(0px)', transform: 'scale(1)' }], { duration: total * 0.6, easing: cssEase('develop'), fill: 'forwards' }),
      title.animate([{ opacity: 1 }, { opacity: 0 }], { duration: total * 0.28, delay: total * 0.72, easing: cssEase('exit'), fill: 'forwards' }),
      tc.animate([{ opacity: 1 }, { opacity: 0 }], { duration: total * 0.25, delay: total * 0.75, fill: 'forwards' }),
    ].concat(bars.map(function (b) {
      return b.animate([{ transform: 'scaleY(1)' }, { transform: 'scaleY(0)' }], { duration: total * 0.38, delay: total * 0.62, easing: cssEase('cut'), fill: 'forwards' });
    }));
    var start = performance.now(), raf = 0;
    var tick = function (t) { tc.textContent = timecode(Math.min(total, t - start) / 1000); if (t - start < total) raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick);
    var skip = function () { anims.forEach(function (a) { a.playbackRate = 8; }); };
    el.addEventListener('pointerdown', skip);
    window.addEventListener('keydown', skip, { once: true });
    window.addEventListener('wheel', skip, { once: true, passive: true });
    return Promise.all(anims.map(function (a) { return a.finished; })).then(function () {
      cancelAnimationFrame(raf); window.removeEventListener('keydown', skip); window.removeEventListener('wheel', skip); el.remove(); return true;
    });
  }

  // ------------------------------------------------------------------ debug overlay (?h-debug)
  function debug() {
    var box = doc.createElement('div');
    box.style.cssText = 'position:fixed;left:8px;bottom:8px;z-index:2147483647;padding:6px 8px;font:11px/1.3 ui-monospace,monospace;background:rgba(0,0,0,.75);color:#fff;pointer-events:none;white-space:pre';
    doc.body.appendChild(box);
    var frames = 0, t0 = performance.now();
    (function loop(t) {
      frames++;
      if (t - t0 >= 1000) {
        var anims = doc.getAnimations ? doc.getAnimations().length : 0;
        box.textContent = 'fps ' + Math.round((frames * 1000) / (t - t0)) + '\ntier ' + state.tier + '\ncss anims ' + anims + (state.gsap ? '\ngsap ' + state.gsap.globalTimeline.getChildren(true, true, false).length : '');
        frames = 0; t0 = t;
      }
      requestAnimationFrame(loop);
    })(t0);
  }

  // ------------------------------------------------------------------ lifecycle
  function bindAll() {
    bindScenes();   // pins first, so triggers below measure the pinned layout
    bindReveal();
    bindAssemble();
    bindFrames();
    bindLight();
    bindMagnetic();
    bindAmbient();
    bindReadouts();
    bindCutLinks();
    if (state.ST) state.ST.refresh();
  }
  function unbindAll() { var c = state.cleanups; state.cleanups = []; c.reverse().forEach(function (fn) { try { fn(); } catch (e) { /* already gone */ } }); }
  function rebind() { unbindAll(); bindAll(); }
  function setTier(t) { state.forced = t || null; applyTier(); rebind(); return state.tier; }

  function init(opts) {
    if (!doc) return api;
    if (state.started) { rebind(); return api; }
    state.started = true;
    state.opts = opts || {};
    state.gsap = state.opts.gsap || window.gsap || null;
    state.ST = state.opts.ScrollTrigger || window.ScrollTrigger || null;
    if (state.gsap && state.ST) { state.gsap.registerPlugin(state.ST); state.ST.config({ ignoreMobileResize: true }); }
    if (!state.gsap) console.info('[Halation] GSAP not found: scroll reveals, assembly, frames and scenes are off; content stays visible.');
    applyTier();
    ['(prefers-reduced-motion: reduce)', '(hover: none), (pointer: coarse)', '(max-width: 767px)'].forEach(function (q) {
      var m = mq(q);
      if (m.addEventListener) m.addEventListener('change', function () { if (state.forced) return; var before = state.tier; applyTier(); if (before !== state.tier) rebind(); });
    });
    ambientLayers();
    bindAll();
    resumeIncomingCut();
    if (doc.fonts && doc.fonts.ready && state.ST) doc.fonts.ready.then(function () { state.ST.refresh(); });
    if (state.opts.intro) intro(state.opts.intro);
    if (state.opts.debug || /[?&]h-debug\b/.test(location.search)) debug();
    return api;
  }

  var api = {
    version: VERSION,
    init: init,
    rebind: rebind,
    refresh: function () { if (state.ST) state.ST.refresh(); },
    setTier: setTier,
    get tier() { return state.tier; },
    genre: genre,
    cut: cut,
    intro: intro,
    timecode: timecode,
    pause: function () { setPaused(true); },
    resume: function () { setPaused(false); },
    destroy: function () { unbindAll(); state.started = false; },
  };
  return api;
});
