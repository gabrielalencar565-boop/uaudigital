/* =========================================================================
   o plano. — script da landing page (sem dependências)
   ========================================================================= */

/* -------------------------------------------------------------------------
   CONFIGURAÇÃO — edite só este bloco.
   Os valores aqui substituem os textos marcados com data-cfg no HTML
   e o link de todos os botões de compra (data-checkout).
   ------------------------------------------------------------------------- */
const CONFIG = {
  checkoutUrl: "[LINK KIWIFY]",          // ex.: "https://pay.kiwify.com.br/XXXXXXX"
  installments: "[12x de R$ X]",         // ex.: "12x de R$ 19,70"
  cashPrice: "[PREÇO DE ABERTURA]",      // ex.: "R$ 197"
  normalPrice: "[PREÇO NORMAL]",         // ex.: "R$ 297"
  deadline: "[DATA]",                    // ex.: "30/11"
  guarantee: "[7 DIAS]",                 // ex.: "7 dias"

  // Vídeo de apresentação. Aceita link de embed do YouTube/Vimeo
  // (ex.: "https://www.youtube-nocookie.com/embed/ID_DO_VIDEO")
  // ou um arquivo .mp4 (ex.: "video/apresentacao.mp4"). Vazio = mostra o espaço reservado.
  videoEmbedUrl: "",

  // Repassa os parâmetros de campanha (utm_*, src, sck, fbclid) da URL da página
  // para o checkout da Kiwify, para a venda ser atribuída ao anúncio/origem certa.
  forwardTrackingParams: true,
};

