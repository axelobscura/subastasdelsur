import { ImageResponse } from "next/og";

// Default preview image for links to the site (WhatsApp, Facebook, X…).
export const alt = "Subastas del sur: subastas en línea";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "center", padding: 80, background: "#18181b", color: "#fafafa" }}>
        <div style={{ fontSize: 88, fontWeight: 700, letterSpacing: -2 }}>Subastas del sur</div>
        <div style={{ fontSize: 40, marginTop: 24, color: "#d4d4d8" }}>Subastas en línea. Puja desde cualquier lugar.</div>
      </div>
    ),
    size,
  );
}
