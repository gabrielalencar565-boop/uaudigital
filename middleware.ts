// Framework-agnostic Vercel Edge Middleware. This is a plain Vite SPA (no SSR), so
// index.html's Open Graph tags are static and identical for every route — link-preview
// bots (WhatsApp, etc.) never run JS, so they'd only ever see that generic preview.
//
// This intercepts *only* requests from known link-preview crawlers hitting the public
// client-approval link, and serves a tiny standalone HTML page with fresh og:image tags
// pointing at whatever image is configured in Aparência > Miniatura de Link — editable
// from Supabase without a redeploy. Everything else (real visitors, every other route)
// falls straight through untouched.
export const config = {
  matcher: "/aprovacao/:token*",
};

const BOT_UA_RE =
  /facebookexternalhit|Facebot|WhatsApp|Twitterbot|LinkedInBot|Slackbot|TelegramBot|Discordbot|SkypeUriPreview|redditbot|Pinterest|vkShare|W3C_Validator|Applebot|BingPreview|Iframely|Embedly/i;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MONTHS_PT_SHORT = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

export default async function middleware(request: Request) {
  const ua = request.headers.get("user-agent") || "";
  if (!BOT_UA_RE.test(ua)) return;

  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const supabaseKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!supabaseUrl || !supabaseKey) return;

  let imageUrl = "";
  try {
    const res = await fetch(`${supabaseUrl}/rest/v1/app_settings?select=link_preview_image_url&id=eq.1`, {
      headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` },
    });
    const rows = (await res.json()) as { link_preview_image_url: string | null }[];
    imageUrl = rows?.[0]?.link_preview_image_url || "";
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
          title = escapeHtml(`Conteúdos - ${clientName} | ${month}/${year}`);
          description = escapeHtml(`Confira e aprove as publicações programadas para ${clientName} — ciclo ${month}/${year}.`);
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
