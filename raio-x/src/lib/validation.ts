/** DDDs válidos no Brasil (Anatel). */
const VALID_DDDS = new Set([
  11, 12, 13, 14, 15, 16, 17, 18, 19, 21, 22, 24, 27, 28, 31, 32, 33, 34, 35, 37, 38, 41, 42,
  43, 44, 45, 46, 47, 48, 49, 51, 53, 54, 55, 61, 62, 63, 64, 65, 66, 67, 68, 69, 71, 73, 74,
  75, 77, 79, 81, 82, 83, 84, 85, 86, 87, 88, 89, 91, 92, 93, 94, 95, 96, 97, 98, 99,
]);

export function onlyDigits(value: string): string {
  return value.replace(/\D/g, "");
}

/** Máscara: (11) 98765-4321 ou (11) 3456-7890. Remove o +55 se vier colado. */
export function maskWhatsApp(value: string): string {
  let d = onlyDigits(value);
  if (d.length > 11 && d.startsWith("55")) d = d.slice(2);
  d = d.slice(0, 11);
  if (d.length === 0) return "";
  if (d.length <= 2) return `(${d}`;
  const ddd = d.slice(0, 2);
  const rest = d.slice(2);
  if (rest.length <= 4) return `(${ddd}) ${rest}`;
  if (d.length === 11) return `(${ddd}) ${rest.slice(0, 5)}-${rest.slice(5)}`;
  return `(${ddd}) ${rest.slice(0, 4)}-${rest.slice(4)}`;
}

/**
 * Celular: DDD + 9 + 8 dígitos. Também aceita fixo (DDD + 8 dígitos
 * começando com 2 a 5), porque existe WhatsApp Business em número fixo.
 */
export function isValidWhatsApp(value: string): boolean {
  let d = onlyDigits(value);
  if (d.length > 11 && d.startsWith("55")) d = d.slice(2);
  if (!VALID_DDDS.has(Number(d.slice(0, 2)))) return false;
  if (d.length === 11) return d[2] === "9";
  if (d.length === 10) return /[2-5]/.test(d[2]);
  return false;
}

/** Normaliza para o formato E.164 sem o "+": 5511987654321. */
export function normalizeWhatsApp(value: string): string {
  let d = onlyDigits(value);
  if (d.length > 11 && d.startsWith("55")) d = d.slice(2);
  return `55${d}`;
}

/** Aceita "@perfil", "perfil" ou o link do perfil. Devolve sem o @. */
export function normalizeInstagram(value: string): string {
  let v = value.trim();
  const fromUrl = v.match(/instagram\.com\/([^/?#\s]+)/i);
  if (fromUrl) v = fromUrl[1];
  return v.replace(/^@+/, "").toLowerCase();
}

export function isValidInstagram(value: string): boolean {
  const v = normalizeInstagram(value);
  if (v === "") return true; // opcional
  return /^(?!.*\.\.)(?!\.)(?!.*\.$)[a-z0-9._]{1,30}$/.test(v);
}

export function isValidName(value: string): boolean {
  const v = value.trim();
  return v.length >= 2 && v.length <= 80;
}

/** Primeiro nome, para "SEU RAIO-X, MARIA". */
export function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] ?? "";
}
