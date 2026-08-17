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

  const title = "Uau Digital";
  const description = "Confira e aprove as publicações programadas para o seu perfil.";
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
