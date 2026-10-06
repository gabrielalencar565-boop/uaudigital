// Framework-agnostic Vercel Edge Middleware. This is a plain Vite SPA (no SSR), so
// index.html's Open Graph tags are static and identical for every route — link-preview
// bots (WhatsApp, etc.) never run JS, so they'd only ever see that generic preview.
//
// This intercepts *only* requests from known link-preview crawlers hitting the public
// client-approval link, and serves a tiny standalone HTML page with fresh og:image tags
// pointing at the image, title and description configured in Configurações → Agência → Link de aprovação — editable
// from Supabase without a redeploy. Everything else (real visitors, every other route)
// falls straight through untouched.
//
// The site root ("/") is also handled here: it answers with the marketing landing page
// (public/landing.html) while the address bar stays on "/". A static rewrite can't do this because
// Vercel serves the SPA's index.html for "/" before rewrites run. The landing itself sends signed-in
// people on to the app, and index.html has a client-side fallback that goes to /landing.html if this
// middleware is ever unavailable.
//
// The legacy address (uaudigital.vercel.app, the project's default Vercel domain) is still what many people have
// saved or were sent. Every page request that arrives there is redirected to the current domain, keeping the path
// and query string (approval links, e-mail links, bookmarks all keep working). Static asset folders are left out of
// the matcher so serving files stays free of edge invocations.
export const config = {
  matcher: ["/((?!assets/|icons/|branding/|fonts/|sounds/).*)"],
};

const LEGACY_HOST = "uaudigital.vercel.app";
const CURRENT_HOST = "appfluxo.app.br";

const BOT_UA_RE =
  /facebookexternalhit|Facebot|WhatsApp|Twitterbot|LinkedInBot|Slackbot|TelegramBot|Discordbot|SkypeUriPreview|redditbot|Pinterest|vkShare|W3C_Validator|Applebot|BingPreview|Iframely|Embedly/i;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MONTHS_PT_SHORT = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

// Same defaults/variables as src/lib/approval-link-preview.ts (editable in Configurações → Agência).
const DEFAULT_TITLE_TEMPLATE = "Conteúdos - {cliente} | {mes}/{ano}";
const DEFAULT_DESCRIPTION_TEMPLATE = "Confira e aprove as publicações programadas para {cliente} — ciclo {mes}/{ano}.";

