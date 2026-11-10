import { describe, expect, it } from "vitest";
import { dataDoPost, gradeDoMes, lerMes, rotuloDoPost } from "../datas";

describe("datas do plano", () => {
  it("lê o mês do plano", () => {
    expect(lerMes("novembro de 2026")).toEqual({ mes: 10, ano: 2026 });
    expect(lerMes("março de 2027")).toEqual({ mes: 2, ano: 2027 });
    expect(lerMes("qualquer coisa")).toBeNull();
  });

  it("semana 1 começa na primeira segunda do mês", () => {
    // 1º/11/2026 é domingo → primeira segunda é dia 2
    expect(dataDoPost("novembro de 2026", 1, "Seg")).toMatchObject({ dia: 2, mes: 10, foraDoMes: false });
    expect(dataDoPost("novembro de 2026", 4, "Sex")).toMatchObject({ dia: 27, mes: 10 });
    // 1º/12/2026 é terça → primeira segunda é dia 7
    expect(dataDoPost("dezembro de 2026", 1, "Seg")).toMatchObject({ dia: 7, mes: 11 });
    // 1º/6/2026 é segunda → dia 1
    expect(dataDoPost("junho de 2026", 1, "Seg")).toMatchObject({ dia: 1, mes: 5 });
  });

  it("marca quando a data passa para o mês seguinte", () => {
    // dezembro/2026: semana 4 começa dia 28; sábado = 2/1/2027
    expect(dataDoPost("dezembro de 2026", 4, "Sáb")).toMatchObject({ dia: 2, mes: 0, ano: 2027, foraDoMes: true });
  });

  it("monta a grade de 4 semanas de segunda a domingo", () => {
    const g = gradeDoMes("novembro de 2026")!;
    expect(g).toHaveLength(4);
    expect(g[0].map((d) => d.dia)).toEqual([2, 3, 4, 5, 6, 7, 8]);
    expect(g[3][6].dia).toBe(29);
  });

  it("rótulo curto do post", () => {
    expect(rotuloDoPost("novembro de 2026", 2, { dia: "Qua" })).toBe("Qua 11/11");
    expect(rotuloDoPost("mês inválido", 2, { dia: "Qua" })).toBe("Qua");
  });
});
