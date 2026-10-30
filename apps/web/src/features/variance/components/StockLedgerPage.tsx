"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { ErrorState } from "@/components/ui/ErrorState";
import { routes } from "@/lib/routes";
import { kitchenApi } from "@/features/kitchen/api";
import { formatCurrency } from "@/lib/format/currency";
import { formatQuantity } from "@/lib/format/numbers";

export function StockLedgerPage({
  shopId,
  date,
}: {
  shopId: string;
  date?: string;
}) {
  const day = date || new Date().toISOString().slice(0, 10);
  const q = useQuery({
    queryKey: ["stock-ledger", shopId, day],
    queryFn: () => kitchenApi.getDailyStockLedger(shopId, day),
  });

  if (q.isPending) {
    return <p className="text-sm text-ink-muted p-6">Loading daily stock ledger…</p>;
  }
  if (q.isError) {
    return (
      <ErrorState
        title="Could not load stock ledger"
        description={q.error.message}
        onRetry={q.refetch}
      />
    );
  }

  const data = q.data ?? {};
  const rows = (Array.isArray(data.rows) ? data.rows : []) as Array<
    Record<string, unknown>
  >;
  const totals = (data.totals ?? {}) as Record<string, unknown>;
  const closed = Boolean(data.closed);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Daily Stock Ledger"
        description={`Opening · Added · Used · Waste · Expected · Closing for ${day}. Admin/Manager only.`}
      />

      <div className="flex flex-wrap items-center gap-3 text-sm">
        <span
          className={
            closed
              ? "rounded-full bg-emerald-50 px-3 py-1 text-emerald-800"
              : "rounded-full bg-amber-50 px-3 py-1 text-amber-800"
          }
        >
          {closed ? "Count closed" : "No close posted for this day"}
        </span>
        <span className="text-ink-muted">
          {String(totals.counted ?? 0)} / {String(totals.items ?? 0)} items counted
        </span>
        <span
          className={
            Number(totals.net_variance_value ?? 0) < 0
              ? "font-medium text-red-600"
              : "text-ink-muted"
          }
        >
          Net variance {formatCurrency(Number(totals.net_variance_value ?? 0))}
        </span>
        <Link
          href={routes.kitchen(shopId) + "/closing-stock"}
          className="ml-auto text-primary hover:underline"
        >
          Open closing stock count →
        </Link>
      </div>

      <Card className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-ink-muted border-b border-border">
              <th className="p-2">Item</th>
              <th className="p-2 text-right">Opening</th>
              <th className="p-2 text-right">Added</th>
              <th className="p-2 text-right">Used</th>
              <th className="p-2 text-right">Waste</th>
              <th className="p-2 text-right">Expected</th>
              <th className="p-2 text-right">Closing</th>
              <th className="p-2 text-right">Variance</th>
              <th className="p-2 text-right">Value</th>
              <th className="p-2">Reason</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const unit = String(r.unit ?? "pcs");
              const variance = r.variance != null ? Number(r.variance) : null;
              const value = r.variance_value != null ? Number(r.variance_value) : null;
              return (
                <tr key={String(r.item_id)} className="border-t border-border">
                  <td className="p-2 font-medium">{String(r.item_name)}</td>
                  <td className="p-2 text-right">
                    {formatQuantity(Number(r.opening ?? 0), unit)}
                  </td>
                  <td className="p-2 text-right">
                    {formatQuantity(Number(r.added ?? 0), unit)}
                    {Number(r.receipt_count ?? 0) > 0 && (
                      <span className="block text-xs text-ink-muted">
                        {String(r.receipt_count)} purchases
                      </span>
                    )}
                  </td>
                  <td className="p-2 text-right">
                    {formatQuantity(Number(r.used ?? 0), unit)}
                  </td>
                  <td className="p-2 text-right">
                    {formatQuantity(Number(r.waste ?? 0), unit)}
                  </td>
                  <td className="p-2 text-right">
                    {formatQuantity(Number(r.expected_closing ?? 0), unit)}
                  </td>
                  <td className="p-2 text-right">
                    {r.counted_closing != null
                      ? formatQuantity(Number(r.counted_closing), unit)
                      : "—"}
                  </td>
                  <td
                    className={`p-2 text-right ${
                      variance != null && variance < 0 ? "text-red-600" : ""
                    }`}
                  >
                    {variance != null ? formatQuantity(variance, unit) : "—"}
                  </td>
                  <td
                    className={`p-2 text-right ${
                      value != null && value < 0 ? "text-red-600" : ""
                    }`}
                  >
                    {value != null ? formatCurrency(value) : "—"}
                  </td>
                  <td className="p-2 text-ink-muted">
                    {r.reason_code ? String(r.reason_code) : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
