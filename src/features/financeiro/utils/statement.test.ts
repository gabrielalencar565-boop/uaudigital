import { describe, expect, it } from "vitest";
import { parseStatementCsv, parseMoney } from "./parse-statement";
import { buildHistoryIndex, categoryFromHistory } from "./categorize";

// Same layout as the Sicoob "extrato completo" export (names and values are made up).
const SICOOB = [
  "Data;Histórico de Movimentação;Valor (R$);Tipo (C/D)",
  "29/06/2026;PIX RECEB.OUTRA IF Recebimento Pix Maria Teste da Silva;1.200,00;C",
  "29/06/2026;PIX EMIT.OUTRA IF Pagamento Pix ***.861.953-** RESERVA;219,00;D",
  "25/06/2026;TRANSF.RECEB-PIX SI REM.: EMPRESA EXEMPLO LTDA;1.497,00;C",
  "23/06/2026;TRANSF. PIX SICOOB FAV.: GRAFICA DEMO LTDA;17,97;D",
  "22/06/2026;SALDO DO DIA;100,00;C",
  "",
].join("\n");

describe("parseStatementCsv", () => {
  it("reads the Sicoob layout (value + C/D columns)", () => {
    const rows = parseStatementCsv(SICOOB);
    expect(rows).toHaveLength(4);
    expect(rows[0]).toMatchObject({ date: "2026-06-29", amount: 1200, type: "entrada" });
    expect(rows[1]).toMatchObject({ amount: 219, type: "saida" });
    expect(rows[3]).toMatchObject({ amount: 17.97, type: "saida" });
  });
  it("reads the multi-column Sicoob layout and rebuilds the description from counterpart, CPF/CNPJ and note", () => {
    const rows = parseStatementCsv([
      "Data;Histórico;Modalidade;Contraparte;CPF/CNPJ;Descrição;Documento;Tipo;Valor",
      "01/07/2026;PIX EMIT.OUTRA IF;Pagamento Pix;;***.861.953-**;CARTAO NUBANK;Pix;Débito;-132,00",
      "01/07/2026;PIX RECEB.OUTRA IF;Recebimento Pix;A M LEITE & CIA LTDA;10.915.751 0001-91;;Pix;Crédito;1497,00",
      "01/07/2026;DEB PACOTE SERVIÇOS;;;;;129;Débito;-18,00",
      "06/07/2026;PIX RECEB.OUTRA IF;Recebimento Pix;44.139.688 AYRTON MANOEL;44.139.688 0001-60;pagamento ponto G;Pix;Crédito;1794,20",
    ].join("\n"));
    expect(rows).toHaveLength(4);
    expect(rows[0]).toMatchObject({ description: "PIX EMIT.OUTRA IF Pagamento Pix ***.861.953-** CARTAO NUBANK", amount: 132, type: "saida" });
    expect(rows[1]).toMatchObject({ description: "PIX RECEB.OUTRA IF Recebimento Pix A M LEITE & CIA LTDA 10.915.751 0001-91", amount: 1497, type: "entrada" });
    expect(rows[2]).toMatchObject({ description: "DEB PACOTE SERVIÇOS", type: "saida" });
    expect(rows[3].description).toContain("pagamento ponto G");
  });
  it("keeps the old headerless layout working", () => {
    const rows = parseStatementCsv("Data;Descricao;Doc;Valor\n05/10/2026;DAS SIMPLES;1;-340,00\n06/10/2026;MENSALIDADE;2;1500,00");
    expect(rows.map((r) => [r.type, r.amount])).toEqual([["saida", 340], ["entrada", 1500]]);
  });
  it("parses money with thousands separators", () => {
    expect(parseMoney("1.234,56")).toBe(1234.56);
    expect(parseMoney("R$ 10,00 D")).toBe(10);
  });
});

describe("categoryFromHistory with bank boilerplate", () => {
  const index = buildHistoryIndex([
    { description: "MARIA TESTE DA SILVA SOUZA", category: "receita_recorrente", type: "entrada" },
    { description: "EMPRESA EXEMPLO 1/2", category: "receita_recorrente", type: "entrada" },
    { description: "RESERVA", category: "despesa_outros", type: "saida" },
    { description: "GRAFICA DEMO", category: "despesa_operacional", type: "saida" },
  ]);
  it("matches names even with the bank's wrapper text around them", () => {
    expect(categoryFromHistory(index, "PIX RECEB.OUTRA IF Recebimento Pix Maria Teste da Silva", "entrada")).toBe("receita_recorrente");
    expect(categoryFromHistory(index, "TRANSF.RECEB-PIX SI REM.: EMPRESA EXEMPLO LTDA", "entrada")).toBe("receita_recorrente");
    expect(categoryFromHistory(index, "PIX EMIT.OUTRA IF Pagamento Pix ***.861.953-** RESERVA", "saida")).toBe("despesa_outros");
    expect(categoryFromHistory(index, "TRANSF. PIX SICOOB FAV.: GRAFICA DEMO LTDA", "saida")).toBe("despesa_operacional");
  });
  it("never crosses entrada and saída, and stays silent for unknown names", () => {
    expect(categoryFromHistory(index, "Recebimento Pix Pessoa Desconhecida Xyz", "entrada")).toBeNull();
    expect(categoryFromHistory(index, "Pagamento Pix MARIA TESTE DA SILVA", "saida")).toBeNull();
  });
});
