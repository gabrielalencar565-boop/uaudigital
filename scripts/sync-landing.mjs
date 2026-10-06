#!/usr/bin/env node
// Turns the landing published as a Claude Artifact ("Fluxo Landing Page") into public/landing.html, which the site
// serves at "/" (see middleware.ts). The artifact is a single compiled HTML page; this script adapts it to the app:
//   - strips the artifact wrapper,
//   - makes every CTA point to this same domain (/auth, /auth?mode=signup, /privacidade),
//   - adds title/description/fonts/icon, the "already signed in → go to the app" redirect and the first-visit intro.
// None of it depends on the compiler's minified identifiers (they change on every republish).
//
// Usage:  node scripts/sync-landing.mjs <path-to-artifact.html>   (or: npm run landing:sync -- <path>)
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const src = process.argv[2];
if (!src) {
  console.error("Uso: node scripts/sync-landing.mjs <arquivo-html-do-artefato>");
  process.exit(1);
}
const outPath = resolve(dirname(fileURLToPath(import.meta.url)), "..", "public", "landing.html");

let html = readFileSync(src, "utf8");

// 1) strip the artifact shell: the real page starts at the second <!doctype html>
const firstDoctype = html.search(/<!doctype html>/i);
const secondDoctype = html.slice(firstDoctype + 1).search(/<!doctype html>/i);
if (secondDoctype >= 0) html = html.slice(firstDoctype + 1 + secondDoctype);
const closing = html.lastIndexOf("</html>");
if (closing < 0) throw new Error("HTML do artefato sem </html> — arquivo incompleto?");
html = html.slice(0, closing + "</html>".length);

// 2) CTAs on this same origin: drop the absolute app URL the artifact was compiled with
const before = html;
html = html.replace(
  /"https?:\/\/(?:uaudigital\.vercel\.app|appfluxo\.app\.br|app\.appfluxo\.app\.br)\/?"(?:\.replace\([^)]*\))?/g,
  '""',
);
const urlRewritten = html !== before;

// 3) head: title/description/icons/fonts + redirect for signed-in users + first-visit intro
const headBlock = `<title>Fluxo — gestão para agências</title>
<meta name="description" content="Fluxo organiza clientes, produção, aprovações e resultados da sua agência em um só lugar. Comece o teste grátis.">
<meta property="og:type" content="website"><meta property="og:title" content="Fluxo — gestão para agências"><meta property="og:description" content="Clientes, produção, aprovações e resultados da sua agência em um só lugar.">
<link rel="icon" type="image/png" sizes="32x32" href="/icons/icon-32x32.png"><link rel="apple-touch-icon" href="/icons/icon-180x180.png"><meta name="theme-color" content="#18161B">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,300..800&family=Lora:wght@400;500;600;700&family=Space+Mono:wght@400;700&display=swap">
<script>
  // Signed-in people go straight to the app; links from auth e-mails (tokens in the URL) must reach the app too.
  try {
    var authLink = /access_token|refresh_token|error_description|[?&]code=|type=(recovery|invite|signup|magiclink)/.test(location.hash + location.search);
    var signedIn = Object.keys(localStorage).some(function (k) { return /^sb-.+-auth-token$/.test(k) && localStorage.getItem(k); });
    if (authLink) location.replace("/auth" + location.search + location.hash);
    else if (signedIn) location.replace("/meu-painel");
    else window.__fluxoShowIntro = true;
  } catch (e) {}
</script>
<script src="/fluxo-loader.js"></script>
<script>
  // First visit only: the Fluxo logo draws itself once (one full loop, never cut mid-way), then reveals the page.
  // Click to skip. Returning visitors never see it again; add ?intro=1 to the address to replay it.
  (function () {
    try {
      if (!window.__fluxoShowIntro || !window.FluxoLoader) return;
      var replay = /[?&]intro=1\\b/.test(location.search);
      if (!replay && localStorage.getItem("fluxo-intro-seen")) return;
      localStorage.setItem("fluxo-intro-seen", "1");
      var intro = FluxoLoader.show({ theme: "dark", size: 460, minLoops: 1, label: "Bem-vindo ao Fluxo" });
      intro.element.style.cursor = "pointer";
      intro.element.title = "Clique para pular";
      intro.element.addEventListener("click", function () { intro.destroy(); });
      var close = function () { intro.hide(); };
      if (document.readyState === "complete") close(); else window.addEventListener("load", close);
    } catch (e) {}
  })();
</script>
<script>
  // Call-to-action links open the free-trial signup form; login links ("Entrar", "Já tenho login") stay on /auth.
  (function () {
    function fix() {
      document.querySelectorAll('a[href="/auth"]').forEach(function (a) {
        // login-type links stay on the login form; everything else is a call-to-action for the free trial
        if (!/entrar|login|acessar|já tenho|ja tenho/i.test(a.textContent || "")) a.setAttribute("href", "/auth?mode=signup");
      });
    }
    new MutationObserver(fix).observe(document.documentElement, { childList: true, subtree: true });
    document.addEventListener("DOMContentLoaded", fix);
    fix();
  })();
</script>`;
if (!/<title>[^<]*<\/title>/.test(html)) throw new Error("Não achei <title> no HTML do artefato");
html = html.replace(/<title>[^<]*<\/title>/, () => headBlock);

writeFileSync(outPath, html);

// 4) sanity checks, so a broken sync never goes unnoticed
const problems = [];
if (!html.includes('"/auth"') && !html.includes("`${")) problems.push("não encontrei os links para /auth");
if (/uaudigital\.vercel\.app/.test(html)) problems.push("ainda há links para uaudigital.vercel.app");
console.log(`landing.html atualizado (${(html.length / 1024).toFixed(0)} KB) a partir de ${src}`);
console.log(urlRewritten ? "  • endereço absoluto do app trocado por caminhos do próprio domínio" : "  • (nenhum endereço absoluto encontrado para trocar)");
if (problems.length) {
  console.error("ATENÇÃO:\n  - " + problems.join("\n  - "));
  process.exit(2);
}
