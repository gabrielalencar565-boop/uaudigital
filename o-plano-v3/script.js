/* =========================================================================
   o plano. — versão 3 · script (sem dependências)
   ========================================================================= */

/* CONFIGURAÇÃO — edite só este bloco ------------------------------------- */
const CONFIG = {
  checkoutUrl: "[LINK KIWIFY]",          // ex.: "https://pay.kiwify.com.br/XXXXXXX"
  installments: "[12x de R$ X]",         // ex.: "12x de R$ 19,70"
  cashPrice: "[PREÇO DE ABERTURA]",      // ex.: "R$ 197"
  normalPrice: "[PREÇO NORMAL]",         // ex.: "R$ 297"
  deadline: "[DATA]",                    // ex.: "30/11"
  // Fim do preço de abertura para o contador da faixa do topo. Vazio = sem contador.
  deadlineISO: "",                       // ex.: "2026-11-30T23:59:00-03:00"
  guarantee: "[7 DIAS]",                 // ex.: "7 dias"
  // Vídeo de vendas: embed do YouTube/Vimeo ou arquivo .mp4
  videoEmbedUrl: "",                     // ex.: "https://www.youtube-nocookie.com/embed/XXXX"
  // Repassa utm_*, src, sck e fbclid da URL da página para o checkout.
  forwardTrackingParams: true,
};

