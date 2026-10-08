import { useState, useRef, useCallback, useEffect } from "react";

export interface SpellError {
  offset: number;
  length: number;
  message: string;
  shortMessage: string;
  suggestions: string[];
  rule: string;
  word: string;
}

// Only real mistakes: spelling, grammar and confused words. LanguageTool also reports style, typography, casing and
// "formal vs informal" rules (double spaces, "vc", ".digital" in a handle...) that are noise for social-media copy.
const ENABLED_CATEGORIES = "TYPOS,GRAMMAR,CONFUSED_WORDS";
const IGNORED_STORAGE_KEY = "fluxo-spellcheck-ignored";

function loadIgnored(): Set<string> {
  try {
    const raw = localStorage.getItem(IGNORED_STORAGE_KEY);
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}
function saveIgnored(set: Set<string>) {
  try { localStorage.setItem(IGNORED_STORAGE_KEY, JSON.stringify([...set].slice(-500))); } catch { /* preference only */ }
}

/** Things a dictionary can't judge: handles, hashtags, links, numbers, e-mails, acronyms, names (capitalized, no suggestion). */
export function isNotASpellingMistake(plainText: string, m: { offset: number; length: number; rule?: { id?: string }; replacements?: unknown[] }): boolean {
  const start = plainText.lastIndexOf(" ", m.offset - 1) + 1;
  const nl = plainText.lastIndexOf("\n", m.offset - 1) + 1;
  const tokenStart = Math.max(start, nl);
  let tokenEnd = m.offset + m.length;
  while (tokenEnd < plainText.length && !/\s/.test(plainText[tokenEnd])) tokenEnd++;
  const token = plainText.slice(tokenStart, tokenEnd);
  if (/^[@#]/.test(token) || /https?:|www\.|\.(com|br|app|io|net|org)\b|@/.test(token) || /\d/.test(token)) return true;
  const word = plainText.slice(m.offset, m.offset + m.length);
  if (word.length < 3) return true;
  if (word === word.toUpperCase() && /[A-ZÀ-Ú]/.test(word)) return true; // acronyms: ROI, CRM, SEO
  const isSpelling = (m.rule?.id ?? "").startsWith("MORFOLOGIK");
  if (isSpelling && (m.replacements?.length ?? 0) === 0) return true; // the dictionary has no idea either: a name or jargon
  if (isSpelling && /^[A-ZÀ-Ú]/.test(word) && m.offset > 0 && !/[.!?\n]\s*$/.test(plainText.slice(0, m.offset))) return true; // capitalized mid-sentence: a name
  return false;
}

interface UseSpellcheckOptions {
  enabled?: boolean;
  debounceMs?: number;
}

export function useSpellcheck(text: string, options: UseSpellcheckOptions = {}) {
  const { enabled = true, debounceMs = 500 } = options;
  const [errors, setErrors] = useState<SpellError[]>([]);
  const [checking, setChecking] = useState(false);
  const [ignored, setIgnored] = useState<Set<string>>(() => loadIgnored());
  const lastCheckedRef = useRef("");
  const abortRef = useRef<AbortController | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  const checkSpelling = useCallback(async (plainText: string) => {
    if (!plainText.trim() || plainText.trim().length < 3) {
      setErrors([]);
      return;
    }
    if (plainText === lastCheckedRef.current) return;

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setChecking(true);
    try {
      const res = await fetch("https://api.languagetool.org/v2/check", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        // the editor keeps non-breaking spaces (&nbsp;); same length as a normal space, so offsets still match
        body: new URLSearchParams({
          text: plainText.replace(/\u00a0/g, " "),
          language: "pt-BR",
          enabledOnly: "true",
          enabledCategories: ENABLED_CATEGORIES,
        }),
        signal: controller.signal,
      });
      if (!res.ok) throw new Error("API error");
      const data = await res.json();
      lastCheckedRef.current = plainText;

      const mapped: SpellError[] = (data.matches || []).filter((m: any) => !isNotASpellingMistake(plainText, m)).map((m: any) => ({
        offset: m.offset,
        length: m.length,
        message: m.message,
        shortMessage: m.shortMessage || m.message,
        suggestions: (m.replacements || []).slice(0, 5).map((r: any) => r.value),
        rule: m.rule?.id || "",
        word: plainText.slice(m.offset, m.offset + m.length),
      }));

      setErrors(mapped);
    } catch (e: any) {
      if (e.name !== "AbortError") {
        console.warn("Spellcheck error:", e);
      }
    } finally {
      setChecking(false);
    }
  }, []);

  useEffect(() => {
    if (!enabled) { setErrors([]); return; }
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => checkSpelling(text), debounceMs);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [text, enabled, debounceMs, checkSpelling]);

  useEffect(() => {
    return () => { abortRef.current?.abort(); };
  }, []);

  const ignoreWord = useCallback((word: string) => {
    setIgnored((prev) => {
      const next = new Set(prev).add(word.toLowerCase());
      saveIgnored(next); // "Ignorar" now sticks across tasks and reloads
      return next;
    });
  }, []);

  const filteredErrors = errors.filter(e => !ignored.has(e.word.toLowerCase()));

  const recheck = useCallback(() => {
    lastCheckedRef.current = "";
    checkSpelling(text);
  }, [text, checkSpelling]);

  return { errors: filteredErrors, checking, ignoreWord, recheck, allErrorCount: errors.length };
}
