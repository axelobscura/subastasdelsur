"use server";

import { after } from "next/server";
import { BID_ERROR_MESSAGES, type BidError } from "@/lib/bids";
import { type LotState, getLotState, placeBidCore } from "@/lib/bids-db";
import { checkApprovedBidder } from "@/lib/dal";
import { getDb } from "@/lib/db";
import { formatMoney, parseMoneyToCents } from "@/lib/money";
import { hit } from "@/lib/rate-limit";
import { notifyOutbid } from "@/lib/settlement-db";

export type BidResult = { ok: boolean; error?: BidError; message: string; state: LotState | null };

/**
 * Place a bid. Re-checks everything on the server: an approved bidder, a sane amount, a per-user
 * rate limit, then the locked transaction in placeBidCore (live window by the DB clock, minimum,
 * not already leading). Always returns the fresh lot state so the page updates at once.
 */
export async function placeBid(productId: string, amountInput: string): Promise<BidResult> {
  const viewer = await checkApprovedBidder();
  const state = async (userId: string | null) => getLotState(getDb(), productId, userId);
  if (!viewer.ok) return { ok: false, error: viewer.reason, message: BID_ERROR_MESSAGES[viewer.reason], state: await state(null) };
  const { user } = viewer;

  if (!hit(`bid:${user.id}`, 20, 60_000)) return { ok: false, error: "rate_limited", message: BID_ERROR_MESSAGES.rate_limited, state: await state(user.id) };

  const amountCents = parseMoneyToCents(amountInput);
  if (amountCents === null) return { ok: false, error: "invalid_amount", message: BID_ERROR_MESSAGES.invalid_amount, state: await state(user.id) };

  const result = await placeBidCore(getDb(), { productId, userId: user.id, amountCents });
  const fresh = await state(user.id);
  if (!result.ok) return { ok: false, error: result.error, message: BID_ERROR_MESSAGES[result.error], state: fresh };

  // Tell whoever was leading, after the response (throttled to one email per lot every 10 min).
  const previousLeaderId = result.previousLeaderId;
  if (previousLeaderId && previousLeaderId !== user.id) {
    after(() =>
      notifyOutbid(getDb(), { productId, previousLeaderId }).catch((error: unknown) => {
        console.error(`[bids] outbid email failed product=${productId}: ${error instanceof Error ? error.message : error}`);
      }),
    );
  }
  return { ok: true, message: `¡Listo! Tu puja de ${formatMoney(result.amountCents)} es la más alta.`, state: fresh };
}
