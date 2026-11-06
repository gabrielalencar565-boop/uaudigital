/** Geometria do radar (compartilhada entre o SVG e a imagem do story). */
export function radarPoint(i: number, total: number, value: number, cx: number, cy: number, r: number) {
  const angle = -Math.PI / 2 + (i * 2 * Math.PI) / total; // começa no topo
  const d = (Math.max(0, Math.min(100, value)) / 100) * r;
  return { x: cx + d * Math.cos(angle), y: cy + d * Math.sin(angle), angle };
}

export function radarPolygon(values: number[], cx: number, cy: number, r: number) {
  return values.map((v, i) => radarPoint(i, values.length, v, cx, cy, r));
}
