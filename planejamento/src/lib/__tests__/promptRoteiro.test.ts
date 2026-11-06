import { describe, expect, it } from "vitest";
import { gerarPlanoModelo } from "@/lib/modeloB";
import type { PlanoMeta } from "@/lib/plano";
import { promptDoPost } from "@/lib/promptRoteiro";
import { AURORA } from "./fixtures/aurora";

const MES = "novembro de 2026";
const meta: PlanoMeta = { mes: MES, cliente: "Clínica Aurora", nicho: "Clínica odontológica", fonte: "modelo" };

describe("prompt do roteiro", () => {
  const plano = gerarPlanoModelo({ ...AURORA, formatos: ["reels_com_rosto", "reels_sem_rosto", "carrossel", "estatico"] }, MES);
  const posts = plano.semanas.flatMap((s) => s.posts.map((p) => ({ p, semana: s.numero })));

  it("traz marca, público, post e o pedido certo para cada formato", () => {
    for (const { p, semana } of posts) {
      const prompt = promptDoPost(p, plano, meta, semana);
      expect(prompt).toContain("Clínica Aurora");
      expect(prompt).toContain(p.gancho);
      expect(prompt).toContain(p.cta);
      expect(prompt).toContain(plano.publico.dor);
      expect(prompt).toContain(`semana ${semana}, ${p.dia}`);
      if (p.formato === "carrossel") expect(prompt).toContain("slides");
      if (p.formato.startsWith("reels")) expect(prompt).toContain("Roteiro cena a cena");
      if (p.formato === "estatico") expect(prompt).toContain("Texto principal da arte");
      expect(prompt).not.toMatch(/undefined|\{\w+\}/);
    }
  });

  it("inclui as regras de publicidade da saúde e da advocacia", () => {
    const { p } = posts[0];
    expect(promptDoPost(p, plano, meta, 1)).toContain("área da saúde");
    expect(promptDoPost(p, plano, { ...meta, nicho: "Advogado(a)" }, 1)).toContain("captação direta");
    expect(promptDoPost(p, plano, { ...meta, nicho: "Restaurante/Delivery" }, 1)).not.toMatch(/saúde|advocacia/);
  });
});
