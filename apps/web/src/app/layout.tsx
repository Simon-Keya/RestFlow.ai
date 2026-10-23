import type { Metadata } from "next";
import { AppProviders } from "@/providers/AppProviders";
import { APP_NAME } from "@/lib/constants/config";
import "./globals.css";

/**
 * Avoid next/font/google at build time.
 * Netlify (and some CI) intermittently fails Google Fonts fetch with:
 *   TypeError: Cannot read properties of null (reading '1')
 * CSS variables keep the same names Tailwind expects (tailwind fontFamily.sans/display/mono).
 */
export const metadata: Metadata = {
  title: `${APP_NAME} — Ops Console`,
  description:
    "Inventory, kitchen, POS, waste, and consumption management for RestFlow shops.",
  robots: { index: false, follow: false },
};

const fontVars = {
  // System stacks — no network dependency during `next build`
  ["--font-inter" as string]:
    'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  ["--font-inter-tight" as string]:
    'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  ["--font-mono" as string]:
    'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
} as React.CSSProperties;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" style={fontVars}>
      <body className="font-sans">
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
