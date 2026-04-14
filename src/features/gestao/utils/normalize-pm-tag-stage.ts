export function normalizePmTagStageKey(name: string) {
  const normalizedName = name
    .trim()
    .toLocaleLowerCase("pt-BR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "_");

  return `tag_${normalizedName}`;
}