import { describe, expect, it } from "vitest";
import { isNotASpellingMistake } from "./use-spellcheck";

const match = (text: string, word: string, rule = "MORFOLOGIK_RULE_PT_BR", replacements: string[] = ["x"]) => ({
  offset: text.indexOf(word),
  length: word.length,
  rule: { id: rule },
  replacements,
});

describe("isNotASpellingMistake", () => {
  it("keeps real spelling mistakes", () => {
    const t = "Nós fizemos um otimo trabalho para você";
    expect(isNotASpellingMistake(t, match(t, "otimo", "MORFOLOGIK_RULE_PT_BR", ["ótimo"]))).toBe(false);
  });

  it("keeps grammar mistakes", () => {
    const t = "Os cliente precisa de atenção";
    expect(isNotASpellingMistake(t, match(t, "Os cliente", "GENERAL_NUMBER_AGREEMENT_ERRORS"))).toBe(false);
  });

  it("ignores handles, hashtags, links and words with numbers", () => {
    const t = "Siga @uau.digital e #marketingdigital em https://appfluxo.app.br ou fale com a agencia2026";
    expect(isNotASpellingMistake(t, match(t, ".digital", "ESPACO_APOS_PONTO"))).toBe(true);
    expect(isNotASpellingMistake(t, match(t, "marketingdigital"))).toBe(true);
    expect(isNotASpellingMistake(t, match(t, "appfluxo"))).toBe(true);
    expect(isNotASpellingMistake(t, match(t, "agencia2026"))).toBe(true);
  });

  it("ignores acronyms and names the dictionary can't suggest anything for", () => {
    const t = "O ROI da Uau Digital subiu com a Kaleidoscopia";
    expect(isNotASpellingMistake(t, match(t, "ROI"))).toBe(true);
    expect(isNotASpellingMistake(t, match(t, "Kaleidoscopia", "MORFOLOGIK_RULE_PT_BR", []))).toBe(true);
  });

  it("ignores a capitalized word in the middle of a sentence (a name), but not at the start of one", () => {
    const mid = "Fale com a Jhonatan hoje";
    expect(isNotASpellingMistake(mid, match(mid, "Jhonatan"))).toBe(true);
    const start = "Ótimo dia. Oticmo resultado";
    expect(isNotASpellingMistake(start, match(start, "Oticmo"))).toBe(false);
  });
});
