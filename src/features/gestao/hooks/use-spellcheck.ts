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

interface UseSpellcheckOptions {
  enabled?: boolean;
  debounceMs?: number;
}

export function useSpellcheck(text: string, options: UseSpellcheckOptions = {}) {
  const { enabled = true, debounceMs = 500 } = options;
  const [errors, setErrors] = useState<SpellError[]>([]);
  const [checking, setChecking] = useState(false);
  const [ignored, setIgnored] = useState<Set<string>>(new Set());
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
        body: new URLSearchParams({ text: plainText, language: "pt-BR" }),
        signal: controller.signal,
      });
      if (!res.ok) throw new Error("API error");
      const data = await res.json();
      lastCheckedRef.current = plainText;

      const mapped: SpellError[] = (data.matches || []).map((m: any) => ({
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
    setIgnored(prev => new Set(prev).add(word.toLowerCase()));
  }, []);

  const filteredErrors = errors.filter(e => !ignored.has(e.word.toLowerCase()));

  const recheck = useCallback(() => {
    lastCheckedRef.current = "";
    checkSpelling(text);
  }, [text, checkSpelling]);

  return { errors: filteredErrors, checking, ignoreWord, recheck, allErrorCount: errors.length };
}
