import { useState, useRef, useCallback, useEffect } from "react";
import {
  Bold, Italic, Underline, Strikethrough, List, ListOrdered,
  Wand2, Loader2, SpellCheck as SpellCheckIcon, ArrowUpRight, ArrowDownRight, Feather, Sparkles,
  Undo2, Redo2, Type, Heading1, Heading2, Heading3, Heading4, ChevronDown, Check,
  Clock, Maximize2, CheckCircle2, AlertCircle, Link2, GalleryHorizontal,
  ExternalLink, Trash2, X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useSpellcheck, type SpellError } from "../hooks/use-spellcheck";
import { SpellCheckOverlay } from "./SpellCheckOverlay";
import { SpellSuggestionPopover } from "./SpellSuggestionPopover";
import { LinkPreviewBody } from "@/components/LinkChip";
import { fetchLinkPreview, detectPlatform, shortenUrl, PLATFORM_ICON_PATHS, type LinkPreviewData, type IconChild } from "@/lib/link-preview";

const AI_ACTIONS = [
  { key: "improve", label: "Melhorar a escrita", icon: Sparkles },
  { key: "grammar", label: "Corrigir ortografia e gramática", icon: SpellCheckIcon },
  { key: "longer", label: "Tornar mais longo", icon: ArrowUpRight },
  { key: "shorter", label: "Tornar mais curto", icon: ArrowDownRight },
  { key: "simplify", label: "Simplificar a escrita", icon: Feather },
];

const HEADING_OPTIONS = [
  { tag: "p", label: "Texto", icon: Type },
  { tag: "h1", label: "Cabeçalho 1", icon: Heading1 },
  { tag: "h2", label: "Cabeçalho 2", icon: Heading2 },
  { tag: "h3", label: "Cabeçalho 3", icon: Heading3 },
  { tag: "h4", label: "Cabeçalho 4", icon: Heading4 },
];

const TOOLBAR_BUTTONS = [
  { cmd: "bold", icon: Bold, label: "Negrito" },
  { cmd: "italic", icon: Italic, label: "Itálico" },
  { cmd: "underline", icon: Underline, label: "Sublinhado" },
  { cmd: "strikeThrough", icon: Strikethrough, label: "Tachado" },
  { divider: true },
  { cmd: "insertUnorderedList", icon: List, label: "Lista" },
  { cmd: "insertOrderedList", icon: ListOrdered, label: "Lista numerada" },
] as const;

const GRADIENT_TOOLBAR = "linear-gradient(135deg, hsl(263 70% 50%), hsl(263 70% 36%))";
const GRADIENT_MENU = "linear-gradient(160deg, hsl(263 70% 42%), hsl(263 70% 30%))";
// Matches either a full "https://…" URL or a bare "www.…" domain (no protocol) —
// links copied without "https://" (common from some apps/share sheets) still get detected.
const URL_REGEX_SOURCE = String.raw`(?:https?:\/\/[^\s<>"']+|www\.[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)*\.[a-zA-Z]{2,}[^\s<>"']*)`;

/** Ensures a matched URL has a protocol — "www.…" matches need "https://" prepended before use as an href. */
function normalizeUrl(url: string) {
  return /^https?:\/\//i.test(url) ? url : `https://${url}`;
}

function splitTrailingUrlPunctuation(url: string) {
  const match = url.match(/^(.*?)([.,;:!?\)\]]+)$/);
  return {
    cleanUrl: match?.[1] || url,
    trailingText: match?.[2] || "",
  };
}

// The editor forces `color: inherit !important` on every descendant (so pasted rich text
// always follows the app's theme). Our pills/cards manage their own colors on purpose, so
// we set `color` via `!important` inline — which, per the CSS cascade, still wins over an
// `!important` rule in a stylesheet.
function setImportantColor(el: HTMLElement, color: string) {
  el.style.setProperty("color", color, "important");
}

/** Builds the actual <a> element for the compact dark "link pill" (icon + platform + shortened URL). */
function buildAnchorElement(url: string): HTMLAnchorElement {
  const platform = detectPlatform(url);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.target = "_blank";
  anchor.rel = "noopener noreferrer";
  anchor.setAttribute("contenteditable", "false");
  anchor.setAttribute("data-link-pill", "1");
  anchor.setAttribute("data-preview-url", url);
  Object.assign(anchor.style, {
    display: "inline-flex", alignItems: "center", gap: "6px", background: "#1a1a1a",
    borderRadius: "8px", padding: "5px 10px", textDecoration: "none", fontSize: "12.5px",
    lineHeight: "1.3", maxWidth: "100%", verticalAlign: "middle", margin: "1px 2px",
  } satisfies Partial<CSSStyleDeclaration>);
  setImportantColor(anchor, "#fff");

  const icon = buildPlatformIconElement(platform.key);
  Object.assign(icon.style, { flexShrink: "0" } satisfies Partial<CSSStyleDeclaration>);
  const labelSpan = document.createElement("span");
  labelSpan.style.fontWeight = "600";
  labelSpan.textContent = platform.label;
  setImportantColor(labelSpan, "#fff");
  const urlSpan = document.createElement("span");
  Object.assign(urlSpan.style, {
    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "220px",
  } satisfies Partial<CSSStyleDeclaration>);
  setImportantColor(urlSpan, "#9aa0a6");
  urlSpan.textContent = shortenUrl(url);

  anchor.append(icon, labelSpan, urlSpan);
  return anchor;
}

/** Compact dark pill: icon + platform name + shortened URL — the "Link em linha" / typed-URL format. */
function buildAnchorHtml(url: string) {
  const { cleanUrl, trailingText } = splitTrailingUrlPunctuation(url.trim());
  const wrapper = document.createElement("span");
  wrapper.append(buildAnchorElement(cleanUrl));
  if (trailingText) wrapper.append(document.createTextNode(trailingText));
  return wrapper.innerHTML;
}

function buildLoadingPlaceholderHtml(id: string) {
  const span = document.createElement("span");
  span.id = id;
  span.setAttribute("contenteditable", "false");
  Object.assign(span.style, {
    display: "inline-flex", alignItems: "center", gap: "6px", borderRadius: "8px", background: "#1a1a1a",
    padding: "6px 10px", margin: "1px 2px", fontSize: "12px",
  } satisfies Partial<CSSStyleDeclaration>);
  setImportantColor(span, "#9aa0a6");
  span.textContent = "Carregando prévia…";
  return span.outerHTML;
}

/** Builds a small line-icon <svg> from a set of shape definitions (mirrors lucide icons). */
function createSvgIcon(children: IconChild[]): SVGSVGElement {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("width", "14");
  svg.setAttribute("height", "14");
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-width", "2");
  svg.setAttribute("stroke-linecap", "round");
  svg.setAttribute("stroke-linejoin", "round");
  children.forEach(({ tag, attrs, text }) => {
    const el = document.createElementNS("http://www.w3.org/2000/svg", tag);
    Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
    if (text) el.textContent = text;
    svg.append(el);
  });
  return svg;
}

