"use client";

import { createContext, useCallback, useContext, useRef, useState } from "react";

export type ToastVariant = "default" | "success" | "warning" | "danger";

export interface Toast {
  id: string;
  title: string;
  description?: string;
  variant: ToastVariant;
}

interface ToastContextValue {
  toasts: Toast[];
  toast: (input: Omit<Toast, "id">) => void;
  dismiss: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const counter = useRef(0);

  const dismiss = useCallback((id: string) => {
    setToasts((current) => current.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback(
    (input: Omit<Toast, "id">) => {
      const id = `toast-${++counter.current}`;
      setToasts((current) => [...current, { id, ...input }]);
      window.setTimeout(() => dismiss(id), 5000);
    },
    [dismiss],
  );

  return <ToastContext.Provider value={{ toasts, toast, dismiss }}>{children}</ToastContext.Provider>;
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast() must be used within <ToastProvider>");
  return ctx;
}
