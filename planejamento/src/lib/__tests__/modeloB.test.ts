import { describe, expect, it } from "vitest";
import { FASE_IDS } from "@/data/fases";
import { OBJETIVO_IDS, POSTS_POR_SEMANA, TOM_IDS } from "@/data/formulario";
import { contagemFases, montarEsqueleto } from "@/lib/distribuicao";
import { FormSchema, type FormInput } from "@/lib/input";
import { gerarPlanoModelo } from "@/lib/modeloB";
import { PlanoSchema, validarPlano } from "@/lib/plano";
import { AURORA } from "./fixtures/aurora";

const MES = "novembro de 2026";

describe("plano B (modelos prontos)", () => {
  it("o exemplo da Clínica Aurora é um formulário válido", () => {
    expect(FormSchema.safeParse(AURORA).success).toBe(true);
  });

  it("gera um plano válido no schema para todas as combinações", () => {
    for (const objetivo of OBJETIVO_IDS) {
      for (const postsPorSemana of POSTS_POR_SEMANA) {
        for (const tom of TOM_IDS) {
          const form: FormInput = { ...AURORA, objetivo, postsPorSemana, tom };
          const plano = gerarPlanoModelo(form, MES);
          const r = PlanoSchema.safeParse(plano);
          if (!r.success) throw new Error(JSON.stringify(r.error.issues.slice(0, 3)));
          expect(plano.semanas.flatMap((s) => s.posts)).toHaveLength(postsPorSemana * 4);
          // Distribuição de fases bate com a contagem do objetivo.
          const contagem = contagemFases(objetivo, postsPorSemana * 4);
          for (const fase of FASE_IDS) {
            expect(plano.semanas.flatMap((s) => s.posts).filter((p) => p.fase === fase)).toHaveLength(contagem[fase]);
          }
        }
      }
    }
  });

  it("preenche as variáveis (sem chaves sobrando) e usa só formatos aceitos", () => {
    const plano = gerarPlanoModelo(AURORA, MES);
    const texto = JSON.stringify(plano);
    expect(texto).not.toMatch(/\{\w+\}/);
    expect(texto).toContain("clareamento dental");
    expect(texto).toContain("vergonha de sorrir nas fotos");
    expect(plano.objetivo_mes).toBe(
      "Fazer Clínica Aurora ser vista como a escolha mais segura para clareamento dental por mulheres de 25 a 45 anos em Teresina, gerando mais agendamentos pelo Instagram.",
    );
    for (const p of plano.semanas.flatMap((s) => s.posts)) {
      expect(["reels_com_rosto", "carrossel", "estatico"]).toContain(p.formato);
      expect(p.gancho.length).toBeLessThanOrEqual(140);
    }
  });

  it("encaixa a data especial na semana certa", () => {
    const plano = gerarPlanoModelo(AURORA, MES);
    const semana3 = plano.semanas[2].posts.map((p) => p.gancho).join(" | ");
    expect(semana3).toContain("Semana do sorriso dia 20");
    expect(plano.semanas[2].posts.find((p) => p.gancho.includes("Semana do sorriso"))!.por_que).toContain("data importante");
  });

  it("saúde: sem antes e depois promocional e CTAs sem captação agressiva", () => {
    const plano = gerarPlanoModelo({ ...AURORA, postsPorSemana: 5 }, MES);
    const ganchos = plano.semanas.flatMap((s) => s.posts.map((p) => p.gancho));
    expect(ganchos.some((g) => /antes e depois real, com autorização$/i.test(g))).toBe(false);
  });

  it("advocacia: não usa o modelo de antes e depois", () => {
    const plano = gerarPlanoModelo({ ...AURORA, nicho: "advogado", servico: "divórcio", postsPorSemana: 5 }, MES);
    expect(JSON.stringify(plano)).not.toMatch(/antes e depois/i);
  });

  it("objeção 'Outro' entra nos posts de resistência", () => {
    const plano = gerarPlanoModelo({ ...AURORA, objecoes: [], objecaoOutro: "Acha que vai ficar artificial" }, MES);
    const resistencia = plano.semanas.flatMap((s) => s.posts).filter((p) => p.fase === "resistencia");
    expect(resistencia.some((p) => p.gancho.includes("Acha que vai ficar artificial"))).toBe(true);
  });
});

describe("validação do JSON da IA", () => {
  const esqueleto = montarEsqueleto(AURORA);
  const base = gerarPlanoModelo(AURORA, MES, esqueleto);

  it("aceita um plano correto e alinha fase/dia/formato ao esqueleto", () => {
    const bagunçado = structuredClone(base);
    bagunçado.semanas[0].posts[0].fase = "recompensa";
    bagunçado.semanas[0].posts[0].dia = "Sáb";
    const ok = validarPlano(bagunçado, esqueleto)!;
    expect(ok).not.toBeNull();
    expect(ok.semanas[0].posts[0].fase).toBe(esqueleto[0][0].fase);
    expect(ok.semanas[0].posts[0].dia).toBe(esqueleto[0][0].dia);
  });

  it("recusa JSON fora do schema", () => {
    expect(validarPlano({ objetivo_mes: "x" }, esqueleto)).toBeNull();
    const semMetas = { ...base, metas: [] };
    expect(validarPlano(semMetas, esqueleto)).toBeNull();
    const faseInvalida = structuredClone(base) as unknown as { semanas: { posts: { fase: string }[] }[] };
    faseInvalida.semanas[1].posts[0].fase = "viralizar";
    expect(validarPlano(faseInvalida, esqueleto)).toBeNull();
  });

  it("recusa quando falta semana ou post", () => {
    expect(validarPlano({ ...base, semanas: base.semanas.slice(0, 3) }, esqueleto)).toBeNull();
    const menos = structuredClone(base);
    menos.semanas[2].posts.pop();
    expect(validarPlano(menos, esqueleto)).toBeNull();
  });
});
