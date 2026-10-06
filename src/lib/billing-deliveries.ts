export type EventRow = { id: string; paddle_event_id: string | null; event_type: string; sync_status: string; detail: string | null; environment: string; created_at: string };

// Paddle re-sends the same event id on retry; group attempts so the newest one is the final result.
export function groupDeliveries(rows: EventRow[]) {
  const groups = new Map<string, EventRow[]>();
  for (const r of rows) {
    const k = r.paddle_event_id ?? r.id;
    groups.set(k, [...(groups.get(k) ?? []), r]);
  }
  return [...groups.values()].map((attempts) => {
    const sorted = [...attempts].sort((a, b) => a.created_at.localeCompare(b.created_at));
    return { key: sorted[0]!.paddle_event_id ?? sorted[0]!.id, attempts: sorted, final: sorted[sorted.length - 1]! };
  }).sort((a, b) => b.final.created_at.localeCompare(a.final.created_at));
}
