// apps/web/src/features/menu/components/MenuSkeleton.tsx
export function MenuSkeleton() {
  return (
    <div className="flex flex-col gap-6 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-7 w-32 rounded-md bg-surface-muted" />
          <div className="h-4 w-64 rounded-md bg-surface-muted" />
        </div>
        <div className="h-9 w-36 rounded-md bg-surface-muted" />
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-surface">
        <div className="border-b border-border px-5 py-3">
          <div className="h-4 w-40 rounded bg-surface-muted" />
        </div>
        <div className="divide-y divide-border">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="grid grid-cols-6 gap-4 px-5 py-3"
            >
              <div className="col-span-2 h-4 rounded bg-surface-muted" />
              <div className="h-4 rounded bg-surface-muted" />
              <div className="h-4 rounded bg-surface-muted" />
              <div className="h-4 rounded bg-surface-muted" />
              <div className="h-5 w-16 rounded-full bg-surface-muted" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}