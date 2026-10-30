import type { Metadata } from "next";
import { StockLedgerPage } from "@/features/variance/components/StockLedgerPage";

export const metadata: Metadata = { title: "Daily Stock Ledger" };

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ shopId: string }>;
  searchParams: Promise<{ date?: string }>;
}) {
  const { shopId } = await params;
  const { date } = await searchParams;
  return <StockLedgerPage shopId={shopId} date={date} />;
}
