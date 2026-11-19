/* =========================================================================
   o plano. — MODO DE EDIÇÃO
   Para abrir: acrescente  ?editar  no fim do endereço da página
   (ex.: seusite.com.br/?editar). No link do Claude, o botão aparece
   sozinho para quem é dono da página.

   No modo de edição você pode:
   • clicar em qualquer texto e reescrever;
   • mudar o tamanho de um texto;
   • clicar numa imagem para trocar a foto, mudar o tamanho e a descrição;
   • alterar preço, parcelamento, data, garantia, link da Kiwify e vídeo.

   As alterações ficam guardadas no arquivo  edicoes.js.  Depois de editar,
   clique em "Baixar edicoes.js" e substitua o arquivo da pasta.
   ========================================================================= */
(function () {
  "use strict";
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];

  const DB_PATH = "edicoes/pagina";
  const TEXT_SEL = "h1,h2,h3,p,li,summary,q,figcaption,a.btn,.badge,.card__tag,.stage__chips span,.ticker__track span";
  const SKIP_SEL = ".brand, .board, [data-cfg], .sticky-buy, .video-modal, .ed-ui, .ph-label, .final__marquee, .hero__p";
  const CFG_FIELDS = [
    ["checkoutUrl", "Link da Kiwify (checkout)", "https://pay.kiwify.com.br/..."],
    ["installments", "Parcelamento", "12x de R$ 19,70"],
    ["cashPrice", "Preço à vista (abertura)", "R$ 197"],
    ["normalPrice", "Preço normal (riscado)", "R$ 297"],
    ["deadline", "Preço de abertura válido até", "30/11"],
    ["guarantee", "Garantia", "7 dias"],
    ["videoEmbedUrl", "Vídeo da apresentação (link de embed do YouTube)", "https://www.youtube-nocookie.com/embed/..."],
  ];

  let state = blank();
  let texts = [], images = [], blocks = [];
  const BLOCK_SEL = ".brand, .hero__ring, .hero__p"; // só posição/largura (logo, círculo e P da capa)
  let caps = { db: null, assets: null, downloads: null, canWrite: false, inArtifact: false };
  let selected = null, dirty = false;

  function blank() { return { texts: {}, textScale: {}, images: {}, config: {}, layout: {} }; }
  function merge(base, extra) {
    const out = blank();
    [base, extra].forEach((src) => {
      if (!src) return;
      ["texts", "textScale", "images", "config", "layout"].forEach((k) => Object.assign(out[k], src[k] || {}));
    });
    return out;
  }

  /* ---------- Sanitização: só texto e marcações simples ---------- */
  const ALLOWED = new Set(["B", "STRONG", "EM", "I", "S", "BR", "SMALL", "SPAN"]);
  function clean(html) {
    const doc = new DOMParser().parseFromString("<div>" + html + "</div>", "text/html");
    const walk = (node) => {
      [...node.childNodes].forEach((ch) => {
        if (ch.nodeType === 1) {
          if (!ALLOWED.has(ch.tagName)) { walk(ch); ch.replaceWith(...ch.childNodes); return; }
          [...ch.attributes].forEach((a) => { if (!(ch.tagName === "SPAN" && a.name === "class" && /^[\w\s-]*$/.test(a.value))) ch.removeAttribute(a.name); });
          walk(ch);
        } else if (ch.nodeType !== 3) ch.remove();
      });
    };
    const root = doc.body.firstChild;
    walk(root);
    return root.innerHTML;
  }

  /* ---------- Mapear textos e imagens editáveis ---------- */
  function index() {
    const scope = [$("main"), $("footer")].filter(Boolean);
    const cands = scope.flatMap((r) => $$(TEXT_SEL, r)).filter((el) => !el.closest(SKIP_SEL) && el.textContent.trim());
    const set = new Set(cands);
    texts = cands.filter((el) => ![...el.querySelectorAll(TEXT_SEL)].some((d) => set.has(d)));
    texts.forEach((el, i) => { el.dataset.edT = "t" + i; });
    images = scope.flatMap((r) => $$("img", r)).filter((img) => !img.closest(".ed-ui"));
    images.forEach((img, i) => { img.dataset.edI = "i" + i; });
    blocks = $$(BLOCK_SEL);
    blocks.forEach((el, i) => { el.dataset.edB = "b" + i; });
  }

  function scaleTarget(img) {
    return img.closest(".hero__art") || img.closest(".teacher__media") || null;
  }
  // elemento que se move/estica quando você ajusta largura, X, Y e espaços
  function boxOf(el) {
    if (el.dataset.edT || el.dataset.edB) return el;
    return scaleTarget(el) || el.closest(".card") || el.closest(".quote__av, .sheet__screen, .ph") || el;
  }
  const LAYOUT = [
    ["w", "Largura", 30, 160, 1, "%", 100],
    ["x", "Mover para os lados (X)", -300, 300, 2, "px", 0],
    ["y", "Mover para cima/baixo (Y)", -300, 300, 2, "px", 0],
    ["mt", "Espaço acima", -120, 240, 2, "px", 0],
    ["mb", "Espaço abaixo", -120, 240, 2, "px", 0],
  ];
  function applyLayout(box, l) {
    l = l || {};
    const flexChild = box.parentElement && getComputedStyle(box.parentElement).display.includes("flex");
    if (l.w != null && l.w !== 100) {
      box.style.width = l.w + "%"; box.style.maxWidth = "none";
      if (flexChild) box.style.flex = "0 0 " + l.w + "%";
    } else { box.style.width = ""; box.style.maxWidth = ""; box.style.flex = ""; }
    box.style.translate = (l.x || l.y) ? (l.x || 0) + "px " + (l.y || 0) + "px" : "";
    box.style.marginTop = l.mt ? l.mt + "px" : "";
    box.style.marginBottom = l.mb ? l.mb + "px" : "";
  }
  function layoutControls(k) {
    const l = state.layout[k] || {};
    return '<p class="ed-panel__sub">Largura, posição e espaço</p>' + LAYOUT.map(([f, label, min, max, step, unit, def]) => {
      const v = l[f] != null ? l[f] : def;
      return `<label class="ed-field">${label} <output>${v}${unit}</output>
        <input type="range" min="${min}" max="${max}" step="${step}" value="${v}" data-lay="${f}" data-unit="${unit}" data-def="${def}"></label>`;
    }).join("");
  }
  function bindLayout(k, box) {
    $$("[data-lay]", ui.panel).forEach((r) => r.addEventListener("input", () => {
      const f = r.dataset.lay, v = parseFloat(r.value), def = parseFloat(r.dataset.def);
      r.previousElementSibling.textContent = v + r.dataset.unit;
      const l = Object.assign({}, state.layout[k]);
      if (v === def) delete l[f]; else l[f] = v;
      if (Object.keys(l).length) state.layout[k] = l; else delete state.layout[k];
      applyLayout(box, state.layout[k]); markDirty();
    }));
  }

  /* ---------- Aplicar alterações ---------- */
  function apply() {
    texts.forEach((el) => {
      const k = el.dataset.edT;
      if (k in state.texts) el.innerHTML = clean(state.texts[k]);
      el.style.fontSize = state.textScale[k] ? state.textScale[k] + "em" : "";
      if (el.matches(".step h3")) { const li = el.closest(".step"); if (li) li.dataset.title = el.textContent.trim(); }
      if (state.layout[k]) applyLayout(el, state.layout[k]);
    });
    images.forEach((img) => {
      if (state.layout[img.dataset.edI]) applyLayout(boxOf(img), state.layout[img.dataset.edI]);
      const d = state.images[img.dataset.edI];
      if (!d) return;
      if (d.src) {
        img.src = d.src;
        img.classList.remove("is-missing");
        const pic = img.closest("picture");
        if (pic) $$("source", pic).forEach((s) => s.remove()); // uma imagem só para celular e computador
      }
      if (d.alt != null) img.alt = d.alt;
      const t = scaleTarget(img);
      if (t) t.style.setProperty("--s", d.scale || 1);
      else img.style.transform = d.scale && d.scale !== 1 ? "scale(" + d.scale + ")" : "";
    });
    blocks.forEach((el) => { if (state.layout[el.dataset.edB]) applyLayout(el, state.layout[el.dataset.edB]); });
    if (window.OPLANO && Object.keys(state.config).length) window.OPLANO.applyConfig(state.config);
  }

  /* ---------- Interface ---------- */
  let ui = {};
  function buildUI() {
    const wrap = document.createElement("div");
    wrap.className = "ed-ui";
    wrap.innerHTML = `
      <button type="button" class="ed-fab" data-ed="open">✎ Editar página</button>
      <div class="ed-bar" hidden>
        <strong class="ed-bar__title">Modo de edição</strong>
        <span class="ed-status" data-ed="status">Clique num texto ou numa imagem</span>
        <div class="ed-bar__actions">
          <button type="button" data-ed="config">Preço e link</button>
          <button type="button" data-ed="save" class="ed-primary">Salvar</button>
          <button type="button" data-ed="export">Baixar edicoes.js</button>
          <button type="button" data-ed="close">Sair</button>
        </div>
      </div>
      <div class="ed-panel" data-ed="panel" hidden></div>
      <input type="file" accept="image/*" data-ed="file" hidden>`;
    document.body.appendChild(wrap);
    ui = {
      fab: $("[data-ed=open]", wrap), bar: $(".ed-bar", wrap), status: $("[data-ed=status]", wrap),
      panel: $("[data-ed=panel]", wrap), file: $("[data-ed=file]", wrap), save: $("[data-ed=save]", wrap),
    };
    ui.fab.addEventListener("click", enter);
    $("[data-ed=close]", wrap).addEventListener("click", exit);
    $("[data-ed=save]", wrap).addEventListener("click", save);
    $("[data-ed=export]", wrap).addEventListener("click", exportFile);
    $("[data-ed=config]", wrap).addEventListener("click", openConfig);
    ui.file.addEventListener("change", onFile);
  }

  function setStatus(msg) { ui.status.textContent = msg; }
  function markDirty() { dirty = true; setStatus("Alterações não salvas"); ui.save.classList.add("is-dirty"); saveDraft(); }

  function enter() {
    document.body.classList.add("ed-on");
    ui.fab.hidden = true; ui.bar.hidden = false;
    texts.forEach((el) => { el.contentEditable = "true"; el.spellcheck = true; });
    $$("details").forEach((d) => { d.open = true; });
    $$(".js .reveal").forEach((el) => el.classList.add("is-in"));
    setStatus(caps.canWrite ? "Clique num texto ou numa imagem" : "Clique num texto ou numa imagem. Ao terminar, baixe o edicoes.js");
  }
  function exit() {
    if (dirty && !confirm("Você tem alterações não salvas. Sair mesmo assim?")) return;
    document.body.classList.remove("ed-on");
    ui.fab.hidden = false; ui.bar.hidden = true; closePanel();
    texts.forEach((el) => { el.removeAttribute("contenteditable"); });
  }

  /* Cliques no modo de edição */
  document.addEventListener("click", (e) => {
    if (!document.body.classList.contains("ed-on") || e.target.closest(".ed-ui")) return;
    const a = e.target.closest("a, summary, button");
    if (a) e.preventDefault(); // não navega nem fecha perguntas enquanto edita
    const img = e.target.closest("[data-ed-i]") || pickImageUnder(e);
    const txt = e.target.closest("[data-ed-t]");
    if (txt) { selectText(txt); return; }
    const blk = e.target.closest("[data-ed-b]");
    if (blk) { selectBlock(blk); return; }
    if (img) { e.preventDefault(); selectImage(img); return; }
  }, true);

  // imagens que ficam atrás de outros elementos (ex.: dentro de cards)
  function pickImageUnder(e) {
    const box = e.target.closest(".ph, .hero__art, .teacher__media, .card__media, .quote__av, .sheet__screen");
    return box ? $("img[data-ed-i]", box) : null;
  }

  document.addEventListener("input", (e) => {
    const el = e.target.closest && e.target.closest("[data-ed-t]");
    if (!el || !document.body.classList.contains("ed-on")) return;
    state.texts[el.dataset.edT] = clean(el.innerHTML);
    if (el.matches(".step h3")) { const li = el.closest(".step"); if (li) li.dataset.title = el.textContent.trim(); }
    markDirty();
  });
  // colar sempre como texto simples
  document.addEventListener("paste", (e) => {
    if (!e.target.closest || !e.target.closest("[data-ed-t]")) return;
    e.preventDefault();
    const t = (e.clipboardData || window.clipboardData).getData("text/plain");
    document.execCommand("insertText", false, t);
  });

  function clearSel() { $$(".ed-sel").forEach((el) => el.classList.remove("ed-sel")); }

  function selectText(el) {
    clearSel(); el.classList.add("ed-sel"); selected = el;
    const k = el.dataset.edT, val = state.textScale[k] || 1;
    panel(`
      <p class="ed-panel__title">Texto</p>
      <label class="ed-field">Tamanho do texto <output>${Math.round(val * 100)}%</output>
        <input type="range" min="0.6" max="1.8" step="0.05" value="${val}" data-ed="tscale"></label>
      ${layoutControls(k)}
      <div class="ed-row"><button type="button" data-ed="treset">Voltar ao original</button></div>
      <p class="ed-hint">Escreva direto no texto da página. Para negrito: selecione e aperte Ctrl+B (Cmd+B no Mac).</p>`);
    bindLayout(k, el);
    const r = $("[data-ed=tscale]", ui.panel), out = $("output", ui.panel);
    r.addEventListener("input", () => {
      const v = parseFloat(r.value); out.textContent = Math.round(v * 100) + "%";
      if (v === 1) delete state.textScale[k]; else state.textScale[k] = v;
      el.style.fontSize = v === 1 ? "" : v + "em"; markDirty();
    });
    $("[data-ed=treset]", ui.panel).addEventListener("click", () => {
      delete state.texts[k]; delete state.textScale[k]; delete state.layout[k]; applyLayout(el, null); el.style.fontSize = ""; markDirty();
      setStatus("Texto restaurado. Recarregue a página para ver o original.");
    });
  }

  function selectBlock(el) {
    clearSel(); el.classList.add("ed-sel"); selected = el;
    const k = el.dataset.edB;
    const name = el.matches(".brand") ? "Logo" : el.matches(".hero__ring") ? "Círculo roxo da capa" : "Letra P da capa";
    panel(`<p class="ed-panel__title">${name}</p>${layoutControls(k)}
      <div class="ed-row"><button type="button" data-ed="breset">Voltar ao original</button></div>`);
    bindLayout(k, el);
    $("[data-ed=breset]", ui.panel).addEventListener("click", () => { delete state.layout[k]; applyLayout(el, null); markDirty(); });
  }

  function selectImage(img) {
    clearSel(); img.classList.add("ed-sel"); selected = img;
    const k = img.dataset.edI, d = state.images[k] || {}, val = d.scale || 1;
    const label = scaleTarget(img) ? "Tamanho da imagem" : "Zoom da imagem";
    panel(`
      <p class="ed-panel__title">Imagem</p>
      <div class="ed-row"><button type="button" class="ed-primary" data-ed="pick">Trocar imagem</button></div>
      <label class="ed-field">${label} <output>${Math.round(val * 100)}%</output>
        <input type="range" min="0.5" max="2" step="0.05" value="${val}" data-ed="iscale"></label>
      <label class="ed-field">Descrição da imagem (para acessibilidade e Google)
        <input type="text" value="${(img.alt || "").replace(/"/g, "&quot;")}" data-ed="alt"></label>
      ${img.closest(".hero__art") ? '<div class="ed-row"><button type="button" data-ed="ring">Ajustar círculo roxo</button><button type="button" data-ed="letter">Ajustar letra P</button></div>' : ""}
      ${layoutControls(k)}
      <div class="ed-row"><button type="button" data-ed="ireset">Voltar ao original</button></div>`);
    bindLayout(k, boxOf(img));
    const ringBtn = $("[data-ed=ring]", ui.panel), pBtn = $("[data-ed=letter]", ui.panel);
    if (ringBtn) ringBtn.addEventListener("click", () => selectBlock($(".hero__ring")));
    if (pBtn) pBtn.addEventListener("click", () => selectBlock($(".hero__p")));
    $("[data-ed=pick]", ui.panel).addEventListener("click", () => ui.file.click());
    const r = $("[data-ed=iscale]", ui.panel), out = $("output", ui.panel);
    r.addEventListener("input", () => {
      const v = parseFloat(r.value); out.textContent = Math.round(v * 100) + "%";
      state.images[k] = Object.assign({}, state.images[k], { scale: v }); apply(); markDirty();
    });
    $("[data-ed=alt]", ui.panel).addEventListener("input", (e) => {
      state.images[k] = Object.assign({}, state.images[k], { alt: e.target.value }); img.alt = e.target.value; markDirty();
    });
    $("[data-ed=ireset]", ui.panel).addEventListener("click", () => {
      delete state.images[k]; delete state.layout[k]; applyLayout(boxOf(img), null); markDirty(); setStatus("Imagem restaurada. Recarregue a página para ver a original.");
    });
  }

  async function onFile() {
    const file = ui.file.files[0]; ui.file.value = "";
    if (!file || !selected || !selected.dataset.edI) return;
    const k = selected.dataset.edI;
    setStatus("Preparando imagem…");
    try {
      const blob = await shrink(file, 1600);
      let src;
      if (caps.assets) {
        const up = await caps.assets.upload(blob);
        src = up.url;
      } else if (caps.inArtifact && caps.db) {
        setStatus("Para trocar imagens aqui no link, peça ao Claude para liberar o envio de imagens.");
        return;
      } else {
        src = await toDataURL(blob);
      }
      state.images[k] = Object.assign({}, state.images[k], { src });
      apply(); markDirty();
      setStatus("Imagem trocada. Lembre de salvar.");
    } catch (err) {
      setStatus("Não deu para trocar a imagem (" + (err && (err.code || err.message) || "erro") + ").");
    }
  }

  // reduz para no máximo 1600px e converte para WebP (mantém fundo transparente)
  function shrink(file, max) {
    return new Promise((res, rej) => {
      const url = URL.createObjectURL(file), im = new Image();
      im.onload = () => {
        const r = Math.min(1, max / Math.max(im.naturalWidth, im.naturalHeight));
        const c = document.createElement("canvas");
        c.width = Math.round(im.naturalWidth * r); c.height = Math.round(im.naturalHeight * r);
        c.getContext("2d").drawImage(im, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        c.toBlob((b) => (b ? res(b) : rej(new Error("conversão"))), "image/webp", 0.86);
      };
      im.onerror = () => rej(new Error("arquivo de imagem inválido"));
      im.src = url;
    });
  }
  const toDataURL = (blob) => new Promise((res) => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.readAsDataURL(blob); });

  function openConfig() {
    clearSel(); selected = null;
    const cfg = Object.assign({}, window.OPLANO ? window.OPLANO.config : {}, state.config);
    panel(`<p class="ed-panel__title">Preço e link de compra</p>` + CFG_FIELDS.map(([k, label, ph]) => `
      <label class="ed-field">${label}<input type="text" data-cfg-k="${k}" placeholder="${ph}" value="${String(cfg[k] || "").replace(/"/g, "&quot;")}"></label>`).join("") +
      `<p class="ed-hint">Os valores aparecem sozinhos em todos os lugares da página.</p>`);
    $$("[data-cfg-k]", ui.panel).forEach((inp) => inp.addEventListener("input", () => {
      state.config[inp.dataset.cfgK] = inp.value.trim();
      if (window.OPLANO) window.OPLANO.applyConfig(state.config);
      markDirty();
    }));
  }

  function panel(html) {
    ui.panel.innerHTML = `<button type="button" class="ed-x" aria-label="Fechar">✕</button><button type="button" class="ed-side" aria-label="Mudar o painel de lado" title="Mudar o painel de lado">⇆</button>` + html;
    ui.panel.hidden = false;
    $(".ed-x", ui.panel).addEventListener("click", closePanel);
    $(".ed-side", ui.panel).addEventListener("click", () => ui.panel.classList.toggle("ed-panel--left"));
  }
  function closePanel() { ui.panel.hidden = true; clearSel(); selected = null; }

  /* ---------- Salvar ---------- */
  async function save() {
    if (caps.db && caps.canWrite) {
      setStatus("Salvando…");
      try {
        await caps.db.doc(DB_PATH).set({ json: JSON.stringify(state), updatedAt: Date.now() });
        dirty = false; ui.save.classList.remove("is-dirty");
        setStatus("Salvo ✓ (já aparece para quem abrir este link)");
        return;
      } catch (err) {
        setStatus("Não consegui salvar aqui (" + (err.code || "erro") + "). Use “Baixar edicoes.js”.");
        return;
      }
    }
    saveDraft(true);
    exportFile();
  }
  function saveDraft(announce) {
    try { localStorage.setItem("oplano-edicoes", JSON.stringify(state)); if (announce) setStatus("Rascunho guardado neste navegador."); } catch (e) { /* sem armazenamento */ }
  }
  // imagens enviadas no link do Claude viram arquivo embutido, para funcionar em qualquer hospedagem
  async function portableState() {
    const copy = JSON.parse(JSON.stringify(state));
    for (const k of Object.keys(copy.images)) {
      const src = copy.images[k].src;
      if (!src || src.startsWith("data:")) continue;
      try { copy.images[k].src = await toDataURL(await (await fetch(src)).blob()); } catch (e) { /* mantém o endereço */ }
    }
    return copy;
  }
  async function exportFile() {
    setStatus("Gerando arquivo…");
    const data = "/* Edições feitas no modo de edição da página (?editar). Gerado em " + new Date().toLocaleString("pt-BR") + ". */\nwindow.EDICOES = " + JSON.stringify(await portableState(), null, 2) + ";\n";
    if (caps.downloads) {
      try { await caps.downloads.save({ filename: "edicoes.js", data }); setStatus("Arquivo baixado. Substitua o edicoes.js da pasta da página."); return; }
      catch (e) { if (e && e.code === "declined") return; }
    }
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([data], { type: "text/javascript" }));
    a.download = "edicoes.js"; (document.querySelector(".ed-ui") || document.body).appendChild(a); a.click(); a.remove();
    setStatus("Arquivo baixado. Substitua o edicoes.js da pasta da página.");
    dirty = false; ui.save.classList.remove("is-dirty");
  }

  /* ---------- Início ---------- */
  index();
  state = merge(blank(), window.EDICOES);
  const wantsEdit = /[?&#]editar\b/.test(location.search + location.hash);
  if (wantsEdit) {
    try { const draft = JSON.parse(localStorage.getItem("oplano-edicoes") || "null"); if (draft) state = merge(state, draft); } catch (e) { /* ok */ }
  }
  apply();
  buildUI();
  ui.fab.hidden = !wantsEdit;

  // Dentro do link do Claude: salva direto na página e mostra o botão para o dono
  if (window.claude && typeof window.claude.use === "function") {
    caps.inArtifact = true;
    (async () => {
      const [db, user, assets, downloads] = await Promise.all(["db", "user", "assets", "downloads"].map((n) => window.claude.use(n).catch(() => null)));
      caps.db = db; caps.assets = assets; caps.downloads = downloads;
      const canEdit = user ? await user.canEdit().catch(() => false) : false;
      caps.canWrite = !!(db && canEdit);
      if (db) {
        try {
          const snap = await db.doc(DB_PATH).get();
          const d = snap.exists ? snap.data() : null;
          if (d && d.json) { state = merge(state, JSON.parse(d.json)); apply(); }
        } catch (e) { /* sem dados ainda */ }
      }
      if (canEdit) ui.fab.hidden = false;
    })();
  }
})();