(function () {
  "use strict";
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const hasIO = "IntersectionObserver" in window;
  const isPlaceholder = (v) => !v || /^\[.*\]$/.test(String(v).trim());

  /* Link de compra (com os parâmetros de rastreio da URL) */
  const toCheckoutUrl = () => {
    if (isPlaceholder(CONFIG.checkoutUrl)) return null;
    try {
      const url = new URL(CONFIG.checkoutUrl, location.href);
      if (CONFIG.forwardTrackingParams) {
        new URLSearchParams(location.search).forEach((v, k) => {
          if (/^(utm_|src$|sck$|fbclid$)/.test(k) && !url.searchParams.has(k)) url.searchParams.set(k, v);
        });
      }
      return url.toString();
    } catch (e) { return CONFIG.checkoutUrl; }
  };

  /* Contador da faixa do topo */
  let cdTimer = null;
  const startCountdown = () => {
    const box = $("[data-countdown]");
    if (!box) return;
    clearInterval(cdTimer);
    const end = CONFIG.deadlineISO ? new Date(CONFIG.deadlineISO).getTime() : NaN;
    const tick = () => {
      const left = end - Date.now();
      if (!(left > 0)) { box.hidden = true; clearInterval(cdTimer); return; }
      const m = Math.floor(left / 60000);
      $('[data-cd="d"]', box).textContent = String(Math.floor(m / 1440)).padStart(2, "0") + "d";
      $('[data-cd="h"]', box).textContent = String(Math.floor((m % 1440) / 60)).padStart(2, "0") + "h";
      $('[data-cd="m"]', box).textContent = String(m % 60).padStart(2, "0") + "m";
      box.hidden = false;
    };
    tick();
    if (end > Date.now()) cdTimer = setInterval(tick, 20000);
  };

  /* Preços, prazo, garantia, vídeo e links (também usado pelo modo de edição) */
  const applyConfig = (patch) => {
    if (patch) Object.keys(patch).forEach((k) => { if (k in CONFIG && patch[k] != null) CONFIG[k] = patch[k]; });
    $$("[data-cfg]").forEach((el) => { const v = CONFIG[el.dataset.cfg]; if (v) el.textContent = v; });
    const href = toCheckoutUrl();
    $$("[data-checkout]").forEach((a) => { a.href = href || "#oferta"; });
    const ph = $("[data-vsl-ph]");
    if (ph) ph.hidden = !!CONFIG.videoEmbedUrl;
    startCountdown();
    return href;
  };
  window.OPLANO = { config: CONFIG, applyConfig };
  if (!applyConfig()) console.warn("[o plano.] Defina CONFIG.checkoutUrl no script.js — os botões estão levando para a oferta.");
  $$("[data-year]").forEach((el) => { el.textContent = new Date().getFullYear(); });
  $$("[data-checkout]").forEach((a) => a.addEventListener("click", () => {
    if (typeof window.fbq === "function") window.fbq("track", "InitiateCheckout", { content_name: "o plano. v3", currency: "BRL" });
  }));

  /* Vídeo de vendas: troca a capa pelo player ao clicar */
  const vsl = $("[data-vsl]"), play = $("[data-vsl-play]");
  if (vsl && play) {
    play.addEventListener("click", () => {
      const src = CONFIG.videoEmbedUrl;
      if (!src) return;
      let media;
      if (/\.(mp4|webm)(\?|$)/i.test(src)) {
        media = Object.assign(document.createElement("video"), { src, controls: true, autoplay: true, playsInline: true });
      } else {
        const u = new URL(src, location.href); u.searchParams.set("autoplay", "1");
        media = Object.assign(document.createElement("iframe"), { src: u.toString(), title: "Vídeo de apresentação do o plano.", allow: "autoplay; fullscreen; picture-in-picture; encrypted-media", allowFullscreen: true });
      }
      vsl.replaceChildren(media);
    });
  }

  /* Antes × depois: alterna o calendário; vira sozinho na primeira vez que aparece */
  const board = $("[data-board]");
  if (board) {
    const bb = $$("[data-board-set]", board);
    let touched = false;
    const set = (st) => { board.dataset.state = st; bb.forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.boardSet === st))); };
    bb.forEach((b) => b.addEventListener("click", () => { touched = true; set(b.dataset.boardSet); }));
    if (hasIO && !reduceMotion) {
      const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { io.disconnect(); setTimeout(() => { if (!touched) set("plan"); }, 1400); } }, { threshold: 0.5 });
      io.observe($(".board__frame", board));
    }
  }

  /* Depoimentos em vídeo: toca um por vez, com som */
  const reels = $$(".reel");
  const stopAll = (except) => reels.forEach((r) => {
    const v = $("video", r);
    if (r !== except && !v.paused) { v.pause(); r.classList.remove("is-playing"); v.controls = false; }
  });
  reels.forEach((r) => {
    const v = $("video", r), btn = $("[data-reel]", r);
    btn.addEventListener("click", () => {
      stopAll(r);
      v.muted = false; v.controls = true;
      r.classList.add("is-playing");
      v.play().catch(() => {});
    });
    v.addEventListener("ended", () => { r.classList.remove("is-playing"); v.controls = false; v.load(); });
    v.addEventListener("pause", () => { if (v.ended) return; });
  });

  /* Carrossel dos depoimentos (celular e tablet) */
  const track = $("[data-car-track]");
  if (track) {
    const bar = $("[data-car-bar]"), prev = $("[data-car-prev]"), next = $("[data-car-next]");
    const upd = () => {
      const max = track.scrollWidth - track.clientWidth;
      const vis = Math.max((track.clientWidth / track.scrollWidth) * 100, 14);
      bar.style.width = vis + "%";
      bar.style.left = (max > 0 ? (track.scrollLeft / max) * (100 - vis) : 0) + "%";
      prev.disabled = track.scrollLeft <= 2;
      next.disabled = track.scrollLeft >= max - 2;
    };
    const step = () => (track.firstElementChild ? track.firstElementChild.getBoundingClientRect().width + 16 : 300);
    prev.addEventListener("click", () => track.scrollBy({ left: -step(), behavior: reduceMotion ? "auto" : "smooth" }));
    next.addEventListener("click", () => track.scrollBy({ left: step(), behavior: reduceMotion ? "auto" : "smooth" }));
    track.addEventListener("scroll", upd, { passive: true });
    addEventListener("resize", upd);
    upd();
  }

  /* Método: cada etapa mostra a sua tela da plataforma */
  const steps = $$("[data-step]"), panes = $$("[data-pane]");
  steps.forEach((b) => b.addEventListener("click", () => {
    const i = +b.dataset.step;
    steps.forEach((s) => s.setAttribute("aria-selected", String(s === b)));
    panes.forEach((p) => { p.hidden = +p.dataset.pane !== i; });
    const list = b.closest(".steps");
    if (list.scrollWidth > list.clientWidth) list.scrollTo({ left: b.parentElement.offsetLeft - 16, behavior: reduceMotion ? "auto" : "smooth" });
  }));

  /* Barra de compra fixa (celular): aparece depois do topo e some na oferta e no fim */
  const sticky = $("[data-sticky]"), hero = $(".hero");
  if (sticky && hero && hasIO) {
    const st = { hero: true, blocked: new Set() };
    const btn = $("a", sticky);
    const upd = () => {
      const show = !st.hero && st.blocked.size === 0;
      sticky.classList.toggle("is-visible", show);
      sticky.setAttribute("aria-hidden", String(!show));
      if (btn) btn.tabIndex = show ? 0 : -1;
    };
    new IntersectionObserver(([e]) => { st.hero = e.isIntersecting; upd(); }).observe(hero);
    const bo = new IntersectionObserver((es) => { es.forEach((e) => (e.isIntersecting ? st.blocked.add(e.target) : st.blocked.delete(e.target))); upd(); });
    [$(".offer__r"), $(".final")].filter(Boolean).forEach((el) => bo.observe(el));
  }
})();
