import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

export const alt = "Raio-X do Social Media · UAU Digital";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OpengraphImage() {
  const font = await readFile(join(process.cwd(), "src/assets/BricolageGrotesque-ExtraBold.ttf"));
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#7A35D6",
          color: "#FFFFFF",
          padding: "72px 80px",
          fontFamily: "Bricolage",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", border: "3px solid rgba(255,255,255,0.6)", borderRadius: 999, padding: "10px 26px", fontSize: 26, letterSpacing: 4 }}>
            RAIO-X DO SOCIAL MEDIA
          </div>
          <div style={{ display: "flex", fontSize: 40, letterSpacing: -1 }}>uaudigital</div>
        </div>
        <div style={{ display: "flex", fontSize: 76, lineHeight: 1.02, letterSpacing: -2, maxWidth: 1000 }}>
          Seu cliente te vê como estrategista ou como quem só posta?
        </div>
        <div style={{ display: "flex" }}>
          <div style={{ display: "flex", background: "#FFD23F", color: "#08080A", borderRadius: 999, padding: "16px 34px", fontSize: 32 }}>
            Faça seu raio-x grátis →
          </div>
        </div>
      </div>
    ),
    { ...size, fonts: [{ name: "Bricolage", data: font, weight: 800, style: "normal" }] },
  );
}
