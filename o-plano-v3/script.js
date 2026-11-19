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

  /* Preço, prazo, garantia, vídeo e link de compra (também usado pelo modo de edição) */
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
      box.querySelector('[data-cd="d"]').textContent = String(Math.floor(m / 1440)).padStart(2, "0") + "d";
      box.querySelector('[data-cd="h"]').textContent = String(Math.floor((m % 1440) / 60)).padStart(2, "0") + "h";
      box.querySelector('[data-cd="m"]').textContent = String(m % 60).padStart(2, "0") + "m";
      box.hidden = false;
    };
    tick();
    if (end > Date.now()) cdTimer = setInterval(tick, 20000);
  };

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
  $$("[data-checkout]").forEach((a) => {
    a.addEventListener("click", () => {
      if (typeof window.fbq === "function") window.fbq("track", "InitiateCheckout", { content_name: "o plano.", currency: "BRL" });
    });
  });

  /* Imagens que ainda não existem: mostra o rótulo do espaço reservado */
  $$("img[data-ph]").forEach((img) => {
    const miss = () => img.classList.add("is-missing");
    if (img.complete && img.naturalWidth === 0) miss(); else img.addEventListener("error", miss, { once: true });
  });

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

  /* Carrossel de resultados: setas + barra de progresso */
  const car = $("[data-carousel]");
  if (car) {
    const track = $("[data-carousel-track]", car), bar = $("[data-carousel-bar]", car);
    const prev = $("[data-carousel-prev]", car), next = $("[data-carousel-next]", car);
    const step = () => { const c = track.firstElementChild; return c ? c.getBoundingClientRect().width + 14 : 300; };
    const upd = () => {
      const max = track.scrollWidth - track.clientWidth;
      const vis = track.scrollWidth ? track.clientWidth / track.scrollWidth : 1;
      bar.style.width = Math.max(vis * 100, 12) + "%";
      bar.style.left = (max > 0 ? (track.scrollLeft / max) * (100 - Math.max(vis * 100, 12)) : 0) + "%";
      prev.disabled = track.scrollLeft <= 2;
      next.disabled = track.scrollLeft >= max - 2;
    };
    prev.addEventListener("click", () => track.scrollBy({ left: -step(), behavior: reduceMotion ? "auto" : "smooth" }));
    next.addEventListener("click", () => track.scrollBy({ left: step(), behavior: reduceMotion ? "auto" : "smooth" }));
    track.addEventListener("scroll", upd, { passive: true });
    addEventListener("resize", upd);
    upd();
  }

  /* Plataforma por dentro: abas */
  const tabs = $("[data-tabs]");
  if (tabs) {
    const btns = $$("[data-tab]", tabs), panes = $$("[data-pane]", tabs);
    const side = $$(".window__side span", tabs), desc = $("[data-tab-desc]", tabs);
    let auto = null;
    const show = (i) => {
      btns.forEach((b, j) => b.setAttribute("aria-selected", String(i === j)));
      panes.forEach((p, j) => { p.hidden = i !== j; p.classList.toggle("is-on", i === j); });
      side.forEach((s, j) => s.classList.toggle("is-on", i === j));
      if (desc) desc.textContent = panes[i].dataset.desc || "";
      const b = btns[i];
      if (b && b.parentElement.scrollWidth > b.parentElement.clientWidth) b.parentElement.scrollTo({ left: b.offsetLeft - 16, behavior: "smooth" });
    };
    btns.forEach((b, i) => b.addEventListener("click", () => { clearInterval(auto); auto = null; show(i); }));
    // Passa sozinho pelas abas enquanto está na tela, até a pessoa clicar numa
    if (hasIO && !reduceMotion) {
      let cur = 0, started = false;
      new IntersectionObserver(([e]) => {
        if (e.isIntersecting && !started) {
          started = true;
          auto = setInterval(() => { cur = (cur + 1) % btns.length; show(cur); }, 4200);
        } else if (!e.isIntersecting && auto) { clearInterval(auto); auto = null; started = false; }
      }, { threshold: 0.45 }).observe($(".window", tabs));
      btns.forEach((b) => b.addEventListener("click", () => { started = true; }));
    }
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
    [$(".price"), $("#cta-final")].filter(Boolean).forEach((el) => bo.observe(el));
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
