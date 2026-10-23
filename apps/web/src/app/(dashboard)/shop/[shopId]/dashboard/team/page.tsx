import type { Metadata } from "next";
import { TeamPage } from "@/features/team/components/TeamPage";

export const metadata: Metadata = { title: "Team" };

export default async function TeamRoute({
  params,
}: {
  params: Promise<{ shopId: string }>;
}) {
  const { shopId } = await params;
  return <TeamPage shopId={shopId} />;
}
