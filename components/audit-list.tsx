import { AUDIT_ACTION_LABELS } from "@/lib/audit";
import type { AuditLogEntry } from "@/lib/db/schema";
import { DEFAULT_AUCTION_TIMEZONE, formatAuctionTimeShort } from "@/lib/time";

const FIELD_LABELS: Record<string, string> = {
  title: "título",
  description: "descripción",
  listed: "listado público",
  timezone: "zona horaria",
  startsAt: "inicio",
  endsAt: "cierre",
  slug: "dirección",
  lotNumber: "lote",
  startingPriceCents: "precio de salida",
  minIncrementCents: "incremento",
  reservePriceCents: "reserva",
};

/** "título: Invierno → Invierno 2026 · inicio: … → …" for update entries; short notes otherwise. */
function describe(entry: AuditLogEntry): string | null {
  if (!entry.details) return null;
  let details: Record<string, unknown>;
  try {
    details = JSON.parse(entry.details);
  } catch {
    return null;
  }
  if (entry.action.endsWith(".update")) {
    return Object.entries(details)
      .map(([field, change]) => {
        const [from, to] = change as [unknown, unknown];
        const show = (v: unknown) => (typeof v === "string" && /^\d{4}-\d\d-\d\dT/.test(v) ? formatAuctionTimeShort(new Date(v), DEFAULT_AUCTION_TIMEZONE) : field.endsWith("Cents") && typeof v === "number" ? `$${(v / 100).toLocaleString("es-MX")}` : v === "" ? "(vacío)" : String(v));
        return field === "description" ? "descripción actualizada" : `${FIELD_LABELS[field] ?? field}: ${show(from)} → ${show(to)}`;
      })
      .join(" · ");
  }
  if (typeof details.note === "string") return `Nota: ${details.note}`;
  if (typeof details.file === "string") return details.file;
  return null;
}

export function AuditList({ entries }: { entries: AuditLogEntry[] }) {
  if (!entries.length) return <p className="text-sm text-zinc-600 dark:text-zinc-400">Todavía no hay actividad registrada.</p>;
  return (
    <ol className="divide-y divide-zinc-200 rounded-lg border border-zinc-200 text-sm dark:divide-zinc-800 dark:border-zinc-800" data-testid="audit-list">
      {entries.map((e) => {
        const note = describe(e);
        return (
          <li key={e.id} className="flex flex-col gap-0.5 px-3 py-2">
            <span>
              <strong>{e.actorName}</strong> · {AUDIT_ACTION_LABELS[e.action] ?? e.action} · {e.entityLabel}
            </span>
            {note ? <span className="text-zinc-600 dark:text-zinc-400">{note}</span> : null}
            <span className="text-xs text-zinc-500">{formatAuctionTimeShort(e.createdAt, DEFAULT_AUCTION_TIMEZONE)}</span>
          </li>
        );
      })}
    </ol>
  );
}
