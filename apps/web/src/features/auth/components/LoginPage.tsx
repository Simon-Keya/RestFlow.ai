import Image from "next/image";
import { LoginForm } from "./LoginForm";
import { APP_NAME } from "@/lib/constants/config";

export function LoginPage() {
  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-bg px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <Image src="/logo.svg" alt="" width={40} height={40} />
          <div>
            <h1 className="font-display text-lg font-semibold text-ink">{APP_NAME} Ops Console</h1>
            <p className="mt-1 text-sm text-ink-muted">Sign in to manage inventory, kitchen, and orders.</p>
          </div>
        </div>
        <div className="rounded-lg border border-border bg-surface p-6 shadow-card">
          <LoginForm />
        </div>
        <p className="mt-6 text-center text-xs text-ink-faint">
          Trouble signing in? Ask your shop manager to check your account status.
        </p>
      </div>
    </div>
  );
}