/** The platform's brand-shaped icon (falls back to the generic globe if unrecognized). */
function buildPlatformIconElement(platformKey: string): SVGSVGElement {
  return createSvgIcon(PLATFORM_ICON_PATHS[platformKey] ?? PLATFORM_ICON_PATHS.web);
}

const TOOLBAR_ICON_PATHS = {
  link: [
    { tag: "path" as const, attrs: { d: "M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" } },
    { tag: "path" as const, attrs: { d: "M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" } },
  ],
  externalLink: [
    { tag: "path" as const, attrs: { d: "M15 3h6v6" } },
    { tag: "path" as const, attrs: { d: "M10 14 21 3" } },
    { tag: "path" as const, attrs: { d: "M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" } },
  ],
  expand: [
    { tag: "path" as const, attrs: { d: "M15 3h6v6" } },
    { tag: "path" as const, attrs: { d: "M9 21H3v-6" } },
    { tag: "path" as const, attrs: { d: "m21 3-7 7" } },
    { tag: "path" as const, attrs: { d: "m3 21 7-7" } },
  ],
  more: [
    { tag: "circle" as const, attrs: { cx: "12", cy: "12", r: "1" } },
    { tag: "circle" as const, attrs: { cx: "19", cy: "12", r: "1" } },
    { tag: "circle" as const, attrs: { cx: "5", cy: "12", r: "1" } },
  ],
};

function buildToolbarButton(action: string, iconKey: keyof typeof TOOLBAR_ICON_PATHS, title: string): HTMLButtonElement {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.title = title;
  btn.setAttribute("data-action", action);
  btn.setAttribute("contenteditable", "false");
  Object.assign(btn.style, {
    display: "inline-flex", alignItems: "center", justifyContent: "center", width: "24px", height: "24px",
    borderRadius: "6px", background: "rgba(0,0,0,0.55)", border: "none", cursor: "pointer", padding: "0",
  } satisfies Partial<CSSStyleDeclaration>);
  setImportantColor(btn, "#fff");
  btn.append(createSvgIcon(TOOLBAR_ICON_PATHS[iconKey]));
  return btn;
}

function buildResizeHandle(side: "left" | "right"): HTMLDivElement {
  const handle = document.createElement("div");
  handle.className = "up-lp-resize";
  handle.setAttribute("data-resize", side);
  handle.setAttribute("contenteditable", "false");
  Object.assign(handle.style, {
    position: "absolute", top: "0", bottom: "0", [side]: "0", width: "10px", cursor: "ew-resize",
  } satisfies Partial<CSSStyleDeclaration>);
  const grip = document.createElement("div");
  Object.assign(grip.style, {
    position: "absolute", top: "50%", [side]: "3px", transform: "translateY(-50%)",
    width: "4px", height: "32px", borderRadius: "2px", background: "rgba(255,255,255,0.6)",
  } satisfies Partial<CSSStyleDeclaration>);
  handle.append(grip);
  return handle;
}

/**
 * Image-first preview card (Notion-style embed): the OG image is the whole thumbnail (no
 * caption shown by default), scrollable if taller than the card, with a hover-revealed
 * top-right toolbar (copy link / open / expand / more) and side resize handles.
 */
function buildPreviewCardElement(url: string, data: LinkPreviewData): HTMLDivElement {
  const platform = detectPlatform(url);
  const card = document.createElement("div");
  card.className = "up-lp-card";
  card.setAttribute("contenteditable", "false");
  card.setAttribute("data-link-preview", "1");
  card.setAttribute("data-preview-url", url);
  Object.assign(card.style, {
    position: "relative", display: "block", width: "320px", maxWidth: "100%", borderRadius: "12px",
    overflow: "hidden", background: "#111214", border: "1px solid rgba(255,255,255,0.1)", margin: "6px 2px",
  } satisfies Partial<CSSStyleDeclaration>);

  if (data.image) {
    const imgWrap = document.createElement("div");
    Object.assign(imgWrap.style, {
      width: "100%", maxHeight: "360px", overflowY: "auto", background: "rgba(255,255,255,0.06)",
    } satisfies Partial<CSSStyleDeclaration>);
    const img = document.createElement("img");
    img.src = data.image;
    img.alt = "";
    img.draggable = false;
    Object.assign(img.style, { width: "100%", height: "auto", display: "block" } satisfies Partial<CSSStyleDeclaration>);
    imgWrap.append(img);
    card.append(imgWrap);
  } else {
    // No OG image to use as a thumbnail — fall back to a compact name/url row.
    const fallback = document.createElement("div");
    Object.assign(fallback.style, { display: "flex", alignItems: "center", gap: "10px", padding: "16px" } satisfies Partial<CSSStyleDeclaration>);
    const icon = buildPlatformIconElement(platform.key);
    Object.assign(icon.style, { width: "22px", height: "22px", flexShrink: "0" } satisfies Partial<CSSStyleDeclaration>);
    setImportantColor(icon, "#fff");
    const textCol = document.createElement("span");
    Object.assign(textCol.style, { minWidth: "0", flex: "1", overflow: "hidden" } satisfies Partial<CSSStyleDeclaration>);
    const nameSpan = document.createElement("span");
    Object.assign(nameSpan.style, { display: "block", fontSize: "13px", fontWeight: "600" } satisfies Partial<CSSStyleDeclaration>);
    setImportantColor(nameSpan, "#fff");
    nameSpan.textContent = data.site_name || platform.label;
    const urlSpan = document.createElement("span");
    Object.assign(urlSpan.style, { display: "block", fontSize: "11px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" } satisfies Partial<CSSStyleDeclaration>);
    setImportantColor(urlSpan, "rgba(255,255,255,0.5)");
    urlSpan.textContent = shortenUrl(url);
    textCol.append(nameSpan, urlSpan);
    fallback.append(icon, textCol);
    card.append(fallback);
  }

  const toolbar = document.createElement("div");
  toolbar.className = "up-lp-toolbar";
  toolbar.setAttribute("contenteditable", "false");
  Object.assign(toolbar.style, { position: "absolute", top: "8px", right: "8px", display: "flex", gap: "4px" } satisfies Partial<CSSStyleDeclaration>);
  toolbar.append(
    buildToolbarButton("copy", "link", "Copiar link"),
    buildToolbarButton("open", "externalLink", "Abrir link"),
    buildToolbarButton("expand", "expand", "Expandir"),
    buildToolbarButton("menu", "more", "Mais opções"),
  );
  card.append(toolbar, buildResizeHandle("left"), buildResizeHandle("right"));

  return card;
}

function buildPreviewCardHtml(url: string, data: LinkPreviewData) {
  return buildPreviewCardElement(url, data).outerHTML;
}

