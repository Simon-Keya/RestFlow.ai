"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { ErrorState } from "@/components/ui/ErrorState";
import { FullPageSpinner } from "@/components/feedback/FullPageSpinner";
import { routes } from "@/lib/routes";
import { useConsumptionAlerts } from "../hooks/use-consumption-alerts";
import { ConsumptionAlertsList } from "./ConsumptionAlertsList";

export function ConsumptionAlertsPage({ shopId }: { shopId: string }) {
  const alerts = useConsumptionAlerts(shopId);

  if (alerts.isPending) return <FullPageSpinner label="Loading alerts…" />;
  if (alerts.isError) {
    return <ErrorState title="Couldn't load alerts" description={alerts.error.message} onRetry={alerts.refetch} />;
  }

  return (
    <div className="flex flex-col gap-6">
      <Link href={routes.consumption(shopId)} className="flex items-center gap-1.5 text-sm text-ink-muted hover:text-ink">
        <ArrowLeft className="h-3.5 w-3.5" /> Back to consumption
      </Link>
      <PageHeader title="Consumption alerts" description="Unusual usage patterns worth a second look." />
      <Card className="p-0">
        <ConsumptionAlertsList alerts={alerts.data} />
      </Card>
    </div>
  );
}
