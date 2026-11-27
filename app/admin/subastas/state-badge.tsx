import type { DisplayState } from "@/lib/auctions/rules";

const STYLES: Record<DisplayState, string> = {
  draft: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
  upcoming: "bg-sky-100 text-sky-900 dark:bg-sky-950 dark:text-sky-200",
  live: "bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200",
  ended: "bg-zinc-200 text-zinc-800 dark:bg-zinc-700 dark:text-zinc-100",
  cancelled: "bg-red-100 text-red-900 dark:bg-red-950 dark:text-red-200",
};

export function StateBadge({ state, label }: { state: DisplayState; label: string }) {
  return <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap ${STYLES[state]}`}>{label}</span>;
}