(function () {
  "use strict";

  const isPlaceholder = (v) => !v || /^\[.*\]$/.test(String(v).trim());

  /* ---------- Textos de preço/prazo ---------- */
  document.querySelectorAll("[data-cfg]").forEach((el) => {
    const value = CONFIG[el.dataset.cfg];
    if (value) el.textContent = value;
  });
  document.querySelectorAll("[data-year]").forEach((el) => { el.textContent = new Date().getFullYear(); });

  /* ---------- Link do checkout (+ UTMs) ---------- */
  function buildCheckoutUrl() {
    if (isPlaceholder(CONFIG.checkoutUrl)) return null;
    let url;
    try { url = new URL(CONFIG.checkoutUrl, location.href); } catch (e) { return CONFIG.checkoutUrl; }
    if (CONFIG.forwardTrackingParams) {
      const params = new URLSearchParams(location.search);
      params.forEach((value, key) => {
        if (/^(utm_|src$|sck$|fbclid$)/.test(key) && !url.searchParams.has(key)) url.searchParams.set(key, value);
      });
    }
    return url.toString();
  }

  const checkoutUrl = buildCheckoutUrl();
  if (!checkoutUrl) console.warn("[o plano.] Defina CONFIG.checkoutUrl no script.js — os botões estão levando para a oferta.");

  document.querySelectorAll("[data-checkout]").forEach((btn) => {
    btn.href = checkoutUrl || "#oferta";
    btn.addEventListener("click", () => {
      // Evento do Pixel da Meta (só dispara se o Pixel estiver instalado no <head>)
      if (typeof window.fbq === "function") {
        window.fbq("track", "InitiateCheckout", {
          content_name: "o plano.",
          currency: "BRL",
        });
      }
    });
  });

  /* ---------- Imagens de espaço reservado ----------
     Se o arquivo ainda não existe, esconde a <img> e mostra o rótulo. */
  document.querySelectorAll("img[data-ph]").forEach((img) => {
    const markMissing = () => img.classList.add("is-missing");
    if (img.complete && img.naturalWidth === 0) markMissing();
    else img.addEventListener("error", markMissing, { once: true });
  });

  /* ---------- Vídeo de apresentação (abre numa janela, carrega só no clique) ---------- */
  const openBtn = document.querySelector("[data-video-open]");
  const modal = document.querySelector("[data-video-modal]");
  const box = document.querySelector("[data-video-box]");
  if (CONFIG.videoEmbedUrl && openBtn && modal && box && typeof modal.showModal === "function") {
    openBtn.hidden = false;
    const src = CONFIG.videoEmbedUrl;
    openBtn.addEventListener("click", () => {
      let media;
      if (/\.(mp4|webm)(\?|$)/i.test(src)) {
        media = document.createElement("video");
        media.src = src;
        media.controls = true;
        media.autoplay = true;
        media.playsInline = true;
      } else {
        media = document.createElement("iframe");
        const u = new URL(src, location.href);
        u.searchParams.set("autoplay", "1");
        media.src = u.toString();
        media.title = "Vídeo de apresentação do o plano.";
        media.allow = "autoplay; fullscreen; picture-in-picture; encrypted-media";
        media.allowFullscreen = true;
      }
      box.replaceChildren(media);
      modal.showModal();
    });
    const close = () => modal.close();
    modal.querySelector("[data-video-close]").addEventListener("click", close);
    modal.addEventListener("click", (e) => { if (e.target === modal) close(); });
    modal.addEventListener("close", () => box.replaceChildren()); // para o vídeo ao fechar
  }

  /* ---------- Palavra que alterna (bento) ---------- */
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  document.querySelectorAll("[data-rotator]").forEach((el) => {
    const words = el.dataset.rotator.split("|");
    if (reduceMotion || words.length < 2) return;
    let i = 0;
    setInterval(() => {
      el.classList.add("is-out");
      setTimeout(() => {
        i = (i + 1) % words.length;
        el.textContent = words[i];
        el.classList.remove("is-out");
      }, 350);
    }, 2200);
  });

  /* ---------- Carrossel de bônus (bolinhas) ---------- */
  document.querySelectorAll("[data-carousel]").forEach((track) => {
    const dotsWrap = track.parentElement.querySelector("[data-dots]");
    const cards = [...track.children];
    if (!dotsWrap || cards.length < 2) return;
    const dots = cards.map((card, idx) => {
      const b = document.createElement("button");
      b.type = "button";
      b.tabIndex = -1;
      b.addEventListener("click", () => track.scrollTo({ left: card.offsetLeft - track.offsetLeft - parseFloat(getComputedStyle(track).paddingLeft), behavior: "smooth" }));
      dotsWrap.appendChild(b);
      return b;
    });
    const setActive = () => {
      const max = track.scrollWidth - track.clientWidth;
      const idx = max <= 0 ? 0 : Math.round((track.scrollLeft / max) * (cards.length - 1));
      dots.forEach((d, k) => d.setAttribute("aria-current", k === idx ? "true" : "false"));
      dotsWrap.hidden = max <= 0;
    };
    track.addEventListener("scroll", () => requestAnimationFrame(setActive), { passive: true });
    addEventListener("resize", setActive);
    setActive();
  });

  /* ---------- Barra de compra fixa (mobile) ----------
     Aparece depois que o hero sai da tela; some quando a oferta
     ou o CTA final estão visíveis (para não duplicar o botão). */
  const sticky = document.querySelector("[data-sticky]");
  const hero = document.querySelector(".hero");
  const blockers = [document.querySelector(".offer"), document.querySelector("#cta-final")].filter(Boolean);

  if (sticky && hero && "IntersectionObserver" in window) {
    const state = { heroVisible: true, blocked: new Set() };
    const stickyBtn = sticky.querySelector("a");
    const update = () => {
      const show = !state.heroVisible && state.blocked.size === 0;
      sticky.classList.toggle("is-visible", show);
      sticky.setAttribute("aria-hidden", show ? "false" : "true");
      if (stickyBtn) stickyBtn.tabIndex = show ? 0 : -1;
    };
    new IntersectionObserver(([entry]) => {
      state.heroVisible = entry.isIntersecting;
      update();
    }).observe(hero);

    const blockObs = new IntersectionObserver((entries) => {
      entries.forEach((e) => (e.isIntersecting ? state.blocked.add(e.target) : state.blocked.delete(e.target)));
      update();
    });
    blockers.forEach((b) => blockObs.observe(b));
  }

  /* ---------- Animação de entrada ---------- */
  const reveals = document.querySelectorAll(".reveal");
  if ("IntersectionObserver" in window && !reduceMotion) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) { e.target.classList.add("is-in"); io.unobserve(e.target); }
      });
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.05 });
    reveals.forEach((el) => io.observe(el));
  } else {
    reveals.forEach((el) => el.classList.add("is-in"));
  }
})();