function renderTemplate(template: string, vars: { cliente: string; mes: string; ano: string }) {
  return template.replace(/\{cliente\}/g, vars.cliente).replace(/\{mes\}/g, vars.mes).replace(/\{ano\}/g, vars.ano);
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

// Shown on the legacy address: explains the move, then sends the person to the same page on the current domain
// after 10 seconds. Styled like the marketing site (dark graphite, Fluxo wordmark, violet→pink→peach gradient).
const MOVED_NOTICE_SECONDS = 10;

function renderMovedNotice(target: string) {
  const safeHref = escapeHtml(target);
  const jsTarget = JSON.stringify(target).replace(/</g, "\\u003c");
  const seconds = MOVED_NOTICE_SECONDS;
  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex">
<meta name="theme-color" content="#18161B">
<title>Mudamos de endereço — Fluxo</title>
<meta http-equiv="refresh" content="${seconds + 3};url=${safeHref}">
<link rel="icon" type="image/png" sizes="32x32" href="https://${CURRENT_HOST}/icons/icon-32x32.png">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400;600;700;800&display=swap">
<style>
  *{box-sizing:border-box}
  html,body{height:100%}
  body{margin:0;display:flex;align-items:center;justify-content:center;padding:28px;color:#fff;text-align:center;
    background:#18161B radial-gradient(70% 55% at 50% 0%,rgba(143,61,255,.20),transparent 70%);
    font-family:"Bricolage Grotesque",ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,Arial,sans-serif;-webkit-font-smoothing:antialiased}
  main{width:100%;max-width:520px;animation:rise .7s cubic-bezier(.22,1,.36,1) both}
  @keyframes rise{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}
  .logo{height:46px;width:auto;margin:0 auto 44px;display:block}
  .pill{display:inline-flex;align-items:center;gap:8px;padding:6px 14px;border-radius:999px;border:1px solid rgba(255,255,255,.1);background:rgba(255,255,255,.04);
    font-size:12px;letter-spacing:.04em;color:rgba(255,255,255,.7)}
  .dot{width:7px;height:7px;border-radius:50%;background:#FFB547;box-shadow:0 0 0 4px rgba(255,181,71,.18)}
  h1{margin:22px 0 14px;font-size:clamp(32px,7vw,46px);line-height:1.05;font-weight:800;letter-spacing:-.025em}
  .grad{background:linear-gradient(90deg,#8F3DFF,#EE7BEA 70%,#FFB88A);-webkit-background-clip:text;background-clip:text;color:transparent}
  p{margin:0 auto;max-width:400px;color:rgba(255,255,255,.58);font-size:17px;line-height:1.55}
  .btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;margin-top:34px;padding:14px 30px;border-radius:999px;color:#fff;text-decoration:none;font-weight:600;font-size:15px;
    background:linear-gradient(90deg,#6A24F0,#8F3DFF 60%,#C45CF0);box-shadow:0 10px 30px -10px rgba(143,61,255,.8);transition:transform .15s ease,box-shadow .15s ease}
  .btn:hover{transform:translateY(-1px);box-shadow:0 14px 34px -10px rgba(143,61,255,.95)}
  .bar{height:3px;width:min(220px,60%);margin:34px auto 12px;border-radius:999px;background:rgba(255,255,255,.08);overflow:hidden}
  .bar i{display:block;height:100%;width:0;border-radius:inherit;background:linear-gradient(90deg,#6A24F0,#EE7BEA,#FFB88A);animation:fill ${seconds}s linear forwards}
  @keyframes fill{to{width:100%}}
  .count{font-size:13px;color:rgba(255,255,255,.45)}.count b{color:rgba(255,255,255,.8);font-weight:600}
  .note{margin-top:30px;font-size:12.5px;line-height:1.55;color:rgba(255,255,255,.38)}
  @media (prefers-reduced-motion:reduce){main{animation:none}.bar i{animation:none;width:100%}}
</style>
</head>
<body>
<main>
  <img class="logo" src="https://${CURRENT_HOST}/branding/fluxo-logo-white.svg" alt="Fluxo">
  <span class="pill"><span class="dot"></span>NOVO ENDEREÇO</span>
  <h1>Mudamos de casa.<br><span class="grad">Agora é Fluxo.</span></h1>
  <p>O sistema da UAU agora vive em <b style="color:#fff;font-weight:600">${CURRENT_HOST}</b>. É só seguir por lá.</p>
  <a class="btn" id="go" href="${safeHref}">Ir para o Fluxo <span aria-hidden="true">&rarr;</span></a>
  <div class="bar" aria-hidden="true"><i></i></div>
  <div class="count">Levando você em <b id="n">${seconds}</b> segundos</div>
  <div class="note">Atualize seus favoritos. Na primeira vez, será preciso entrar de novo.</div>
</main>
<script>
  (function () {
    var target = ${jsTarget} + (location.hash || "");
    document.getElementById("go").setAttribute("href", target);
    var n = ${seconds}, el = document.getElementById("n");
    var t = setInterval(function () {
      n--; el.textContent = String(Math.max(n, 0));
      if (n <= 0) { clearInterval(t); location.replace(target); }
    }, 1000);
  })();
</script>
</body>
</html>`;
}

async function serveLanding(request: Request) {
  try {
    const res = await fetch(new URL("/landing.html", request.url));
    if (!res.ok) return; // fall through to the app
    return new Response(res.body, {
      status: 200,
      headers: { "content-type": "text/html; charset=utf-8", "cache-control": "public, max-age=0, must-revalidate" },
    });
  } catch {
    return; // fall through to the app
  }
}

export default async function middleware(request: Request) {
  const requestUrl = new URL(request.url);

  if (requestUrl.hostname === LEGACY_HOST) {
    const target = new URL(requestUrl.pathname + requestUrl.search, `https://${CURRENT_HOST}`);
    // Public client links (approval, schedule, report, health score) must keep opening instantly: clients never need
    // to see the notice, and they need no login. Everything else gets the notice, then the redirect.
    const isPublicClientLink = /^\/(aprovacao|cronograma|relatorio|avaliacao)\//.test(requestUrl.pathname);
    if (isPublicClientLink) return Response.redirect(target.toString(), 308);

    // Signed-in sessions are stored per address, so people coming from the old one have to log in again once: flag
    // the app pages so the login screen can say why.
    if (requestUrl.pathname !== "/") target.searchParams.set("from", "legacy");
    return new Response(renderMovedNotice(target.toString()), {
      status: 200,
      headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" },
    });
  }

  // Only the root and the approval link need handling below; everything else falls through to the app.
  if (requestUrl.pathname === "/") return serveLanding(request);
  if (!requestUrl.pathname.startsWith("/aprovacao/")) return;

  const ua = request.headers.get("user-agent") || "";
  if (!BOT_UA_RE.test(ua)) return;

  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const supabaseKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!supabaseUrl || !supabaseKey) return;

  let imageUrl = "";
  let titleTemplate = DEFAULT_TITLE_TEMPLATE;
  let descriptionTemplate = DEFAULT_DESCRIPTION_TEMPLATE;
  try {
    const res = await fetch(
      `${supabaseUrl}/rest/v1/app_settings?select=link_preview_image_url,link_preview_title,link_preview_description&id=eq.1`,
      { headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` } },
    );
    const rows = (await res.json()) as { link_preview_image_url: string | null; link_preview_title: string | null; link_preview_description: string | null }[];
    imageUrl = rows?.[0]?.link_preview_image_url || "";
    titleTemplate = rows?.[0]?.link_preview_title?.trim() || DEFAULT_TITLE_TEMPLATE;
    descriptionTemplate = rows?.[0]?.link_preview_description?.trim() || DEFAULT_DESCRIPTION_TEMPLATE;
  } catch {
    // No image configured or Supabase unreachable — bot just won't get a rich image.
  }

  let title = "Uau Digital";
  let description = "Confira e aprove as publicações programadas para o seu perfil.";

  // Personalize with the client's name and the cycle's month (named after cycle_end,
  // matching the app's own cycle-naming convention) — e.g. "Conteúdos - Dra Luanna | Set/2026".
  const token = new URL(request.url).pathname.match(/^\/aprovacao\/([^/]+)/)?.[1] ?? "";
  if (UUID_RE.test(token)) {
    try {
      const res = await fetch(`${supabaseUrl}/functions/v1/public-calendario-publicacao`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "load", token }),
      });
      if (res.ok) {
        const data = (await res.json()) as { clientName?: string; calendar?: { cycleEnd?: string } };
        const clientName = data.clientName;
        const cycleEnd = data.calendar?.cycleEnd;
        const month = cycleEnd ? MONTHS_PT_SHORT[Number(cycleEnd.slice(5, 7)) - 1] : null;
        const year = cycleEnd?.slice(0, 4);
        if (clientName && month && year) {
          const vars = { cliente: clientName, mes: month, ano: year };
          title = escapeHtml(renderTemplate(titleTemplate, vars));
          description = escapeHtml(renderTemplate(descriptionTemplate, vars));
        }
      }
    } catch {
      // Token lookup failed — bot just gets the generic branding instead.
    }
  }

  const pageUrl = request.url;

  const html = `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<title>${title}</title>
<meta property="og:type" content="website">
<meta property="og:url" content="${pageUrl}">
<meta property="og:title" content="${title}">
<meta property="og:description" content="${description}">
${imageUrl ? `<meta property="og:image" content="${imageUrl}">\n<meta name="twitter:image" content="${imageUrl}">` : ""}
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${title}">
<meta name="twitter:description" content="${description}">
<meta http-equiv="refresh" content="0;url=${pageUrl}">
</head>
<body>Redirecionando…</body>
</html>`;

  return new Response(html, {
    status: 200,
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "public, max-age=300" },
  });
}
