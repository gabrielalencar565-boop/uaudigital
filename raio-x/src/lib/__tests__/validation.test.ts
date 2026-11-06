import { describe, expect, it } from "vitest";
import {
  firstName,
  isValidInstagram,
  isValidWhatsApp,
  maskWhatsApp,
  normalizeInstagram,
  normalizeWhatsApp,
} from "@/lib/validation";

describe("WhatsApp", () => {
  it("aplica a máscara brasileira", () => {
    expect(maskWhatsApp("11987654321")).toBe("(11) 98765-4321");
    expect(maskWhatsApp("1134567890")).toBe("(11) 3456-7890");
    expect(maskWhatsApp("119")).toBe("(11) 9");
    expect(maskWhatsApp("+55 11 98765-4321")).toBe("(11) 98765-4321");
    expect(maskWhatsApp("")).toBe("");
  });

  it("valida DDD e formato", () => {
    expect(isValidWhatsApp("(11) 98765-4321")).toBe(true);
    expect(isValidWhatsApp("(85) 3456-7890")).toBe(true);
    expect(isValidWhatsApp("(11) 88765-4321")).toBe(false); // celular sem 9
    expect(isValidWhatsApp("(20) 98765-4321")).toBe(false); // DDD inexistente
    expect(isValidWhatsApp("(11) 9876-543")).toBe(false);
  });

  it("normaliza com 55", () => {
    expect(normalizeWhatsApp("(11) 98765-4321")).toBe("5511987654321");
  });
});

describe("Instagram", () => {
  it("normaliza @, link e maiúsculas", () => {
    expect(normalizeInstagram("@UauDigital")).toBe("uaudigital");
    expect(normalizeInstagram("https://instagram.com/uaudigital/")).toBe("uaudigital");
  });

  it("é opcional, mas valida quando preenchido", () => {
    expect(isValidInstagram("")).toBe(true);
    expect(isValidInstagram("@maria.social_")).toBe(true);
    expect(isValidInstagram("maria social")).toBe(false);
    expect(isValidInstagram("maria..social")).toBe(false);
  });
});

it("firstName", () => {
  expect(firstName("  Maria  Clara Souza ")).toBe("Maria");
});
