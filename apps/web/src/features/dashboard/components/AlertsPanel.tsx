"use client";

import Link from "next/link";
import { AlertTriangle, Bell, Info } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatRelativeTime } from "@/lib/format/dates";
import { cn } from "@/lib/cn";
import { useShopId } from "@/hooks/use-shop-id";
import { routes } from "@/lib/routes";
import type { DashboardAlert } from "../types";

const SEVERITY_DOT: Record<DashboardAlert["severity"], string> = {
  info: "bg-ink-faint",
  warning: "bg-warning-500",
  critical: "bg-danger-500",
};

function resolveHref(
  alert: DashboardAlert,
  shopId: string,
): string | undefined {
  const raw = alert.href?.trim();
  if (raw && raw.startsWith(`/shop/`)) return raw;

  if (alert.type === "approval") return routes.approvals(shopId);
  if (alert.type === "variance") return routes.variance(shopId);

  // low_stock | near_expiry
  if (raw?.includes("highlight=")) {
    const q = raw.includes("?") ? raw.slice(raw.indexOf("?")) : "";
    return `${routes.inventory(shopId)}${q}`;
  }
  return routes.inventory(shopId);
}

export function AlertsPanel({ alerts }: { alerts: DashboardAlert[] }) {
  const shopId = useShopId();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Alerts</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {alerts.length === 0 ? (
          <EmptyState
            icon={Bell}
            title="No active alerts"
            description="You'll see low stock, near-expiry, and variance flags here."
          />
        ) : (
          <ul className="divide-y divide-border">
            {alerts.map((alert) => {
              const href = resolveHref(alert, shopId);
              const content = (
                <div className="flex items-start gap-3 px-5 py-3">
                  <span
                    className={cn(
                      "mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full",
                      SEVERITY_DOT[alert.severity],
                    )}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-ink">{alert.message}</p>
                    <p className="mt-0.5 text-xs text-ink-faint">
                      {formatRelativeTime(alert.createdAt)}
                    </p>
                  </div>
                  {alert.severity === "critical" && (
                    <AlertTriangle
                      className="h-4 w-4 shrink-0 text-danger-500"
                      aria-hidden
                    />
                  )}
                  {alert.severity === "info" && (
                    <Info
                      className="h-4 w-4 shrink-0 text-ink-faint"
                      aria-hidden
                    />
                  )}
                </div>
              );
              return (
                <li
                  key={alert.id}
                  className="transition hover:bg-surface-muted/50"
                >
                  {href ? <Link href={href}>{content}</Link> : content}
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
