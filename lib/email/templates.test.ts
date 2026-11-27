import { describe, expect, it } from "vitest";
import { adminNewBidderTemplate, bidderRejectedTemplate, verifyEmailTemplate } from "./templates";

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
});
