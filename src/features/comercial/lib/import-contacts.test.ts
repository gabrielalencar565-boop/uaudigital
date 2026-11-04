import { describe, expect, it } from "vitest";
import { findDuplicates, normalizeInstagram, normalizePhone, parseContacts, parseLine, phoneHasDdd } from "./import-contacts";

describe("normalizeInstagram", () => {
  it("aceita @, link e minúsculas", () => {
    expect(normalizeInstagram("@DraAnaSouza")).toBe("@draanasouza");
    expect(normalizeInstagram("instagram.com/drcarloslima")).toBe("@drcarloslima");
    expect(normalizeInstagram("https://www.instagram.com/joao.mendes/?hl=pt")).toBe("@joao.mendes");
    expect(normalizeInstagram("draana")).toBe("@draana");
  });
  it("devolve vazio quando não é perfil", () => {
    expect(normalizeInstagram("")).toBe("");
    expect(normalizeInstagram("a")).toBe("");
    expect(normalizeInstagram("nome com espaço")).toBe("");
  });
});

describe("normalizePhone", () => {
  it("só números, sem o 55", () => {
    expect(normalizePhone("(86) 99999-1234")).toBe("86999991234");
    expect(normalizePhone("+55 86 99999-1234")).toBe("86999991234");
    expect(normalizePhone("86988887777")).toBe("86988887777");
    expect(normalizePhone("86 3222-1234")).toBe("8632221234");
  });
  it("aceita sem DDD", () => {
    expect(normalizePhone("99999-1234")).toBe("999991234");
    expect(phoneHasDdd("999991234")).toBe(false);
    expect(phoneHasDdd("86999991234")).toBe(true);
  });
  it("rejeita o que não é telefone", () => {
    expect(normalizePhone("123")).toBe("");
    expect(normalizePhone("123456789012345")).toBe("");
  });
});

describe("parseContacts — exemplos do pedido", () => {
  const rows = parseContacts(
    [
      "Dra. Ana Souza - Dermatologista - @draanasouza - (86) 99999-1234",
      "Dr. Carlos Lima, Pediatra, instagram.com/drcarloslima",
      "Clínica Sorriso | Odontologia | 86988887777",
      "João Mendes - Advogado Trabalhista - @joaomendesadv",
    ].join("\n"),
  );
  it("separa os quatro contatos", () => {
    expect(rows.map((r) => [r.name, r.specialty, r.instagram, r.phone])).toEqual([
      ["Dra. Ana Souza", "Dermatologista", "@draanasouza", "86999991234"],
      ["Dr. Carlos Lima", "Pediatra", "@drcarloslima", ""],
      ["Clínica Sorriso", "Odontologia", "", "86988887777"],
      ["João Mendes", "Advogado Trabalhista", "@joaomendesadv", ""],
    ]);
  });
});

describe("parseLine — variações", () => {
  it("tab e ponto e vírgula", () => {
    expect(parseLine("Maria Clara\tNutricionista\t@mariaclara\t86 98888-7777")).toMatchObject({ name: "Maria Clara", specialty: "Nutricionista", instagram: "@mariaclara", phone: "86988887777" });
    expect(parseLine("Pedro; Cardiologista; 11 97777-6666")).toMatchObject({ name: "Pedro", specialty: "Cardiologista", phone: "11977776666" });
  });
  it("hífen sem espaço não separa o nome", () => {
    expect(parseLine("Maria-Clara - Psicóloga")).toMatchObject({ name: "Maria-Clara", specialty: "Psicóloga" });
  });
  it("ignora marcador de lista", () => {
    expect(parseLine("1. Dr. Paulo - Ortopedista")).toMatchObject({ name: "Dr. Paulo", specialty: "Ortopedista" });
    expect(parseLine("• Dra. Lia - Pediatra")).toMatchObject({ name: "Dra. Lia", specialty: "Pediatra" });
  });
  it("não confunde e-mail com Instagram", () => {
    const r = parseLine("Ana - Dentista - ana@clinica.com - @anadentista");
    expect(r?.instagram).toBe("@anadentista");
  });
  it("linha sem nome é mantida e fica com nome vazio", () => {
    const r = parseLine("@soperfil 86999990000");
    expect(r).toMatchObject({ name: "", instagram: "@soperfil", phone: "86999990000" });
  });
  it("campos extras entram na especialidade, sem se perder", () => {
    expect(parseLine("Dr. Rui - Cardiologista - Clínica Vida - Teresina")?.specialty).toBe("Cardiologista · Clínica Vida · Teresina");
  });
  it("linha vazia vira nada", () => {
    expect(parseLine("   ")).toBeNull();
    expect(parseContacts("\n\n")).toEqual([]);
  });
});

describe("parseContacts — planilha com cabeçalho", () => {
  it("lê por colunas, em qualquer ordem", () => {
    const csv = ["Telefone;Nome;Especialidade;Instagram", "(86) 99999-1234;Dra. Ana;Dermato;instagram.com/draana", ";Dr. Beto;Pediatra;"].join("\n");
    expect(parseContacts(csv).map((r) => [r.name, r.specialty, r.instagram, r.phone])).toEqual([
      ["Dra. Ana", "Dermato", "@draana", "86999991234"],
      ["Dr. Beto", "Pediatra", "", ""],
    ]);
  });
  it("respeita aspas com vírgula dentro", () => {
    const csv = ['Nome,Especialidade,Telefone', '"Silva, Dr. João",Cardio,86 99999-0000'].join("\n");
    expect(parseContacts(csv)[0]).toMatchObject({ name: "Silva, Dr. João", specialty: "Cardio", phone: "86999990000" });
  });
});

describe("findDuplicates", () => {
  const existing = [
    { id: "1", name: "Dra. Ana Souza", phone: "(86) 99999-1234", instagram: "@DraAnaSouza" },
    { id: "2", name: "Clínica Sorriso", phone: "556988887777", instagram: null },
  ];
  it("acha por Instagram e por telefone (com ou sem DDD/55)", () => {
    const d = findDuplicates(
      [
        { phone: "", instagram: "@draanasouza" },
        { phone: "6988887777", instagram: "" },
        { phone: "99999-1234", instagram: "" },
        { phone: "11911112222", instagram: "@novo" },
      ],
      existing,
    );
    expect(d[0]).toMatchObject({ kind: "crm", by: "instagram", label: "Dra. Ana Souza" });
    expect(d[1]).toMatchObject({ kind: "crm", by: "telefone", label: "Clínica Sorriso" });
    expect(d[2]).toMatchObject({ kind: "crm", by: "telefone" });
    expect(d[3]).toBeNull();
  });
  it("marca repetido dentro da própria lista, a primeira vale", () => {
    const d = findDuplicates([{ phone: "", instagram: "@x1" }, { phone: "", instagram: "@X1" }, { phone: "11922223333", instagram: "" }, { phone: "11922223333", instagram: "" }], []);
    expect(d[0]).toBeNull();
    expect(d[1]).toMatchObject({ kind: "lista", by: "instagram", label: "linha 1" });
    expect(d[2]).toBeNull();
    expect(d[3]).toMatchObject({ kind: "lista", by: "telefone", label: "linha 3" });
  });
});
