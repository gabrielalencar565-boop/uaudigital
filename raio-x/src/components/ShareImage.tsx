"use client";

import { useState } from "react";
import { AREAS, COPY, type Level } from "@/data/raiox";
import type { AreaScores } from "@/lib/scoring";
import { radarPoint, radarPolygon } from "@/lib/radar";
import { withBase } from "@/lib/base";

const W = 1080;
const H = 1920;

type Props = { overall: number; level: Level; scores: AreaScores; name: string };

/** Pega o nome real da fonte carregada pelo next/font. */
function fontFamily(): string {
  try {
    const f = getComputedStyle(document.body).fontFamily;
    return f || "sans-serif";
  } catch {
    return "sans-serif";
  }
}

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Quebra o texto em linhas que cabem na largura. */
function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = w;
    } else line = test;
  }
  if (line) lines.push(line);
  return lines;
}

export async function generateStoryImage({ overall, level, scores, name }: Props): Promise<Blob> {
  const family = fontFamily();
  try {
    await Promise.all([300, 600, 700, 800].map((w) => document.fonts.load(`${w} 100px ${family}`)));
  } catch {
    // segue com a fonte que tiver
  }

  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas indisponível");

  const font = (weight: number, size: number) => `${weight} ${size}px ${family}`;
  const pad = 96;

  const grad = (x0: number, y0: number, x1: number, y1: number) => {
    const g = ctx.createLinearGradient(x0, y0, x1, y1);
    g.addColorStop(0, "#7B2FE0");
    g.addColorStop(0.6, "#C9307A");
    g.addColorStop(1, "#F2A04A");
    return g;
  };

  // Fundo escuro da landing + brilho roxo
  ctx.fillStyle = "#0F0E11";
  ctx.fillRect(0, 0, W, H);
  const glow = (x: number, y: number, r: number, color: string) => {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, color);
    g.addColorStop(1, "rgba(15,14,17,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  };
  glow(W - 80, 260, 760, "rgba(123,47,224,0.42)");
  glow(80, H - 260, 640, "rgba(201,48,122,0.22)");

  // Logo (ou texto)
  const logo = await loadImage(withBase("/logo-uau.png"));
  if (logo && logo.naturalWidth > 0) {
    const h = 80;
    const w = (logo.naturalWidth / logo.naturalHeight) * h;
    ctx.drawImage(logo, pad, 200, w, h);
  } else {
    ctx.fillStyle = "#F4F2F7";
    ctx.font = font(800, 56);
    ctx.textBaseline = "top";
    ctx.fillText("uaudigital", pad, 210);
  }

  // Eyebrow com bolinha em degradê
  ctx.textBaseline = "middle";
  ctx.font = font(600, 30);
  const badge = "RAIO-X DO SOCIAL MEDIA";
  const spacing = 5;
  ctx.beginPath();
  ctx.arc(pad + 10, 372, 10, 0, Math.PI * 2);
  ctx.fillStyle = grad(pad, 362, pad + 20, 382);
  ctx.fill();
  ctx.fillStyle = "#A877F7";
  let x = pad + 40;
  for (const ch of badge) {
    ctx.fillText(ch, x, 372);
    x += ctx.measureText(ch).width + spacing;
  }

  // "Minha nota"
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = "#F4F2F7";
  ctx.font = font(300, 58);
  ctx.fillText(name ? `${name}, minha nota é` : "Minha nota é", pad, 520);

  // Nota gigante em degradê
  ctx.font = font(800, 360);
  const scoreText = String(overall);
  const scoreW = ctx.measureText(scoreText).width;
  ctx.fillStyle = grad(pad, 600, pad + scoreW, 840);
  ctx.fillText(scoreText, pad - 14, 840);
  ctx.font = font(300, 110);
  ctx.fillStyle = "#8C8796";
  ctx.fillText("/100", pad - 14 + scoreW + 16, 840);

  // Nível (pílula em degradê)
  ctx.font = font(700, 52);
  const levelText = `${level.name} ${level.emoji}`;
  const levelW = Math.min(W - pad * 2, ctx.measureText(levelText).width + 88);
  roundRect(ctx, pad, 900, levelW, 112, 56);
  ctx.fillStyle = grad(pad, 900, pad + levelW, 1012);
  ctx.fill();
  ctx.fillStyle = "#FFFFFF";
  ctx.textBaseline = "middle";
  ctx.fillText(levelText, pad + 44, 958, levelW - 88);

  // Mini radar
  const cx = W / 2;
  const cy = 1310;
  const r = 180;
  const n = AREAS.length;
  ctx.lineWidth = 3;
  ctx.strokeStyle = "#2A2730";
  for (const ring of [25, 50, 75, 100]) {
    const pts = radarPolygon(Array(n).fill(ring), cx, cy, r);
    ctx.beginPath();
    pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
    ctx.closePath();
    ctx.stroke();
  }
  for (let i = 0; i < n; i++) {
    const p = radarPoint(i, n, 100, cx, cy, r);
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
  }
  const shape = radarPolygon(
    AREAS.map((a) => scores[a.id]),
    cx,
    cy,
    r,
  );
  ctx.beginPath();
  shape.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
  ctx.closePath();
  ctx.globalAlpha = 0.5;
  ctx.fillStyle = grad(cx - r, cy - r, cx + r, cy + r);
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.strokeStyle = grad(cx - r, cy - r, cx + r, cy + r);
  ctx.lineWidth = 6;
  ctx.lineJoin = "round";
  ctx.stroke();

  ctx.fillStyle = "#B9B4C4";
  ctx.font = font(600, 34);
  AREAS.forEach((a, i) => {
    const p = radarPoint(i, n, 100, cx, cy, r + 40);
    const cos = Math.cos(p.angle);
    const sin = Math.sin(p.angle);
    ctx.textAlign = Math.abs(cos) < 0.1 ? "center" : cos > 0 ? "left" : "right";
    ctx.textBaseline = sin < -0.9 ? "bottom" : sin > 0.9 ? "top" : "middle";
    ctx.fillText(a.shortName, p.x, p.y);
  });
  ctx.textAlign = "left";

  // Rodapé
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = "#F4F2F7";
  ctx.font = font(600, 42);
  ctx.textAlign = "center";
  const lines = COPY.result.shareFooter.split(" · ").flatMap((part) => wrap(ctx, part, W - pad * 2));
  lines.forEach((line, i) => ctx.fillText(line, W / 2, 1640 + i * 54));
  ctx.textAlign = "left";

  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Falha ao gerar imagem"))), "image/png"),
  );
}

export default function ShareImage(props: Props) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function share() {
    if (busy) return;
    setBusy(true);
    setMsg(null);
    try {
      const blob = await generateStoryImage(props);
      const file = new File([blob], "raio-x-uaudigital.png", { type: "image/png" });
      const nav = navigator as Navigator & { canShare?: (data: ShareData) => boolean };
      if (nav.share && nav.canShare?.({ files: [file] })) {
        try {
          await nav.share({ files: [file], title: "Meu Raio-X do Social Media" });
        } catch (err) {
          if ((err as DOMException)?.name !== "AbortError") throw err;
        }
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = file.name;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 2000);
        setMsg("Imagem baixada. É só postar no seu story e marcar a @uaudigital. 😉");
      }
    } catch {
      setMsg("Não deu pra gerar a imagem agora. Tenta de novo ou tira um print. 📸");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <button type="button" onClick={share} disabled={busy} className="btn-ghost text-fg">
        <span aria-hidden="true">📲</span> {busy ? "Gerando imagem…" : COPY.result.share}
      </button>
      <p aria-live="polite" className="mt-3 min-h-0 text-center text-sm text-dim empty:hidden">
        {msg}
      </p>
    </div>
  );
}
