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

// Shown on the legacy address: explains the move, then sends the person to the same page on the current domain.
function renderMovedNotice(target: string) {
  const safeHref = escapeHtml(target);
  const jsTarget = JSON.stringify(target).replace(/</g, "\\u003c");
  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex">
<title>O sistema mudou de endereço</title>
<meta http-equiv="refresh" content="8;url=${safeHref}">
<style>
  *{box-sizing:border-box}body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px;background:#181818;color:#fff;font-family:ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,Arial,sans-serif;text-align:center}
  .card{max-width:640px;width:100%;border:1px solid rgba(107,33,168,.35);border-radius:20px;background:#232323;padding:40px 32px;box-shadow:0 25px 60px -20px rgba(0,0,0,.6)}
  .rocket{font-size:44px;margin-bottom:20px}h1{margin:0 0 16px;font-size:clamp(24px,5vw,32px);font-weight:800;letter-spacing:-.01em}
  p{margin:0;color:#d1d5db;font-size:clamp(15px,2.5vw,18px);line-height:1.5}
  .btn{display:inline-flex;align-items:center;gap:8px;margin:26px 0 18px;padding:14px 26px;border-radius:12px;background:#7c3aed;color:#fff;font-weight:600;font-size:17px;text-decoration:none;transition:background .15s}
  .btn:hover{background:#6d28d9}.url{color:#8b5cf6;font-weight:600;word-break:break-all;font-size:16px}
  .count{margin-top:18px;color:#9ca3af;font-size:14px}.warn{margin-top:22px;padding:14px 16px;border-radius:10px;border:1px solid rgba(234,179,8,.3);background:rgba(234,179,8,.1);color:#fde68a;font-size:14px;line-height:1.5}
</style>
</head>
<body>
<div class="card">
  <div class="rocket">🚀</div>
  <h1>O SISTEMA DA UAU MUDOU!</h1>
  <p>Agora ele é o <b>Fluxo</b> e está em um novo endereço.</p>
  <a class="btn" id="go" href="${safeHref}">Acesse pelo novo link &rarr;</a>
  <div class="url">appfluxo.app.br</div>
  <div class="count" id="count">Levando você para lá em <b id="n">5</b> segundos…</div>
  <div class="warn">⚠️ Importante: atualize o endereço salvo nos seus favoritos e use somente este link daqui pra frente. Na primeira vez, será preciso entrar novamente.</div>
</div>
<script>
  (function () {
    var target = ${jsTarget} + (location.hash || "");
    document.getElementById("go").setAttribute("href", target);
    var n = 5, el = document.getElementById("n");
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
