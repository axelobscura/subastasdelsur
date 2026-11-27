import { getLotState } from "@/lib/bids-db";
import { getCurrentUser } from "@/lib/dal";
import { getDb } from "@/lib/db";

// Live state of a lot for polling (price, bids, minimum next bid, server clock). Never cached.
// Drafts only for the admin, like the pages. Bidders appear only as "Postor N".
export async function GET(_request: Request, ctx: RouteContext<"/api/lotes/[id]/estado">) {
  const { id } = await ctx.params;
  const viewer = await getCurrentUser();
  const state = await getLotState(getDb(), id, viewer?.id ?? null);
  if (!state || (state.status === "draft" && viewer?.role !== "admin")) {
    return Response.json({ error: "not_found" }, { status: 404, headers: { "Cache-Control": "no-store" } });
  }
  return Response.json(state, { headers: { "Cache-Control": "no-store" } });
}