function linkifyHtmlContent(html: string) {
  if (!html) return "";

  const container = document.createElement("div");
  container.innerHTML = html;
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
  const textNodes: Text[] = [];
  let currentNode: Node | null;

  while ((currentNode = walker.nextNode())) {
    const textNode = currentNode as Text;
    const parent = textNode.parentElement;
    const text = textNode.textContent ?? "";

    if (!parent || parent.closest("a, code, pre, script, style")) continue;
    if (!new RegExp(URL_REGEX_SOURCE, "i").test(text)) continue;

    textNodes.push(textNode);
  }

  textNodes.forEach((textNode) => {
    const text = textNode.textContent ?? "";
    const matches = Array.from(text.matchAll(new RegExp(URL_REGEX_SOURCE, "gi")));
    if (matches.length === 0) return;

    const fragment = document.createDocumentFragment();
    let lastIndex = 0;

    matches.forEach((match) => {
      const rawUrl = match[0];
      const start = match.index ?? 0;
      const { cleanUrl, trailingText } = splitTrailingUrlPunctuation(rawUrl);

      if (start > lastIndex) {
        fragment.append(document.createTextNode(text.slice(lastIndex, start)));
      }

      fragment.append(buildAnchorElement(normalizeUrl(cleanUrl)));

      if (trailingText) {
        fragment.append(document.createTextNode(trailingText));
      }

      lastIndex = start + rawUrl.length;
    });

    if (lastIndex < text.length) {
      fragment.append(document.createTextNode(text.slice(lastIndex)));
    }

    textNode.parentNode?.replaceChild(fragment, textNode);
  });

  container.querySelectorAll("a[href]").forEach((anchor) => {
    anchor.setAttribute("target", "_blank");
    anchor.setAttribute("rel", "noopener noreferrer");
  });

  return container.innerHTML;
}

interface Props {
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  className?: string;
  minHeight?: string;
  onExpand?: () => void;
}

