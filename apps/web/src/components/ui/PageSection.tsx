import { cn } from "@/lib/cn";

export interface PageSectionProps {
  title: string;
  description?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

/** Consistent "heading + optional action + content" block used to break up long dashboard pages. */
export function PageSection({ title, description, action, children, className }: PageSectionProps) {
  return (
    <section className={cn("flex flex-col gap-3", className)}>
      <div className="flex items-end justify-between gap-4">
        <div>
          <h2 className="font-display text-base font-semibold text-ink">{title}</h2>
          {description ? <p className="mt-0.5 text-sm text-ink-muted">{description}</p> : null}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}
