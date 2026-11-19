/* =========================================================================
   o plano. — versão 2 · script (sem dependências)
   ========================================================================= */

/* CONFIGURAÇÃO — edite só este bloco ------------------------------------- */
const CONFIG = {
  checkoutUrl: "[LINK KIWIFY]",          // ex.: "https://pay.kiwify.com.br/XXXXXXX"
  installments: "[12x de R$ X]",         // ex.: "12x de R$ 19,70"
  cashPrice: "[PREÇO DE ABERTURA]",      // ex.: "R$ 197"
  normalPrice: "[PREÇO NORMAL]",         // ex.: "R$ 297"
  deadline: "[DATA]",                    // ex.: "30/11"
  guarantee: "[7 DIAS]",                 // ex.: "7 dias"
  // Vídeo de apresentação: embed do YouTube/Vimeo ou arquivo .mp4. Vazio = botão escondido.
  videoEmbedUrl: "",
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

  /* Textos de preço/prazo */
  $$("[data-cfg]").forEach((el) => { const v = CONFIG[el.dataset.cfg]; if (v) el.textContent = v; });
  $$("[data-year]").forEach((el) => { el.textContent = new Date().getFullYear(); });

  /* Checkout + UTMs + Pixel */
  let checkoutUrl = null;
  if (!isPlaceholder(CONFIG.checkoutUrl)) {
    try {
      const url = new URL(CONFIG.checkoutUrl, location.href);
      if (CONFIG.forwardTrackingParams) {
        new URLSearchParams(location.search).forEach((v, k) => {
          if (/^(utm_|src$|sck$|fbclid$)/.test(k) && !url.searchParams.has(k)) url.searchParams.set(k, v);
        });
      }
      checkoutUrl = url.toString();
    } catch (e) { checkoutUrl = CONFIG.checkoutUrl; }
  } else {
    console.warn("[o plano.] Defina CONFIG.checkoutUrl no script.js — os botões estão levando para a oferta.");
  }
  $$("[data-checkout]").forEach((a) => {
    a.href = checkoutUrl || "#oferta";
    a.addEventListener("click", () => {
      if (typeof window.fbq === "function") window.fbq("track", "InitiateCheckout", { content_name: "o plano.", currency: "BRL" });
    });
  });

  /* Imagens que ainda não existem: mostra o rótulo do espaço reservado */
  $$("img[data-ph]").forEach((img) => {
    const miss = () => img.classList.add("is-missing");
    if (img.complete && img.naturalWidth === 0) miss(); else img.addEventListener("error", miss, { once: true });
  });

  /* Vídeo em janela */
  const openBtn = $("[data-video-open]"), modal = $("[data-video-modal]"), box = $("[data-video-box]");
  if (CONFIG.videoEmbedUrl && openBtn && modal && typeof modal.showModal === "function") {
    openBtn.hidden = false;
    openBtn.addEventListener("click", () => {
      const src = CONFIG.videoEmbedUrl;
      let media;
      if (/\.(mp4|webm)(\?|$)/i.test(src)) {
        media = Object.assign(document.createElement("video"), { src, controls: true, autoplay: true, playsInline: true });
      } else {
        const u = new URL(src, location.href); u.searchParams.set("autoplay", "1");
        media = Object.assign(document.createElement("iframe"), { src: u.toString(), title: "Vídeo de apresentação do o plano.", allow: "autoplay; fullscreen; picture-in-picture; encrypted-media", allowFullscreen: true });
      }
      box.replaceChildren(media);
      modal.showModal();
    });
    $("[data-video-close]", modal).addEventListener("click", () => modal.close());
    modal.addEventListener("click", (e) => { if (e.target === modal) modal.close(); });
    modal.addEventListener("close", () => box.replaceChildren());
  }

  /* Antes × depois: alterna o calendário. Vira sozinho a primeira vez que aparece. */
  const board = $("[data-board]");
  if (board) {
    const btns = $$("[data-board-set]", board);
    let touched = false;
    const set = (state) => {
      board.dataset.state = state;
      btns.forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.boardSet === state)));
    };
    btns.forEach((b) => b.addEventListener("click", () => { touched = true; set(b.dataset.boardSet); }));
    if (hasIO && !reduceMotion) {
      const io = new IntersectionObserver(([e]) => {
        if (e.isIntersecting) { io.disconnect(); setTimeout(() => { if (!touched) set("plan"); }, 1400); }
      }, { threshold: 0.5 });
      io.observe($(".board__frame", board));
    }
  }

  /* Módulos: painel fixo acompanha o módulo que está no meio da tela */
  const steps = $$(".step");
  const numEl = $("[data-step-num]"), titleEl = $("[data-step-title]"), barEl = $("[data-step-bar]");
  if (steps.length && hasIO) {
    const activate = (step) => {
      steps.forEach((s) => s.classList.toggle("is-active", s === step));
      const idx = steps.indexOf(step);
      if (numEl) numEl.textContent = step.dataset.step;
      if (titleEl) titleEl.textContent = step.dataset.title;
      if (barEl) barEl.style.width = ((idx + 1) / steps.length) * 100 + "%";
    };
    activate(steps[0]);
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => { if (e.isIntersecting) activate(e.target); });
    }, { rootMargin: "-45% 0px -45% 0px" });
    steps.forEach((s) => io.observe(s));
  }

  /* Barra de compra fixa (mobile): depois do hero, some na oferta e no CTA final */
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
    [$(".offer"), $("#cta-final")].filter(Boolean).forEach((el) => bo.observe(el));
  }

  /* Revelar ao rolar */
  const reveals = $$(".reveal");
  if (hasIO && !reduceMotion) {
    const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("is-in"); io.unobserve(e.target); } }), { rootMargin: "0px 0px -10% 0px", threshold: 0.08 });
    reveals.forEach((el) => io.observe(el));
  } else {
    reveals.forEach((el) => el.classList.add("is-in"));
  }
})();
