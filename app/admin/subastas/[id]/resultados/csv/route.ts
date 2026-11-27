import { getAuctionResults } from "@/lib/admin/results";
import { getCurrentUser } from "@/lib/dal";
import { LOT_OUTCOME_LABELS } from "@/lib/settlement";

// Results as CSV (UTF-8 with BOM, so Excel shows accents). Admin only: checked here, not just in proxy.ts.
export async function GET(_request: Request, ctx: RouteContext<"/admin/subastas/[id]/resultados/csv">) {
  const viewer = await getCurrentUser();
  if (viewer?.role !== "admin") return new Response("Not found", { status: 404 });
  const { id } = await ctx.params;
  const results = await getAuctionResults(id);
  if (!results) return new Response("Not found", { status: 404 });

  const cell = (value: string | number | null | undefined) => {
    const text = value == null ? "" : String(value);
    // Quote everything; neutralise spreadsheet formulas from user-typed text.
    return `"${(/^[=+\-@]/.test(text) ? `'${text}` : text).replaceAll('"', '""')}"`;
  };
  const rows = [
    ["Lote", "Producto", "Resultado", "Precio final", "Pujas", "Ganador o puja más alta", "Correo", "Teléfono"],
    ...results.lots.map((lot) => [
      lot.lotNumber,
      lot.title,
      LOT_OUTCOME_LABELS[lot.outcome],
      lot.currentPriceCents === null ? "" : (lot.currentPriceCents / 100).toFixed(2),
      lot.bidCount,
      lot.leader?.name,
      lot.leader?.email,
      lot.leader?.phone,
    ]),
  ];
  const csv = "﻿" + rows.map((r) => r.map(cell).join(",")).join("\r\n") + "\r\n";
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="resultados-${results.auction.slug}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
