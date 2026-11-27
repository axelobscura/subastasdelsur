import { describe, expect, it } from "vitest";
import { adminNewBidderTemplate, auctionResultTemplate, bidderRejectedTemplate, outbidTemplate, verifyEmailTemplate } from "./templates";

const bidder = {
  name: "Ana <script>alert(1)</script>",
  email: "ana@example.com",
  phone: "55 1234 5678",
  registeredAt: "viernes, 27 de noviembre de 2026, 10:58 GMT-6",
  reviewUrl: "https://subastasdelsur.io/admin/postores/abc",
};

describe("email templates", () => {
  it("escapes user values in HTML", () => {
    const { html } = adminNewBidderTemplate(bidder);
    expect(html).not.toContain("<script>");
    expect(html).toContain("Ana &lt;script&gt;alert(1)&lt;/script&gt;");
  });

  it("puts each bidder detail on its own line in the plain-text version", () => {
    const { text, subject } = adminNewBidderTemplate(bidder);
    expect(subject).toBe("Nuevo postor por aprobar · Subastas del sur");
    expect(text).toContain("\nCorreo: ana@example.com\nTeléfono: 55 1234 5678\nRegistro: viernes");
    expect(text).toContain("Nombre: Ana <script>alert(1)</script>"); // plain text: shown as typed, not HTML
    expect(text).toContain("Revisar postor: https://subastasdelsur.io/admin/postores/abc");
  });

  it("tells a new bidder that access will be validated", () => {
    const { text } = verifyEmailTemplate({ name: "Ana", url: "https://x/verify" });
    expect(text).toContain("nuestro equipo validará tu acceso");
    expect(text).toContain("Confirmar mi correo: https://x/verify");
  });

  it("includes the rejection note only when there is one", () => {
    expect(bidderRejectedTemplate({ name: "Ana", note: "Faltan datos" }).text).toContain("Motivo: Faltan datos");
    expect(bidderRejectedTemplate({ name: "Ana", note: null }).text).not.toContain("Motivo");
  });

  it("tells winners what they won and escapes lot titles", () => {
    const lot = (n: number, title = "Reloj") => ({ lotNumber: n, title, amount: "$1,500.00", url: `https://x/subastas/a/${n}` });
    const { subject, text, html } = auctionResultTemplate({
      name: "Ana",
      auctionTitle: "Invierno",
      won: [lot(1, "Reloj <b>antiguo</b>")],
      reserveNotMet: [lot(2)],
      notWon: [lot(3)],
      accountUrl: "https://x/mi-cuenta",
    });
    expect(subject).toBe("¡Ganaste en la subasta! · Subastas del sur");
    expect(text).toContain("Lote 1: Reloj <b>antiguo</b> · $1,500.00");
    expect(html).not.toContain("<b>antiguo</b>");
    expect(text).toContain("no se alcanzó el precio de reserva");
    expect(text).toContain("Otros lotes en los que pujaste");
    const lost = auctionResultTemplate({ name: "Beto", auctionTitle: "Invierno", won: [], reserveNotMet: [], notWon: [lot(1)], accountUrl: "https://x" });
    expect(lost.subject).toBe("Resultados de la subasta · Subastas del sur");
    expect(lost.text).toContain("otra persona hizo la puja más alta");
  });

  it("outbid email links back to the lot", () => {
    const { text } = outbidTemplate({ name: "Beto", lot: { lotNumber: 1, title: "Reloj", amount: "$6,000.00", url: "https://x/l/1" }, auctionTitle: "Invierno", endsAt: "20 dic 2030, 21:30 GMT-6" });
    expect(text).toContain("La puja actual es de $6,000.00");
    expect(text).toContain("Volver a pujar: https://x/l/1");
  });
});
