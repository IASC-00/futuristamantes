// www.futuristamantes.com is the canonical address (Ian, 1 Nov 2026: https://www. on every site).
// Cloudflare Pages has no host-based redirect in _redirects, so the bare domain is sent
// to www here with a 301 that keeps the path and query. Every other host (www, *.pages.dev
// previews) passes straight through to the static files.
// Search Console HTML-file verification (iswain.dev@gmail.com, 20 Nov 2026): Pages would 308
// /googleab408ff4e8b64c9e.html to the extensionless path, and the check wants the file itself.
const GSC_FILE = "/googleab408ff4e8b64c9e.html";

export async function onRequest(context) {
  const url = new URL(context.request.url);
  if (url.pathname === GSC_FILE) {
    return new Response("google-site-verification: googleab408ff4e8b64c9e.html", {
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }
  if (url.hostname === "futuristamantes.com") {
    url.hostname = "www.futuristamantes.com";
    url.protocol = "https:";
    return Response.redirect(url.toString(), 301);
  }
  return context.next();
}
