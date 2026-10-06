/*!
 * Fluxo Loader — tela de carregamento animada do logo Fluxo, com efeitos sonoros.
 * Sem dependências. Uso:
 *   <script src="fluxo-loader.js"></script>
 *   <script>
 *     const loader = FluxoLoader.show();                     // abre a tela
 *     window.addEventListener('load', () => loader.hide());  // fecha quando o site carregar
 *   </script>
 * Opções de show({
 *   theme: 'dark' | 'light',   // padrão 'dark'
 *   size: 420,                 // largura máxima do logo em px
 *   minLoops: 1,               // quantas vezes o logo liga antes de poder fechar
 *   zIndex: 9999,
 *   sound: true,               // efeitos sonoros ligados
 *   volume: 0.6,               // 0 a 1
 *   soundEveryLoop: false,     // false = som só na primeira vez que o logo se forma
 *   soundButton: true          // mostra o botão de som no canto da tela
 * })
 *
 * Sobre o som: navegadores só liberam áudio depois que o visitante interage com a página
 * (clique, toque ou tecla). Se a tela abrir antes disso, ela começa muda e o som entra
 * assim que a pessoa tocar na tela ou no botão de som.
 */
(function (global) {
  'use strict';

  /* ---------- Som (Web Audio, tudo sintetizado, sem arquivos) ---------- */
  var actx = null;
  function getCtx() {
    if (actx) return actx;
    var AC = global.AudioContext || global.webkitAudioContext;
    if (!AC) return null;
    try { actx = new AC(); } catch (e) { actx = null; }
    return actx;
  }

  function createSound(volume) {
    var ctx = getCtx();
    if (!ctx) return null;

    var master = ctx.createGain(); master.gain.value = volume;
    var comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16; comp.ratio.value = 4; comp.attack.value = .003; comp.release.value = .2;
    var trim = ctx.createGain(); trim.gain.value = .9;
    master.connect(comp); comp.connect(trim); trim.connect(ctx.destination);

    // Reverb curto gerado na hora (dá o brilho "de marca")
    var rev = ctx.createConvolver(), revGain = ctx.createGain(); revGain.gain.value = .22;
    var len = Math.floor(ctx.sampleRate * 1.4), ir = ctx.createBuffer(2, len, ctx.sampleRate);
    for (var ch = 0; ch < 2; ch++) {
      var d = ir.getChannelData(ch);
      for (var i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
    }
    rev.buffer = ir; rev.connect(revGain); revGain.connect(master);

    var noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate), nd = noise.getChannelData(0);
    for (var j = 0; j < nd.length; j++) nd[j] = Math.random() * 2 - 1;

    function out(node, wet) {
      node.connect(master);
      if (wet) { var w = ctx.createGain(); w.gain.value = wet; node.connect(w); w.connect(rev); }
    }
    function env(g, t, a, peak, dec) {
      g.gain.value = 0.0001;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(peak, t + a);
      g.gain.exponentialRampToValueAtTime(0.0001, t + a + dec);
    }

    // 1. A bolinha desliza pelo braço do F: "swoosh" que sobe
    function swoosh(t, dur, up, level) {
      var src = ctx.createBufferSource(); src.buffer = noise;
      var bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 1.4;
      bp.frequency.setValueAtTime(up ? 350 : 2600, t);
      bp.frequency.exponentialRampToValueAtTime(up ? 3200 : 300, t + dur);
      var g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(level, t + dur * .7);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur + .12);
      src.connect(bp); bp.connect(g); out(g, .3);
      src.start(t); src.stop(t + dur + .2);
      if (up) {
        var o = ctx.createOscillator(), og = ctx.createGain(); o.type = 'triangle';
        o.frequency.setValueAtTime(180, t); o.frequency.exponentialRampToValueAtTime(520, t + dur);
        og.gain.setValueAtTime(0.0001, t);
        og.gain.exponentialRampToValueAtTime(level * .25, t + dur * .8);
        og.gain.exponentialRampToValueAtTime(0.0001, t + dur + .08);
        o.connect(og); out(og, .2); o.start(t); o.stop(t + dur + .1);
      }
    }
    // 2. O F acende: clique de interruptor + grave + acorde brilhante
    function powerOn(t) {
      var c = ctx.createBufferSource(); c.buffer = noise;
      var hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 2200;
      var cg = ctx.createGain(); env(cg, t, .002, .3, .035);
      c.connect(hp); hp.connect(cg); out(cg, .1); c.start(t); c.stop(t + .06);

      var b = ctx.createOscillator(), bg = ctx.createGain(); b.type = 'sine';
      b.frequency.setValueAtTime(140, t); b.frequency.exponentialRampToValueAtTime(52, t + .22);
      env(bg, t, .005, .45, .28); b.connect(bg); out(bg, 0); b.start(t); b.stop(t + .35);

      [440, 554.37, 659.25, 987.77].forEach(function (f, k) {
        var o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'sine';
        o.frequency.value = f; o.detune.value = (k % 2 ? 4 : -4);
        env(g, t + .02, .06, .05, 1.3); o.connect(g); out(g, .6); o.start(t); o.stop(t + 1.5);
      });
    }
    // 3. Cada letra desenhada: uma nota dedilhada subindo (pentatônica de Lá)
    function pluck(t, f) {
      var lp = ctx.createBiquadFilter(); lp.type = 'lowpass';
      lp.frequency.setValueAtTime(5200, t); lp.frequency.exponentialRampToValueAtTime(1400, t + .3);
      var g = ctx.createGain(); env(g, t, .004, .16, .42);
      var o1 = ctx.createOscillator(); o1.type = 'triangle'; o1.frequency.value = f;
      var o2 = ctx.createOscillator(); o2.type = 'sine'; o2.frequency.value = f * 2;
      var g2 = ctx.createGain(); g2.gain.value = .35;
      o1.connect(lp); o2.connect(g2); g2.connect(lp); lp.connect(g); out(g, .45);
      o1.start(t); o2.start(t); o1.stop(t + .5); o2.stop(t + .5);
    }
    // 4. Olho e ponto do "u" surgindo: "pop" de bolha
    function pop(t, f, level) {
      var o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'sine';
      o.frequency.setValueAtTime(f * .55, t); o.frequency.exponentialRampToValueAtTime(f * 1.7, t + .07);
      env(g, t, .004, level, .14); o.connect(g); out(g, .35); o.start(t); o.stop(t + .2);
    }
    // 5. A piscada: "tim" curto e brilhante
    function wink(t) {
      [1760, 2637].forEach(function (f, k) {
        var o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'sine'; o.frequency.value = f;
        env(g, t + k * .045, .003, k ? .06 : .1, .5); o.connect(g); out(g, .7);
        o.start(t + k * .045); o.stop(t + k * .045 + .6);
      });
    }

    var NOTES = [659.25, 739.99, 880, 987.77, 1108.73];
    return {
      ctx: ctx,
      ready: function () { return ctx.state === 'running'; },
      resume: function () { try { return ctx.resume(); } catch (e) { return null; } },
      setVolume: function (v) { master.gain.setTargetAtTime(v, ctx.currentTime, .05); },
      /** Sequência do logo formando, sincronizada com turnOn(). */
      formation: function () {
        if (ctx.state !== 'running') return;
        var t = ctx.currentTime + .02;
        swoosh(t, .72, true, .22);
        powerOn(t + .6);
        NOTES.forEach(function (f, i) { pluck(t + .78 + i * .11, f); });
        pop(t + 1.12, 620, .32);
        pop(t + 1.24, 820, .26);
        wink(t + 2.02);
      },
      /** Logo desligando (laço de carregamento), bem discreto. */
      unform: function () {
        if (ctx.state !== 'running') return;
        swoosh(ctx.currentTime + .3, .7, false, .07);
      }
    };
  }

  /* ---------- Desenho do logo ---------- */
  var F_PATH = 'M38 102A40 40 0 0 1 78 62H182A28 28 0 0 1 182 118H112V275A37 37 0 0 1 38 275Z';
  var ARM_PATH = 'M53 196H120C150 196 162 190 180 178';
  var LETTERS = [
    'M248 88V244Q248 286 288 286',                        // l
    'M354 166V235A51 51 0 0 0 456 235V166',                // u
    'M524 166C574 200 574 252 524 286',                    // x (1)
    'M634 166C584 200 584 252 634 286',                    // x (2)
    'M832 224A66 66 0 1 1 700 224A66 66 0 1 1 832 224'    // o
  ];
  var THEMES = {
    dark:  { bg: '#121016', on: '#FFFFFF', off: '#34303B', track: '#2C2833', knobOff: '#8C8597', halo: 'rgba(143,61,255,.22)', btn: 'rgba(255,255,255,.08)', btnInk: '#CFC8DA' },
    light: { bg: '#F7F4FB', on: '#18161B', off: '#DCD5E6', track: '#E7E1EF', knobOff: '#B9B1C6', halo: 'rgba(143,61,255,.14)', btn: 'rgba(24,22,27,.06)', btnInk: '#4A4453' }
  };

  function ease(t) { return t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }
  function easeOut(t) { return 1 - Math.pow(1 - t, 3); }
  function back(t) { var c = 1.7; return t <= 0 ? 0 : 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); }
  function hexToRgb(h) { var n = parseInt(h.slice(1), 16); return [n >> 16, n >> 8 & 255, n & 255]; }
  function mixColor(a, b, t) {
    var x = hexToRgb(a), y = hexToRgb(b);
    return 'rgb(' + Math.round(x[0] + (y[0] - x[0]) * t) + ',' + Math.round(x[1] + (y[1] - x[1]) * t) + ',' + Math.round(x[2] + (y[2] - x[2]) * t) + ')';
  }

  var ICON_ON = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 5 6 9H3v6h3l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/><path d="M18.5 5.5a9 9 0 0 1 0 13"/></svg>';
  var ICON_OFF = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 5 6 9H3v6h3l5 4z"/><path d="m22 9-6 6"/><path d="m16 9 6 6"/></svg>';

  function buildSVG(id, th) {
    var NS = 'http://www.w3.org/2000/svg';
    var svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', '20 40 855 292');
    svg.setAttribute('aria-hidden', 'true');
    svg.style.cssText = 'display:block;width:100%;height:auto;overflow:visible';
    svg.innerHTML =
      '<defs>' +
        '<linearGradient id="ag' + id + '" gradientUnits="userSpaceOnUse" x1="28" y1="0" x2="196" y2="0"><stop offset="0" stop-color="#6A24F0"/><stop offset=".45" stop-color="#8F3DFF"/><stop offset=".75" stop-color="#EE7BEA"/><stop offset="1" stop-color="#FFB88A"/></linearGradient>' +
        '<linearGradient id="wk' + id + '" gradientUnits="userSpaceOnUse" x1="328" y1="0" x2="403" y2="0"><stop offset="0" stop-color="#EE7BEA"/><stop offset="1" stop-color="#FFB88A"/></linearGradient>' +
        '<linearGradient id="sh' + id + '" gradientUnits="userSpaceOnUse" x1="0" y1="222" x2="0" y2="246"><stop offset="0" stop-color="#1B1030" stop-opacity=".28"/><stop offset="1" stop-color="#1B1030" stop-opacity="0"/></linearGradient>' +
        '<clipPath id="cs' + id + '"><path d="' + F_PATH + '"/></clipPath>' +
        '<filter id="gl' + id + '" filterUnits="userSpaceOnUse" x="-40" y="90" width="320" height="200"><feGaussianBlur stdDeviation="14"/></filter>' +
      '</defs>' +
      '<g data-k="all">' +
        '<path data-k="F" d="' + F_PATH + '" fill="' + th.off + '"/>' +
        '<rect data-k="shade" x="30" y="220" width="90" height="30" fill="url(#sh' + id + ')" clip-path="url(#cs' + id + ')" opacity="0"/>' +
        '<path d="' + ARM_PATH + '" fill="none" stroke="' + th.track + '" stroke-width="50" stroke-linecap="round"/>' +
        '<path data-k="glow" d="' + ARM_PATH + '" fill="none" stroke="url(#ag' + id + ')" stroke-width="50" stroke-linecap="round" filter="url(#gl' + id + ')" opacity="0"/>' +
        '<path data-k="arm" d="' + ARM_PATH + '" fill="none" stroke="url(#ag' + id + ')" stroke-width="50" stroke-linecap="round"/>' +
        '<g data-k="knob"><circle data-k="ring" r="22" fill="#FFB547" opacity="0"/><circle data-k="dot" r="19" cx="-2" cy="2" fill="' + th.knobOff + '"/></g>' +
        '<g fill="none" stroke="' + th.on + '" stroke-width="52" stroke-linecap="round" stroke-linejoin="round">' +
          LETTERS.map(function (d) { return '<path data-k="ch" pathLength="1" d="' + d + '" style="opacity:0"/>'; }).join('') +
        '</g>' +
        '<rect data-k="eye" x="343.5" y="70" width="44" height="44" rx="22" fill="url(#wk' + id + ')" opacity="0"/>' +
        '<circle data-k="dotR" cx="456" cy="92" r="22" fill="#FFB547" opacity="0"/>' +
      '</g>';
    return svg;
  }

  function show(opts) {
    opts = opts || {};
    var th = THEMES[opts.theme] || THEMES.dark;
    var size = opts.size || 420;
    var minLoops = opts.minLoops == null ? 1 : opts.minLoops;
    var reduce = global.matchMedia && global.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var uid = Math.random().toString(36).slice(2, 8);
    var wantSound = opts.sound !== false;
    var volume = opts.volume == null ? .6 : opts.volume;
    var everyLoop = !!opts.soundEveryLoop;
    var sfx = wantSound ? createSound(volume) : null;
    // Escolha do visitante (botão de som) lembrada entre visitas: quem silenciou continua em silêncio.
    var PREF_KEY = 'fluxo-loader-sound';
    function readPref() { try { return global.localStorage.getItem(PREF_KEY); } catch (e) { return null; } }
    function savePref(v) { try { global.localStorage.setItem(PREF_KEY, v); } catch (e) {} }
    var muted = readPref() === 'off', playedOnce = false;
    if (sfx && !sfx.ready()) sfx.resume();
    if (sfx && muted) sfx.setVolume(0);

    var overlay = document.createElement('div');
    overlay.setAttribute('role', 'status');
    overlay.setAttribute('aria-label', opts.label || 'Carregando');
    overlay.style.cssText = 'position:fixed;inset:0;z-index:' + (opts.zIndex || 9999) + ';display:flex;align-items:center;justify-content:center;background:' + th.bg + ';transition:opacity .5s ease;opacity:1';
    var halo = document.createElement('div');
    halo.style.cssText = 'position:absolute;inset:0;pointer-events:none;opacity:0;background:radial-gradient(45% 40% at 50% 50%,' + th.halo + ',transparent 70%)';
    var box = document.createElement('div');
    box.style.cssText = 'position:relative;width:min(' + size + 'px,72vw)';
    var svg = buildSVG(uid, th);
    box.appendChild(svg); overlay.appendChild(halo); overlay.appendChild(box);

    // Botão de som (também serve para liberar o áudio no primeiro toque)
    var btn = null;
    function paintBtn() {
      if (!btn) return;
      var silent = muted || !sfx.ready();
      btn.innerHTML = silent ? ICON_OFF : ICON_ON;
      btn.setAttribute('aria-label', silent ? 'Ativar som' : 'Desativar som');
      btn.setAttribute('aria-pressed', silent ? 'false' : 'true');
    }
    if (sfx && opts.soundButton !== false) {
      btn = document.createElement('button');
      btn.type = 'button';
      btn.style.cssText = 'position:absolute;right:calc(20px + env(safe-area-inset-right,0px));bottom:calc(20px + env(safe-area-inset-bottom,0px));width:44px;height:44px;border-radius:50%;border:0;display:flex;align-items:center;justify-content:center;cursor:pointer;background:' + th.btn + ';color:' + th.btnInk + ';padding:0';
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        if (!sfx.ready()) { muted = false; savePref('on'); sfx.setVolume(volume); var p = sfx.resume(); if (p && p.then) p.then(afterUnlock); }
        else { muted = !muted; savePref(muted ? 'off' : 'on'); sfx.setVolume(muted ? 0 : volume); if (!muted) playLate(); }
        paintBtn();
      });
      overlay.appendChild(btn); paintBtn();
    }
    // Qualquer toque na tela libera o áudio
    function afterUnlock() { paintBtn(); playLate(); }
    function unlock() { if (sfx && !sfx.ready()) { var p = sfx.resume(); if (p && p.then) p.then(afterUnlock); } }
    if (sfx) { overlay.addEventListener('pointerdown', unlock); global.addEventListener('keydown', unlock); }

    (document.body || document.documentElement).appendChild(overlay);

    var q = function (k) { return svg.querySelector('[data-k="' + k + '"]'); };
    var all = q('all'), F = q('F'), shade = q('shade'), glow = q('glow'), arm = q('arm'), knob = q('knob'),
        ring = q('ring'), dot = q('dot'), eye = q('eye'), dotR = q('dotR');
    var chars = [].slice.call(svg.querySelectorAll('[data-k="ch"]'));
    var L = arm.getTotalLength();
    arm.setAttribute('stroke-dasharray', L + ' ' + L); glow.setAttribute('stroke-dasharray', L + ' ' + L);

    var S = { k: 0, f: 0, m: 0, e: 0, w: 0, d: 0, c: [0, 0, 0, 0, 0] };
    var tweens = [], raf = 0, timers = [], on = false, loops = 0, closing = false, finishing = false, resolveHide = null, done = false;

    function render() {
      var p = arm.getPointAtLength(Math.max(.001, S.k) * L);
      knob.setAttribute('transform', 'translate(' + p.x.toFixed(1) + ' ' + p.y.toFixed(1) + ')');
      arm.setAttribute('stroke-dashoffset', (L * (1 - S.k)).toFixed(1)); arm.style.opacity = S.k > .01 ? 1 : 0;
      glow.setAttribute('stroke-dashoffset', (L * (1 - S.k)).toFixed(1)); glow.setAttribute('opacity', (.75 * S.f).toFixed(3));
      F.setAttribute('fill', mixColor(th.off, th.on, S.f)); shade.setAttribute('opacity', (th === THEMES.dark ? S.f : 0).toFixed(3));
      ring.setAttribute('opacity', S.f.toFixed(3)); dot.setAttribute('fill', mixColor(th.knobOff, '#FFFFFF', S.f));
      halo.style.opacity = S.f;
      all.setAttribute('transform', 'translate(' + (331 * (1 - S.m)).toFixed(1) + ' 0)');
      chars.forEach(function (el, i) { var v = S.c[i]; el.style.strokeDasharray = '1 1'; el.style.strokeDashoffset = (1 - v).toFixed(4); el.style.opacity = v > .002 ? 1 : 0; });
      var ww = 44 + 31 * S.w, hh = 44 - 18 * S.w, cy = 92 + 5 * S.w, e = Math.max(0, S.e);
      eye.setAttribute('x', (365.5 - ww / 2).toFixed(2)); eye.setAttribute('y', (cy - hh / 2).toFixed(2));
      eye.setAttribute('width', ww.toFixed(2)); eye.setAttribute('height', hh.toFixed(2)); eye.setAttribute('rx', (hh / 2).toFixed(2));
      eye.setAttribute('transform', 'translate(365.5 ' + cy.toFixed(2) + ') scale(' + e.toFixed(3) + ') translate(-365.5 ' + (-cy).toFixed(2) + ')');
      eye.setAttribute('opacity', e > .002 ? 1 : 0);
      var dd = Math.max(0, S.d);
      dotR.setAttribute('transform', 'translate(456 92) scale(' + dd.toFixed(3) + ') translate(-456 -92)'); dotR.setAttribute('opacity', dd > .002 ? 1 : 0);
    }
    function tween(key, i, to, dur, delay, fn) { tweens.push({ key: key, i: i, to: to, dur: dur, start: performance.now() + delay * 1000, fn: fn || ease, from: null }); }
    function get(tw) { return tw.i == null ? S[tw.key] : S[tw.key][tw.i]; }
    function set(tw, v) { if (tw.i == null) S[tw.key] = v; else S[tw.key][tw.i] = v; }
    function frame(now) {
      tweens = tweens.filter(function (tw) {
        if (now < tw.start) return true;
        if (tw.from === null) tw.from = get(tw);
        var t = Math.min(1, (now - tw.start) / (tw.dur * 1000));
        set(tw, tw.from + (tw.to - tw.from) * tw.fn(t));
        return t < 1;
      });
      render();
      if (!done) raf = requestAnimationFrame(frame);
    }
    function later(fn, ms) { timers.push(setTimeout(fn, ms)); }
    function soundOn() { return sfx && !muted && sfx.ready() && (everyLoop || !playedOnce); }
    // O áudio só foi liberado depois da animação já ter começado: toca a abertura agora (o som segue depois do loader fechar).
    function playLate() { if (!done && on && soundOn()) { sfx.formation(); playedOnce = true; } }

    function turnOn() {
      on = true; tweens = [];
      if (soundOn()) { sfx.formation(); playedOnce = true; }
      tween('k', null, 1, .75, 0); tween('f', null, 1, .35, .6, easeOut); tween('m', null, 1, .9, .6);
      chars.forEach(function (_, i) { tween('c', i, 1, .55, .75 + i * .11, easeOut); });
      tween('e', null, 1, .4, 1.1, back); tween('d', null, 1, .4, 1.22, back); tween('w', null, 1, .22, 2.0, easeOut);
      later(afterOn, 2600);
    }
    function turnOff() {
      on = false; tweens = [];
      if (sfx && !muted && sfx.ready() && (everyLoop || !playedOnce)) sfx.unform();
      tween('e', null, 0, .2, .03); tween('d', null, 0, .2, 0); tween('w', null, 0, .01, .3);
      chars.forEach(function (_, i) { tween('c', i, 0, .35, (4 - i) * .07); });
      tween('f', null, 0, .35, .4); tween('m', null, 0, .7, .3); tween('k', null, 0, .7, .45);
      later(turnOn, 1700);
    }
    function afterOn() {
      loops++;
      if (closing && loops >= minLoops) return finish();
      later(function () { if (closing && loops >= minLoops) finish(); else turnOff(); }, 900);
    }
    function finish() {
      if (finishing) return; finishing = true;
      overlay.style.opacity = '0';
      later(function () {
        done = true; cancelAnimationFrame(raf); timers.forEach(clearTimeout);
        global.removeEventListener('keydown', unlock);
        if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
        if (resolveHide) resolveHide();
      }, 520);
    }

    if (reduce) {
      S = { k: 1, f: 1, m: 1, e: 1, w: 1, d: 1, c: [1, 1, 1, 1, 1] }; loops = minLoops; render();
    } else {
      render(); raf = requestAnimationFrame(frame); later(turnOn, 300);
    }

    var hidePromise = new Promise(function (r) { resolveHide = r; });
    return {
      element: overlay,
      /** Fecha a tela assim que a animação do logo terminar (nunca corta no meio). */
      hide: function () {
        if (closing) return hidePromise;
        closing = true;
        if (reduce || (on && loops >= minLoops && !tweens.length)) finish();
        return hidePromise;
      },
      /** Remove na hora, sem esperar a animação. */
      destroy: function () { closing = true; finish(); return hidePromise; },
      /** Liga/desliga o som. */
      mute: function (v) { muted = v !== false; if (sfx) sfx.setVolume(muted ? 0 : volume); paintBtn(); }
    };
  }

  global.FluxoLoader = { show: show };
})(typeof window !== 'undefined' ? window : this);
