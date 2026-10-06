import DOMPurify from "dompurify";

// User-written rich text (task descriptions, captions, comments) is stored as HTML and shown to teammates and — through
// the approval pages — to clients. Without sanitizing, `<img src=x onerror=…>` typed or pasted into a description would
// run in the viewer's session (stored XSS). DOMPurify removes scripts, inline event handlers and javascript:/data: URLs
// while keeping the formatting tags and the link-preview cards the editors produce (they rely on contenteditable,
// target, data-* and inline style, which stay allowed).
let hookInstalled = false;
function ensureHook() {
  if (hookInstalled) return;
  hookInstalled = true;
  DOMPurify.addHook("afterSanitizeAttributes", (node) => {
    if (node.tagName === "A" && node.getAttribute("target")) {
      node.setAttribute("rel", "noopener noreferrer");
    }
  });
}

export function sanitizeHtml(html: string | null | undefined): string {
  if (!html) return "";
  ensureHook();
  return DOMPurify.sanitize(html, {
    ADD_ATTR: ["target", "contenteditable"],
    // fake login forms / page-wide CSS injected into a description are phishing and defacement vectors
    FORBID_TAGS: ["style", "form", "input", "textarea", "select", "option", "iframe", "object", "embed", "link", "meta", "base"],
  });
}
