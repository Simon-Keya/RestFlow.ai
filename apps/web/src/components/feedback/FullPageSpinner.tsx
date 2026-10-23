import { Spinner } from "@/components/ui/Spinner";

export function FullPageSpinner({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="flex h-full min-h-[50vh] w-full flex-col items-center justify-center gap-3 text-ink-muted">
      <Spinner size="lg" />
      <p className="text-sm">{label}</p>
    </div>
  );
}
