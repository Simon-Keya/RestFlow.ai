"use client";

import { useQuery } from "@tanstack/react-query";
import { wasteApi } from "../api";

export function useWasteEvent(eventId: string) {
  return useQuery({
    queryKey: ["waste", "event", eventId],
    queryFn: () => wasteApi.getEvent(eventId),
  });
}
