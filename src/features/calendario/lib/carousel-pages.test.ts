import { describe, expect, it } from "vitest";
import { buildCarouselPages } from "./carousel-pages";

const vid = (id: string, name: string) => ({ id, url: `v/${name}`, type: "video/mp4", name });
const img = (id: string, name: string) => ({ id, url: `i/${name}`, type: "image/jpeg", name });

describe("buildCarouselPages", () => {
  it("liga cada miniatura ao vídeo de mesmo nome e mantém a ordem das miniaturas", () => {
    const pages = buildCarouselPages([
      vid("v1", "CAPA.mp4"), vid("v2", "PAG 2.mp4"), vid("v3", "PAG 3.mp4"),
      img("p1", "CAPA-poster.jpg"), img("p3", "PAG 3-poster.jpg"), img("p2", "PAG 2-poster.jpg"),
    ]);
    expect(pages.map((p) => p.videoUrl)).toEqual(["v/CAPA.mp4", "v/PAG 3.mp4", "v/PAG 2.mp4"]);
    expect(pages.map((p) => p.ids)).toEqual([["p1", "v1"], ["p3", "v3"], ["p2", "v2"]]);
  });

  it("foto comum continua foto e vídeo sem miniatura entra como página de vídeo", () => {
    const pages = buildCarouselPages([img("a", "foto.jpg"), vid("v", "solto.mp4")]);
    expect(pages).toHaveLength(2);
    expect(pages[0].videoUrl).toBeNull();
    expect(pages[1].videoUrl).toBe("v/solto.mp4");
    expect(pages[1].url).toBe("");
  });

  it("miniatura sem vídeo correspondente fica como foto", () => {
    const pages = buildCarouselPages([img("p", "X-poster.jpg")]);
    expect(pages).toHaveLength(1);
    expect(pages[0].videoUrl).toBeNull();
  });
});