export function SmartCaptionEditor({ value, onChange, placeholder = "Escreva aqui...", className, minHeight = "80px", onExpand }: Props) {
  const editorRef = useRef<HTMLDivElement>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);
  const [toolbarPos, setToolbarPos] = useState<{ top: number; left: number } | null>(null);
  const [aiMenuOpen, setAiMenuOpen] = useState(false);
  const [headingMenuOpen, setHeadingMenuOpen] = useState(false);
  const [currentBlock, setCurrentBlock] = useState("p");
  const [aiLoading, setAiLoading] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyExpanded, setHistoryExpanded] = useState(false);
  const [history, setHistory] = useState<{ html: string; time: Date }[]>([]);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const [plainText, setPlainText] = useState("");
  const [spellPopover, setSpellPopover] = useState<{ error: SpellError; rect: DOMRect } | null>(null);
  const [pasteMenu, setPasteMenu] = useState<{ bottom: number; left: number; url: string; range: Range } | null>(null);
  const pasteMenuRef = useRef<HTMLDivElement>(null);
  const [embedMenu, setEmbedMenu] = useState<{ top: number; left: number; url: string; cardEl: HTMLElement } | null>(null);
  const embedMenuRef = useRef<HTMLDivElement>(null);
  const [expandedImage, setExpandedImage] = useState<string | null>(null);
  const resizeStateRef = useRef<{ cardEl: HTMLElement; startX: number; startWidth: number; side: "left" | "right" } | null>(null);

  // Close the "Colar como" menu on outside click / Escape — dismissing without picking an
  // option resumes the normal auto-save/auto-linkify pass we paused while it was open.
  useEffect(() => {
    if (!pasteMenu) return;
    const dismiss = () => {
      setPasteMenu(null);
      handleInput();
    };
    const onDocMouseDown = (e: MouseEvent) => {
      if (pasteMenuRef.current && !pasteMenuRef.current.contains(e.target as Node)) {
        dismiss();
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") dismiss();
    };
    document.addEventListener("mousedown", onDocMouseDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onDocMouseDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [pasteMenu]);

  // Close the "Exibir como" (embed format switcher) menu on outside click / Escape
  useEffect(() => {
    if (!embedMenu) return;
    const onDocMouseDown = (e: MouseEvent) => {
      if (embedMenuRef.current && !embedMenuRef.current.contains(e.target as Node)) {
        setEmbedMenu(null);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setEmbedMenu(null);
    };
    document.addEventListener("mousedown", onDocMouseDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onDocMouseDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [embedMenu]);

  // Close the image lightbox on Escape
  useEffect(() => {
    if (!expandedImage) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setExpandedImage(null);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [expandedImage]);

  // Hover preview for link pills/cards inside the editor content
  const [hoverPreview, setHoverPreview] = useState<{ top: number; left: number; url: string; pillEl: HTMLElement; data: LinkPreviewData | null | undefined; minimal?: boolean } | null>(null);
  const hoverTimeoutRef = useRef<ReturnType<typeof setTimeout>>();

  const handleEditorMouseOver = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const el = e.target as HTMLElement;
    // The compact inline pill gets the full hover popup (rich preview + delete). A modern
    // preview card shows everything inline already and has its own toolbar. But an older
    // card saved before that toolbar existed has no way to remove it at all — give those a
    // minimal delete-only popup too, matched by the absence of `.up-lp-toolbar`.
    const pill = el.closest("[data-link-pill]") as HTMLElement | null;
    const legacyCard = !pill ? (el.closest("[data-link-preview]") as HTMLElement | null) : null;
    const isLegacyCard = !!legacyCard && !legacyCard.querySelector(".up-lp-toolbar");
    const target = pill ?? (isLegacyCard ? legacyCard : null);
    if (!target) return;
    const url = target.getAttribute("data-preview-url");
    if (!url) return;
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    hoverTimeoutRef.current = setTimeout(async () => {
      const rect = target.getBoundingClientRect();
      const editorRect = editorRef.current?.getBoundingClientRect();
      if (!editorRect) return;
      // No gap between the target and the popup below it — a gap creates a "dead zone" where
      // the mouse is over neither element while moving down into the popup, closing it early.
      const top = rect.bottom - editorRect.top;
      const left = rect.left - editorRect.left;
      if (isLegacyCard) {
        setHoverPreview({ top, left, url, pillEl: target, data: null, minimal: true });
        return;
      }
      setHoverPreview({ top, left, url, pillEl: target, data: undefined });
      const data = await fetchLinkPreview(url);
      setHoverPreview((prev) => (prev && prev.url === url ? { ...prev, data } : prev));
    }, 250);
  }, []);

  /** Removes a link pill directly from its hover popup — the only affordance pills have,
   * since single-clicking one opens the link instead of placing a cursor next to it. */
  const handleDeletePill = useCallback((pillEl: HTMLElement) => {
    pillEl.remove();
    setHoverPreview(null);
    handleInput();
  }, []);

  const handleEditorMouseOut = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const related = e.relatedTarget as HTMLElement | null;
    if (related?.closest?.("[data-link-pill],[data-link-hover-card]")) return;
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    // Small grace period instead of closing instantly — `relatedTarget` isn't always reliable
    // (varies by input method), so this gives the popup's own onMouseEnter a chance to cancel
    // the close if the pointer actually landed inside it (e.g. on the "Excluir" button).
    hoverTimeoutRef.current = setTimeout(() => setHoverPreview(null), 250);
  }, []);

  const stripHtmlToPlain = (html: string) => {
    const tmp = document.createElement("div");
    tmp.innerHTML = html;
    return tmp.textContent || tmp.innerText || "";
  };

  const { errors: spellErrors, ignoreWord, recheck: recheckSpelling } = useSpellcheck(plainText);

  // Sync content when value changes externally (e.g. switching between subtasks)
  const lastSyncedValue = useRef(value);
  useEffect(() => {
    if (!editorRef.current) return;

    const normalizedValue = linkifyHtmlContent(value || "");

    if (value !== lastSyncedValue.current) {
      editorRef.current.innerHTML = normalizedValue;
      lastSyncedValue.current = normalizedValue;
      setPlainText(stripHtmlToPlain(normalizedValue));
      if (normalizedValue) {
        setHistory([{ html: normalizedValue, time: new Date() }]);
      }
    } else if (!editorRef.current.innerHTML && normalizedValue) {
      editorRef.current.innerHTML = normalizedValue;
      lastSyncedValue.current = normalizedValue;
      setPlainText(stripHtmlToPlain(normalizedValue));
      setHistory([{ html: normalizedValue, time: new Date() }]);
    }
  }, [value]);

  const getUrlFromPointer = useCallback((clientX: number, clientY: number) => {
    const docWithCaret = document as Document & {
      caretRangeFromPoint?: (x: number, y: number) => Range | null;
      caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null;
    };

    const caretPosition = docWithCaret.caretPositionFromPoint?.(clientX, clientY);
    const caretRange = !caretPosition ? docWithCaret.caretRangeFromPoint?.(clientX, clientY) : null;
    const node = caretPosition?.offsetNode ?? caretRange?.startContainer ?? null;
    const offset = caretPosition?.offset ?? caretRange?.startOffset ?? 0;

    if (!node || node.nodeType !== Node.TEXT_NODE) return null;

    const text = node.textContent ?? "";
    let start = Math.min(offset, text.length);
    let end = Math.min(offset, text.length);

    while (start > 0 && !/\s/.test(text[start - 1] ?? "")) start -= 1;
    while (end < text.length && !/\s/.test(text[end] ?? "")) end += 1;

    const token = text.slice(start, end).trim();
    const { cleanUrl } = splitTrailingUrlPunctuation(token);

    return new RegExp(`^${URL_REGEX_SOURCE}$`, "i").test(cleanUrl) ? normalizeUrl(cleanUrl) : null;
  }, []);

  const handleEditorMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;

    // Drag-to-resize a preview card from its left/right handle
    const resizeHandle = target.closest("[data-resize]") as HTMLElement | null;
    if (resizeHandle) {
      e.preventDefault();
      e.stopPropagation();
      const cardEl = resizeHandle.closest("[data-link-preview]") as HTMLElement | null;
      if (!cardEl) return;
      const side = resizeHandle.getAttribute("data-resize") as "left" | "right";
      resizeStateRef.current = { cardEl, startX: e.clientX, startWidth: cardEl.offsetWidth, side };
      const onMove = (ev: MouseEvent) => {
        const st = resizeStateRef.current;
        if (!st) return;
        const delta = ev.clientX - st.startX;
        const signedDelta = st.side === "right" ? delta : -delta;
        const maxWidth = (editorRef.current?.clientWidth ?? 800) - 8;
        st.cardEl.style.width = `${Math.max(180, Math.min(maxWidth, st.startWidth + signedDelta))}px`;
      };
      const onUp = () => {
        resizeStateRef.current = null;
        document.removeEventListener("mousemove", onMove);
        document.removeEventListener("mouseup", onUp);
        handleInput();
      };
      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onUp);
      return;
    }

    // Toolbar buttons on a preview card (copy link / open / expand / more options)
    const actionBtn = target.closest("[data-action]") as HTMLElement | null;
    if (actionBtn) {
      const cardEl = actionBtn.closest("[data-link-preview]") as HTMLElement | null;
      const url = cardEl?.getAttribute("data-preview-url");
      if (cardEl && url) {
        e.preventDefault();
        e.stopPropagation();
        const action = actionBtn.getAttribute("data-action");
        if (action === "copy") {
          navigator.clipboard?.writeText(url).then(
            () => toast.success("Link copiado!"),
            () => toast.error("Não foi possível copiar o link"),
          );
        } else if (action === "open") {
          window.open(url, "_blank", "noopener,noreferrer");
        } else if (action === "expand") {
          const img = cardEl.querySelector("img");
          if (img?.src) setExpandedImage(img.src);
        } else if (action === "menu") {
          const rect = actionBtn.getBoundingClientRect();
          const editorRect = editorRef.current?.getBoundingClientRect();
          if (editorRect) {
            setEmbedMenu({ top: rect.bottom - editorRect.top + 6, left: Math.max(0, rect.right - editorRect.left - 208), url, cardEl });
          }
        }
      }
      return;
    }

    // A click directly on an already-linkified <a> opens it right away — no modifier needed.
    // Clicks elsewhere (including on raw URL text not yet wrapped in <a>) still require
    // Ctrl/Cmd so normal cursor placement / text editing keeps working everywhere else.
    const anchor = target.closest("a[href]");
    const href = anchor instanceof HTMLAnchorElement
      ? anchor.href
      : (e.ctrlKey || e.metaKey) ? getUrlFromPointer(e.clientX, e.clientY) : null;
    if (!href) return;
    e.preventDefault();
    e.stopPropagation();
    window.open(href, "_blank", "noopener,noreferrer");
  }, [getUrlFromPointer]);

  // Debounced auto-save
  const handleInput = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setSaveStatus("saving");
    setSpellPopover(null);
    debounceRef.current = setTimeout(() => {
      if (editorRef.current) {
        const rawHtml = editorRef.current.innerHTML;
        const html = linkifyHtmlContent(rawHtml);
        if (html !== rawHtml) {
          editorRef.current.innerHTML = html;
        }
        lastSyncedValue.current = html;
        onChange(html);
        setPlainText(stripHtmlToPlain(html));
        setHistory(prev => {
          const last = prev[prev.length - 1];
          if (last?.html === html) return prev;
          return [...prev.slice(-19), { html, time: new Date() }];
        });
        setSaveStatus("saved");
      }
    }, 600);
  }, [onChange]);

  const handleEditorPaste = useCallback((e: React.ClipboardEvent<HTMLDivElement>) => {
    const pastedText = e.clipboardData.getData("text/plain").trim();

    if (!pastedText || !new RegExp(`^${URL_REGEX_SOURCE}$`, "i").test(pastedText)) {
      return;
    }
    const url = normalizeUrl(pastedText);
    const editorEl = editorRef.current;
    if (!editorEl) return;

    // Let the browser paste the URL as plain text normally (so it's always visibly there),
    // then locate exactly what was just inserted and offer to convert it via a menu that
    // floats above it — never hiding or delaying the actual paste.
    requestAnimationFrame(() => {
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0) return;
      const caret = sel.getRangeAt(0);
      const endNode = caret.startContainer;
      const endOffset = caret.startOffset;
      if (endNode.nodeType !== Node.TEXT_NODE || endOffset < pastedText.length) return;

      const range = document.createRange();
      range.setStart(endNode, endOffset - pastedText.length);
      range.setEnd(endNode, endOffset);
      if (range.toString() !== pastedText) return; // rich clipboard data landed differently — skip the menu, keep the paste

      // Cancel the debounced auto-save/auto-linkify that the native paste's `input` event just
      // queued — otherwise it can convert this exact text into a pill while the menu is still
      // open, and picking an option afterwards inserts a second copy on top of it.
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
        debounceRef.current = undefined;
      }

      const rangeRect = range.getBoundingClientRect();
      const editorRect = editorEl.getBoundingClientRect();
      setPasteMenu({
        bottom: editorRect.height - (rangeRect.top - editorRect.top) + 8,
        left: Math.max(0, rangeRect.left - editorRect.left),
        url,
        range,
      });
    });
  }, []);

  const restoreSelection = useCallback((range: Range) => {
    const sel = window.getSelection();
    if (!sel) return;
    sel.removeAllRanges();
    sel.addRange(range);
  }, []);

  const handlePasteAsInlineLink = useCallback(() => {
    if (!pasteMenu) return;
    restoreSelection(pasteMenu.range);
    document.execCommand("insertHTML", false, buildAnchorHtml(pasteMenu.url));
    handleInput();
    setPasteMenu(null);
  }, [pasteMenu, restoreSelection, handleInput]);

  const handlePasteAsPreview = useCallback(async () => {
    if (!pasteMenu) return;
    const { url, range } = pasteMenu;
    setPasteMenu(null);
    restoreSelection(range);

    const placeholderId = `link-preview-loading-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    document.execCommand("insertHTML", false, buildLoadingPlaceholderHtml(placeholderId));
    handleInput();

    const data = await fetchLinkPreview(url);
    const placeholder = editorRef.current?.querySelector(`#${placeholderId}`);
    if (!placeholder) return; // user edited/removed it before the fetch finished
    placeholder.outerHTML = data && (data.title || data.image) ? buildPreviewCardHtml(url, data) : buildAnchorHtml(url);
    handleInput();
  }, [pasteMenu, restoreSelection, handleInput]);

  /** Converts (or deletes) an already-inserted preview card via its "..." menu. */
  const handleEmbedConvert = useCallback((format: "pill" | "delete") => {
    if (!embedMenu) return;
    const { cardEl, url } = embedMenu;
    setEmbedMenu(null);
    if (format === "delete") {
      cardEl.remove();
    } else if (format === "pill") {
      cardEl.outerHTML = buildAnchorHtml(url);
    }
    handleInput();
  }, [embedMenu, handleInput]);

  // Show floating toolbar on selection
  const updateToolbarPosition = useCallback(() => {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || !editorRef.current?.contains(sel.anchorNode)) {
      setToolbarPos(null);
      setAiMenuOpen(false);
      setHeadingMenuOpen(false);
      return;
    }
    const range = sel.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    const editorRect = editorRef.current.getBoundingClientRect();
    const val = (document.queryCommandValue("formatBlock") || "").toLowerCase().replace(/[<>"]/g, "") || "p";
    setCurrentBlock(val);
    setToolbarPos({
      top: rect.top - editorRect.top - 48,
      left: Math.max(0, Math.min(rect.left - editorRect.left + rect.width / 2 - 160, editorRect.width - 340)),
    });
  }, []);

  // Detect cursor inside a spell-error word (Word-style)
  const checkCursorForSpellError = useCallback(() => {
    const sel = window.getSelection();
    if (!sel || !editorRef.current?.contains(sel.anchorNode)) {
      return;
    }

    // Only show spell popover when cursor is collapsed (no text selected, which would show toolbar)
    if (!sel.isCollapsed) {
      setSpellPopover(null);
      return;
    }

    // Get cursor offset in plain text
    const walker = document.createTreeWalker(editorRef.current, NodeFilter.SHOW_TEXT);
    let cumOffset = 0;
    let node: Text | null;
    let cursorPlainOffset = -1;

    while ((node = walker.nextNode() as Text | null)) {
      if (node === sel.anchorNode) {
        cursorPlainOffset = cumOffset + sel.anchorOffset;
        break;
      }
      cumOffset += (node.textContent?.length || 0);
    }

    if (cursorPlainOffset < 0) { setSpellPopover(null); return; }

    // Find if cursor is inside any error
    const hitError = spellErrors.find(e =>
      cursorPlainOffset >= e.offset && cursorPlainOffset <= e.offset + e.length
    );

    if (!hitError) { setSpellPopover(null); return; }

    // Get the rect of the error word to position the popover
    const walker2 = document.createTreeWalker(editorRef.current, NodeFilter.SHOW_TEXT);
    let cum2 = 0;
    let foundRect: DOMRect | null = null;
    while ((node = walker2.nextNode() as Text | null)) {
      const len = node.textContent?.length || 0;
      if (cum2 + len > hitError.offset) {
        const localStart = Math.max(hitError.offset - cum2, 0);
        const localEnd = Math.min(hitError.offset + hitError.length - cum2, len);
        try {
          const range = document.createRange();
          range.setStart(node, localStart);
          range.setEnd(node, localEnd);
          foundRect = range.getBoundingClientRect();
        } catch {}
        break;
      }
      cum2 += len;
    }

    if (foundRect && foundRect.width > 0) {
      setSpellPopover({ error: hitError, rect: foundRect });
    } else {
      setSpellPopover(null);
    }
  }, [spellErrors]);

  useEffect(() => {
    const handleSelectionChange = () => {
      updateToolbarPosition();
      checkCursorForSpellError();
    };
    document.addEventListener("selectionchange", handleSelectionChange);
    return () => document.removeEventListener("selectionchange", handleSelectionChange);
  }, [updateToolbarPosition, checkCursorForSpellError]);

  const execCmd = useCallback((cmd: string) => {
    document.execCommand(cmd, false);
    editorRef.current?.focus();
    handleInput();
  }, [handleInput]);

  const applyHeading = useCallback((tag: string) => {
    const current = (document.queryCommandValue("formatBlock") || "").toLowerCase().replace(/[<>"]/g, "") || "p";
    if (current === tag) {
      document.execCommand("formatBlock", false, "<p>");
      setCurrentBlock("p");
    } else {
      document.execCommand("formatBlock", false, `<${tag}>`);
      setCurrentBlock(tag);
    }
    editorRef.current?.focus();
    handleInput();
    setHeadingMenuOpen(false);
  }, [handleInput]);

  // AI improve
  const handleAiAction = useCallback(async (action: string) => {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed) return;

    const selectedText = sel.toString().trim();
    if (!selectedText) return;

    setAiLoading(true);
    setAiMenuOpen(false);

    try {
      const { data, error } = await supabase.functions.invoke("ai-improve-text", {
        body: { text: selectedText, action },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const result = data?.result;
      if (result) {
        const currentSel = window.getSelection();
        if (currentSel && currentSel.rangeCount > 0) {
          const range = currentSel.getRangeAt(0);
          range.deleteContents();
          range.insertNode(document.createTextNode(result));
          if (editorRef.current) onChange(editorRef.current.innerHTML);
        }
        toast.success("Texto melhorado com IA!");
      }
    } catch (e: any) {
      console.error("AI improve error:", e);
      toast.error(e?.message || "Erro ao melhorar texto");
    } finally {
      setAiLoading(false);
      setToolbarPos(null);
    }
  }, [onChange]);

  const showPlaceholder = !value || value === "<br>" || value === "<div><br></div>";
  const currentHeading = HEADING_OPTIONS.find(h => h.tag === currentBlock) ?? HEADING_OPTIONS[0];
  const CurrentHeadingIcon = currentHeading.icon;

  const restoreFromHistory = useCallback((entry: { html: string; time: Date }) => {
    if (editorRef.current) {
      editorRef.current.innerHTML = entry.html;
      onChange(entry.html);
      setSaveStatus("saved");
      setHistoryOpen(false);
    }
  }, [onChange]);

  const stripHtml = (html: string) => {
    const tmp = document.createElement("div");
    tmp.innerHTML = html;
    return tmp.textContent || tmp.innerText || "";
  };

  const formatTime = (d: Date) =>
    d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });

  // Spell correction: replace word in editor
  const handleSpellReplace = useCallback((error: SpellError, replacement: string) => {
    const el = editorRef.current;
    if (!el) return;

    // Walk text nodes to find the error offset
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    let cumOffset = 0;
    let node: Text | null;
    while ((node = walker.nextNode() as Text | null)) {
      const len = node.textContent?.length || 0;
      if (cumOffset + len > error.offset) {
        const localStart = error.offset - cumOffset;
        const localEnd = localStart + error.length;
        const range = document.createRange();
        range.setStart(node, localStart);
        range.setEnd(node, Math.min(localEnd, len));

        // If error spans multiple nodes, just handle first
        range.deleteContents();
        range.insertNode(document.createTextNode(replacement));

        // Normalize to merge adjacent text nodes
        el.normalize();

        const html = el.innerHTML;
        lastSyncedValue.current = html;
        onChange(html);
        setPlainText(stripHtmlToPlain(html));
        break;
      }
      cumOffset += len;
    }
    setSpellPopover(null);
  }, [onChange]);

  const handleSpellIgnore = useCallback((error: SpellError) => {
    ignoreWord(error.word);
    setSpellPopover(null);
  }, [ignoreWord]);

  return (
    <div className={cn("relative", className)}>
      {/* Hover-reveal for preview card toolbar/resize handles (plain CSS — the card lives in raw editor HTML, not React) */}
      <style>{`
        .up-lp-toolbar, .up-lp-resize { opacity: 0; transition: opacity .12s ease; }
        .up-lp-card:hover .up-lp-toolbar, .up-lp-card:hover .up-lp-resize { opacity: 1; }
        .up-lp-toolbar button:hover { background: rgba(0,0,0,0.8) !important; }
      `}</style>

      {/* Top-right status bar */}
      <div className="absolute top-1.5 right-1.5 z-40 flex items-center gap-1 rounded-lg border border-border/30 bg-muted/80 backdrop-blur-sm px-1.5 py-0.5">
        {/* Saved status */}
        {saveStatus === "saved" && (
          <div className="flex items-center gap-1 text-[11px] text-muted-foreground pr-1 border-r border-border/30">
            <CheckCircle2 className="h-3 w-3 text-emerald-500" />
            <span>Salvo</span>
          </div>
        )}

        {/* Spell error count */}
        {spellErrors.length > 0 && (
          <div className="flex items-center gap-1 text-[11px] text-destructive pr-1 border-r border-border/30">
            <AlertCircle className="h-3 w-3" />
            <span>{spellErrors.length} {spellErrors.length === 1 ? "erro" : "erros"}</span>
          </div>
        )}
        {/* History toggle */}
        <button
          type="button"
          onClick={() => setHistoryOpen(v => !v)}
          className={cn(
            "inline-flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground",
            historyOpen && "bg-accent text-foreground"
          )}
          title="Histórico de edições"
        >
          <Clock className="h-3.5 w-3.5" />
        </button>

        {/* Expand */}
        {onExpand && (
          <button
            type="button"
            onClick={onExpand}
            className="inline-flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            title="Expandir"
          >
            <Maximize2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Backdrop to close history on outside click */}
      {historyOpen && (
        <div className="fixed inset-0 z-30" onClick={() => { setHistoryOpen(false); setHistoryExpanded(false); }} />
      )}

      {/* History panel */}
      {historyOpen && !historyExpanded && (
        <div className="absolute top-8 right-1.5 z-40 w-64 max-h-48 overflow-hidden rounded-xl border border-border/40 bg-popover shadow-xl animate-in fade-in-0 slide-in-from-top-2 duration-150">
          <div className="flex items-center justify-between px-3 py-2 border-b border-border/30">
            <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Histórico de edições</p>
            <button type="button" onClick={() => setHistoryExpanded(true)} className="inline-flex h-5 w-5 items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-accent transition-colors" title="Expandir">
              <Maximize2 className="h-3 w-3" />
            </button>
          </div>
          <div className="overflow-y-auto max-h-[136px]">
            {history.length === 0 ? (
              <p className="px-3 py-3 text-xs text-muted-foreground">Nenhuma edição ainda</p>
            ) : (
              [...history].reverse().map((entry, i) => (
                <button key={i} type="button" onClick={() => restoreFromHistory(entry)} className="flex w-full items-center gap-2 px-3 py-2 text-xs hover:bg-accent transition-colors border-b border-border/10 last:border-0">
                  <Clock className="h-3 w-3 text-muted-foreground shrink-0" />
                  <span className="text-muted-foreground whitespace-nowrap">{formatTime(entry.time)}</span>
                  <span className="text-foreground truncate flex-1 text-left">{stripHtml(entry.html).slice(0, 30) || "(vazio)"}</span>
                </button>
              ))
            )}
          </div>
        </div>
      )}

      {/* Expanded history - full overlay */}
      {historyOpen && historyExpanded && (
        <div className="absolute inset-0 z-40 rounded-lg border border-border/40 bg-popover shadow-xl animate-in fade-in-0 duration-150 flex flex-col overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border/30">
            <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Histórico de edições</p>
            <button type="button" onClick={() => setHistoryExpanded(false)} className="inline-flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-accent transition-colors" title="Reduzir">
              <Maximize2 className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto">
            {history.length === 0 ? (
              <p className="px-4 py-4 text-sm text-muted-foreground">Nenhuma edição ainda</p>
            ) : (
              [...history].reverse().map((entry, i) => (
                <button key={i} type="button" onClick={() => restoreFromHistory(entry)} className="flex w-full items-start gap-3 px-4 py-3 text-sm hover:bg-accent transition-colors border-b border-border/10 last:border-0">
                  <Clock className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                  <div className="flex-1 text-left">
                    <span className="text-muted-foreground text-xs block mb-1">{formatTime(entry.time)}</span>
                    <span className="text-foreground line-clamp-3">{stripHtml(entry.html) || "(vazio)"}</span>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
      {/* Editor */}
      <div
        ref={editorRef}
        contentEditable
        onMouseDown={handleEditorMouseDown}
        onMouseOver={handleEditorMouseOver}
        onMouseOut={handleEditorMouseOut}
        onPaste={handleEditorPaste}
        onInput={handleInput}
        onBlur={() => {
          if (debounceRef.current) clearTimeout(debounceRef.current);
          if (editorRef.current) {
            const html = linkifyHtmlContent(editorRef.current.innerHTML);
            if (html !== editorRef.current.innerHTML) {
              editorRef.current.innerHTML = html;
            }
            lastSyncedValue.current = html;
            onChange(html);
          }
        }}
        data-placeholder={placeholder}
        className={cn(
          "w-full rounded-lg border border-border/40 bg-background px-3 py-2",
          "text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary/40",
          "[&_*]:!text-inherit [&_span]:!text-inherit [&_div]:!text-inherit [&_p]:!text-inherit [&_font]:!text-inherit",
          "[&_a]:!text-blue-600 [&_a]:!cursor-pointer [&_a:hover]:!text-blue-700",
          "[&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5",
          "[&_h1]:text-xl [&_h1]:font-bold [&_h1]:mb-2 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:mb-1 [&_h3]:text-base [&_h3]:font-semibold [&_h3]:mb-1 [&_h4]:text-sm [&_h4]:font-semibold [&_h4]:mb-0.5",
          "empty:before:content-[attr(data-placeholder)] empty:before:text-muted-foreground/50 empty:before:pointer-events-none",
          showPlaceholder && !editorRef.current?.innerHTML && "before:content-[attr(data-placeholder)] before:text-muted-foreground/50",
        )}
        style={{ minHeight }}
        suppressContentEditableWarning
      />

      {/* Hover preview for link pills/cards */}
      {hoverPreview && (
        <div
          data-link-hover-card="1"
          className="absolute z-50 animate-in fade-in-0 duration-100"
          style={{ top: hoverPreview.top, left: hoverPreview.left }}
          onMouseEnter={() => { if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current); }}
          onMouseLeave={() => setHoverPreview(null)}
        >
          <div className="overflow-hidden rounded-xl shadow-2xl">
            {hoverPreview.minimal ? null : hoverPreview.data === undefined ? (
              <div className="w-72 border border-white/10 bg-[#111214] p-3 text-[12px] text-white/60">
                Carregando prévia…
              </div>
            ) : hoverPreview.data ? (
              <LinkPreviewBody url={hoverPreview.url} data={hoverPreview.data} />
            ) : (
              <div className="w-72 border border-white/10 bg-[#111214] p-3 text-[12px] text-white/60">
                Sem prévia disponível
              </div>
            )}
            <button
              type="button"
              onMouseDown={(e) => { e.preventDefault(); handleDeletePill(hoverPreview.pillEl); }}
              className={cn(
                "flex w-full items-center justify-center gap-1.5 bg-[#111214] py-2 text-[11px] font-semibold text-red-300 transition-colors hover:bg-red-500/10",
                hoverPreview.minimal ? "w-40 rounded-lg border border-white/10" : "border-x border-b border-white/10",
              )}
            >
              <Trash2 className="h-3.5 w-3.5" />
              Excluir link
            </button>
          </div>
        </div>
      )}

      {/* "Colar como" menu — shown right after pasting a bare URL; floats above the pasted text so it never covers it */}
      {pasteMenu && (
        <div
          ref={pasteMenuRef}
          className="absolute z-50 w-56 rounded-xl border border-white/10 shadow-2xl p-1 animate-in fade-in-0 slide-in-from-bottom-2 duration-150"
          style={{ bottom: pasteMenu.bottom, left: pasteMenu.left, background: GRADIENT_MENU }}
        >
          <p className="px-2 py-1.5 text-[10px] text-white/50 font-semibold uppercase tracking-wider">Colar como</p>
          <button
            type="button"
            onMouseDown={(e) => { e.preventDefault(); handlePasteAsInlineLink(); }}
            className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-sm transition-colors hover:bg-white/10"
          >
            <Link2 className="h-4 w-4 shrink-0 text-white/60" />
            <span className="flex-1 text-left font-medium text-white/90">Link em linha</span>
          </button>
          <button
            type="button"
            onMouseDown={(e) => { e.preventDefault(); handlePasteAsPreview(); }}
            className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-sm transition-colors hover:bg-white/10"
          >
            <GalleryHorizontal className="h-4 w-4 shrink-0 text-white/60" />
            <span className="flex-1 text-left font-medium text-white/90">Pré-visualizar</span>
            <Check className="h-4 w-4 text-white" />
          </button>
        </div>
      )}

      {/* "Exibir como" menu — opened from a preview card's "..." toolbar button */}
      {embedMenu && (
        <div
          ref={embedMenuRef}
          className="absolute z-50 w-56 rounded-xl border border-white/10 shadow-2xl p-1 animate-in fade-in-0 slide-in-from-top-2 duration-150"
          style={{ top: embedMenu.top, left: embedMenu.left, background: GRADIENT_MENU }}
        >
          <p className="px-2 py-1.5 text-[10px] text-white/50 font-semibold uppercase tracking-wider">Exibir como</p>
          <button
            type="button"
            onMouseDown={(e) => { e.preventDefault(); handleEmbedConvert("pill"); }}
            className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-sm transition-colors hover:bg-white/10"
          >
            <Link2 className="h-4 w-4 shrink-0 text-white/60" />
            <span className="flex-1 text-left font-medium text-white/90">Link em linha</span>
          </button>
          <button
            type="button"
            onMouseDown={(e) => { e.preventDefault(); setEmbedMenu(null); }}
            className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-sm transition-colors hover:bg-white/10"
          >
            <GalleryHorizontal className="h-4 w-4 shrink-0 text-white/60" />
            <span className="flex-1 text-left font-medium text-white/90">Pré-visualizar</span>
            <Check className="h-4 w-4 text-white" />
          </button>
          <div className="my-1 h-px bg-white/10" />
          <button
            type="button"
            onMouseDown={(e) => { e.preventDefault(); handleEmbedConvert("delete"); }}
            className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-sm text-red-300 transition-colors hover:bg-red-500/10"
          >
            <Trash2 className="h-4 w-4 shrink-0" />
            <span className="flex-1 text-left font-medium">Excluir</span>
          </button>
        </div>
      )}

      {/* Image lightbox — opened from a preview card's "expand" toolbar button */}
      {expandedImage && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 p-6 animate-in fade-in-0 duration-150"
          onClick={() => setExpandedImage(null)}
        >
          <button
            type="button"
            onClick={() => setExpandedImage(null)}
            className="absolute top-4 right-4 inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
          >
            <X className="h-5 w-5" />
          </button>
          <img
            src={expandedImage}
            alt=""
            className="max-h-full max-w-full rounded-lg object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

      {/* Spell check overlay */}
      <SpellCheckOverlay
        editorRef={editorRef as React.RefObject<HTMLDivElement>}
        errors={spellErrors}
      />

      {/* Spell suggestion popover */}
      {spellPopover && (
        <SpellSuggestionPopover
          error={spellPopover.error}
          anchorRect={spellPopover.rect}
          onSelect={(replacement) => handleSpellReplace(spellPopover.error, replacement)}
          onIgnore={() => handleSpellIgnore(spellPopover.error)}
          onClose={() => setSpellPopover(null)}
        />
      )}

      {/* Floating toolbar */}
      {toolbarPos && !aiLoading && (
        <div
          ref={toolbarRef}
          className="absolute z-50 flex items-center gap-0.5 rounded-xl border border-white/15 shadow-2xl p-1 animate-in fade-in-0 zoom-in-95 duration-150"
          style={{ top: toolbarPos.top, left: toolbarPos.left, background: GRADIENT_TOOLBAR }}
          onMouseDown={(e) => e.preventDefault()}
        >
          {/* Undo / Redo */}
          <button
            type="button"
            onMouseDown={(e) => { e.preventDefault(); execCmd("undo"); }}
            className="inline-flex h-7 w-7 items-center justify-center rounded-md text-white/70 transition-colors hover:bg-white/15 hover:text-white"
            title="Desfazer (Ctrl+Z)"
          >
            <Undo2 className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onMouseDown={(e) => { e.preventDefault(); execCmd("redo"); }}
            className="inline-flex h-7 w-7 items-center justify-center rounded-md text-white/70 transition-colors hover:bg-white/15 hover:text-white"
            title="Refazer (Ctrl+Shift+Z)"
          >
            <Redo2 className="h-3.5 w-3.5" />
          </button>

          <div className="mx-0.5 h-5 w-px bg-white/15" />

          {/* Heading dropdown */}
          <div className="relative">
            <button
              type="button"
              onMouseDown={(e) => { e.preventDefault(); setHeadingMenuOpen(v => !v); setAiMenuOpen(false); }}
              className={cn(
                "inline-flex h-7 items-center gap-0.5 rounded-md px-1.5 text-white/70 transition-colors hover:bg-white/15 hover:text-white",
                headingMenuOpen && "bg-white/20 text-white"
              )}
              title="Transformar em"
            >
              <CurrentHeadingIcon className="h-3.5 w-3.5" />
              <ChevronDown className="h-3 w-3" />
            </button>
            {headingMenuOpen && (
              <div
                className="absolute top-full left-0 mt-1 w-56 rounded-xl border border-white/10 shadow-2xl p-1 z-50 animate-in fade-in-0 slide-in-from-top-2 duration-150"
                style={{ background: GRADIENT_MENU }}
              >
                <p className="px-2 py-1.5 text-[10px] text-white/50 font-semibold uppercase tracking-wider">Transformar em</p>
                {HEADING_OPTIONS.map((opt) => {
                  const OptIcon = opt.icon;
                  const isActive = currentBlock === opt.tag;
                  return (
                    <button
                      key={opt.tag}
                      type="button"
                      onMouseDown={(e) => { e.preventDefault(); applyHeading(opt.tag); }}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-lg px-2 py-2 text-sm transition-colors hover:bg-white/10",
                        isActive && "bg-white/15"
                      )}
                    >
                      <OptIcon className="h-4 w-4 shrink-0 text-white/60" />
                      <span className="flex-1 text-left font-medium text-white/90">{opt.label}</span>
                      {isActive && <Check className="h-4 w-4 text-white" />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="mx-0.5 h-5 w-px bg-white/15" />

          {/* Format buttons */}
          {TOOLBAR_BUTTONS.map((item, i) => {
            if ("divider" in item) {
              return <div key={`d-${i}`} className="mx-0.5 h-5 w-px bg-white/15" />;
            }
            const Ico = item.icon;
            return (
              <button
                key={item.cmd}
                type="button"
                onMouseDown={(e) => { e.preventDefault(); execCmd(item.cmd); }}
                className="inline-flex h-7 w-7 items-center justify-center rounded-md text-white/70 transition-colors hover:bg-white/15 hover:text-white"
                title={item.label}
              >
                <Ico className="h-3.5 w-3.5" />
              </button>
            );
          })}

          <div className="mx-0.5 h-5 w-px bg-white/15" />

          {/* AI button */}
          <div className="relative">
            <button
              type="button"
              onMouseDown={(e) => { e.preventDefault(); setAiMenuOpen(v => !v); setHeadingMenuOpen(false); }}
              className={cn(
                "inline-flex h-7 items-center gap-1 rounded-md px-1.5 text-white/70 transition-colors hover:bg-white/15 hover:text-white",
                aiMenuOpen && "bg-white/20 text-white"
              )}
              title="Melhorar com IA"
            >
              <Wand2 className="h-3.5 w-3.5" />
              <span className="text-[10px] font-medium">IA</span>
            </button>

            {aiMenuOpen && (
              <div
                className="absolute top-full right-0 mt-1 w-64 rounded-xl border border-white/10 shadow-2xl p-1 z-50 animate-in fade-in-0 slide-in-from-top-2 duration-150"
                style={{ background: GRADIENT_MENU }}
              >
                <p className="px-2 py-1.5 text-[10px] text-white/50 font-semibold uppercase tracking-wider">
                  Melhorar com IA
                </p>
                {AI_ACTIONS.map((a) => {
                  const Ico = a.icon;
                  return (
                    <button
                      key={a.key}
                      type="button"
                      onMouseDown={(e) => { e.preventDefault(); handleAiAction(a.key); }}
                      className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-sm transition-colors hover:bg-white/10"
                    >
                      <Ico className="h-4 w-4 shrink-0 text-white/50" />
                      <span className="flex-1 text-left font-medium text-white/90">{a.label}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* AI loading overlay */}
      {aiLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/60 rounded-lg backdrop-blur-sm z-50">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Melhorando texto...</span>
          </div>
        </div>
      )}
    </div>
  );
}
