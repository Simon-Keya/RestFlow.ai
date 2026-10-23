import type { Metadata } from "next";
import { Suspense } from "react";
import { LoginPage } from "@/features/auth/components/LoginPage";

export const metadata: Metadata = { title: "Sign in" };

export default function Login() {
  return (
    <Suspense>
      <LoginPage />
    </Suspense>
  );
}
