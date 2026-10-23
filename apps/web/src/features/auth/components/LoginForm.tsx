"use client";

import { useState, type FormEvent } from "react";
import { Eye, EyeOff, Lock, Mail } from "lucide-react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { loginSchema } from "../schema";
import { useLogin } from "../hooks/use-login";
import { ApiError } from "@/lib/api/errors";

export function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({});
  const login = useLogin();

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const result = loginSchema.safeParse({ email, password });
    if (!result.success) {
      const errors = result.error.flatten().fieldErrors;
      setFieldErrors({ email: errors.email?.[0], password: errors.password?.[0] });
      return;
    }
    setFieldErrors({});
    login.mutate(result.data);
  }

  const serverError = login.error instanceof ApiError ? login.error.message : null;

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
      {serverError ? <Alert tone="danger" title="Couldn't sign you in" description={serverError} /> : null}

      <div>
        <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-ink">
          Email
        </label>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          placeholder="you@restflow.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          invalid={!!fieldErrors.email}
          leadingIcon={<Mail className="h-4 w-4" />}
        />
        {fieldErrors.email ? <p className="mt-1 text-xs text-danger-600">{fieldErrors.email}</p> : null}
      </div>

      <div>
        <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-ink">
          Password
        </label>
        <div className="relative">
          <Input
            id="password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            invalid={!!fieldErrors.password}
            leadingIcon={<Lock className="h-4 w-4" />}
            className="pr-9"
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-faint hover:text-ink"
            aria-label={showPassword ? "Hide password" : "Show password"}
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        {fieldErrors.password ? <p className="mt-1 text-xs text-danger-600">{fieldErrors.password}</p> : null}
      </div>

      <Button type="submit" className="mt-1 w-full" loading={login.isPending}>
        Sign in
      </Button>
    </form>
  );
}
