import Link from "next/link";
import { Compass } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { routes } from "@/lib/routes";

export default function NotFound() {
  return (
    <div className="flex min-h-screen w-full flex-col items-center justify-center gap-4 bg-bg px-6 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-surface-muted">
        <Compass className="h-6 w-6 text-ink-faint" aria-hidden />
      </div>
      <div>
        <h1 className="font-display text-lg font-semibold text-ink">Page not found</h1>
        <p className="mt-1 max-w-sm text-sm text-ink-muted">The page you&apos;re looking for doesn&apos;t exist or may have moved.</p>
      </div>
      <Button asChild>
        <Link href={routes.login()}>Back to sign in</Link>
      </Button>
    </div>
  );
}
