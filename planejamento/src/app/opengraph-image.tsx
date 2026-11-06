import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

export const alt = "Planejamento do Mês em 5 Minutos · UAU Digital";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const GRAD = "linear-gradient(90deg, #7B2FE0, #C9307A 60%, #F2A04A)";

export default async function OpengraphImage() {
  const [font, logo] = await Promise.all([
    readFile(join(process.cwd(), "src/assets/Bricolage-800.ttf")),
    readFile(join(process.cwd(), "public/logo-uau.png")).catch(() => null),
  ]);
  const logoSrc = logo ? `data:image/png;base64,${logo.toString("base64")}` : null;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#0F0E11",
          backgroundImage: "radial-gradient(circle at 92% 8%, rgba(123,47,224,0.45), rgba(15,14,17,0) 55%)",
          color: "#F4F2F7",
          padding: "64px 80px",
          fontFamily: "Bricolage",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14, color: "#A877F7", fontSize: 24, letterSpacing: 5 }}>
            <div style={{ width: 14, height: 14, borderRadius: 999, backgroundImage: GRAD }} />
            PLANEJAMENTO DO MÊS
          </div>
          {logoSrc ? (
            <img src={logoSrc} height={52} alt="" />
          ) : (
            <div style={{ display: "flex", fontSize: 40, letterSpacing: -1 }}>uaudigital</div>
          )}
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", fontSize: 78, lineHeight: 1.04, letterSpacing: -3, maxWidth: 1040 }}>
          <span>O mês do seu cliente&nbsp;</span>
          <span style={{ backgroundImage: GRAD, backgroundClip: "text", color: "transparent" }}>planejado em 5 minutos.</span>
        </div>
        <div style={{ display: "flex" }}>
          <div style={{ display: "flex", backgroundImage: GRAD, color: "#FFFFFF", borderRadius: 999, padding: "16px 34px", fontSize: 30 }}>
            Planejar o mês do meu cliente
          </div>
        </div>
      </div>
    ),
    { ...size, fonts: [{ name: "Bricolage", data: font, weight: 800, style: "normal" }] },
  );
}
