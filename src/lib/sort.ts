// Default order of every list of people, clients or squads: alphabetical by name. The Intl collator knows Portuguese
// (accents and case do not push "Ótica" after "Zé") and numbers ("Cliente 2" before "Cliente 10").
const collator = new Intl.Collator("pt-BR", { sensitivity: "base", numeric: true });

export const compareNames = (a: string | null | undefined, b: string | null | undefined) => collator.compare(a ?? "", b ?? "");

/** `list.sort(byName((x) => x.name))` */
export const byName = <T,>(get: (item: T) => string | null | undefined) => (a: T, b: T) => compareNames(get(a), get(b));
