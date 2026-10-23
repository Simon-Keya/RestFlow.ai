"use client";

import { useRef, useState, type FormEvent } from "react";
import {
  AlertTriangle,
  ArrowUpRight,
  Bot,
  CheckCircle2,
  CircleHelp,
  Loader2,
  MessageSquareText,
  PackageSearch,
  Send,
  ShieldCheck,
  Sparkles,
  UserRound,
} from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { askOperationsAssistant, type AssistantReply } from "../api";

type ChatMessage = {
  id: string;
  role: "assistant" | "user";
  content: string;
  reply?: AssistantReply;
};

const EXAMPLE_QUESTIONS = [
  { icon: PackageSearch, text: "Which inventory items are running low?" },
  { icon: AlertTriangle, text: "Which stock batches are expired or expiring soon?" },
  { icon: CircleHelp, text: "Summarize waste recorded in the last 30 days." },
];

function formatQuantity(value: number): string {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 3 }).format(value);
}

export function OperationsAssistantPage({ shopId }: { shopId: string }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  async function submitMessage(rawMessage: string) {
    const message = rawMessage.trim();
    if (!message || pending) return;

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: message,
    };
    setMessages((current) => [...current, userMessage]);
    setDraft("");
    setError(null);
    setPending(true);

    try {
      const reply = await askOperationsAssistant(message, shopId);
      setMessages((current) => [
        ...current,
        { id: `assistant-${Date.now()}`, role: "assistant", content: reply.answer, reply },
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setPending(false);
      inputRef.current?.focus();
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void submitMessage(draft);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="AI Operations Assistant"
        description="Ask questions about your restaurant operations and get evidence-based guidance from RestFlow."
        actions={
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1.5 text-xs font-medium text-ink-muted">
            <ShieldCheck className="h-3.5 w-3.5 text-success-600" aria-hidden /> Read-only access
          </span>
        }
      />

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_270px]">
        <Card className="flex min-h-[620px] flex-col overflow-hidden">
          <div className="flex items-center gap-3 border-b border-border px-5 py-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-50 text-primary-700">
              <Sparkles className="h-5 w-5" aria-hidden />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-sm font-semibold text-ink">RestFlow Assistant</h2>
              <p className="mt-0.5 text-xs text-ink-muted">Connected to authorized operational data when a tool is used</p>
            </div>
            <span className="hidden items-center gap-1.5 text-xs text-ink-muted sm:flex">
              <span className="h-2 w-2 rounded-full bg-success-500" /> Read-only
            </span>
          </div>

          <div className="flex-1 space-y-5 p-4 sm:p-6" aria-live="polite" aria-relevant="additions text">
            {messages.length === 0 ? (
              <div className="mx-auto flex max-w-xl flex-col items-center py-10 text-center sm:py-14">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-50 text-primary-700">
                  <MessageSquareText className="h-7 w-7" aria-hidden />
                </div>
                <h3 className="mt-5 text-lg font-semibold text-ink">What would you like to understand?</h3>
                <p className="mt-2 max-w-md text-sm leading-6 text-ink-muted">
                  Start with inventory alerts. The assistant will use RestFlow&apos;s existing stock rules and explain what the available records show.
                </p>
                <div className="mt-6 grid w-full gap-2 text-left">
                  {EXAMPLE_QUESTIONS.map(({ icon: Icon, text }) => (
                    <button
                      key={text}
                      type="button"
                      onClick={() => void submitMessage(text)}
                      disabled={pending}
                      className="group flex items-center gap-3 rounded-lg border border-border bg-surface px-4 py-3 text-sm text-ink transition hover:border-primary-300 hover:bg-primary-50/50 disabled:opacity-50"
                    >
                      <Icon className="h-4 w-4 shrink-0 text-primary-600" aria-hidden />
                      <span className="flex-1">{text}</span>
                      <ArrowUpRight className="h-4 w-4 text-ink-faint transition group-hover:text-primary-600" aria-hidden />
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              messages.map((message) => (
                <div key={message.id} className={`flex gap-3 ${message.role === "user" ? "justify-end" : "justify-start"}`}>
                  {message.role === "assistant" && (
                    <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary-50 text-primary-700">
                      <Bot className="h-4 w-4" aria-hidden />
                    </div>
                  )}
                  <div className={`min-w-0 max-w-[min(100%,680px)] space-y-3 ${message.role === "user" ? "order-first" : "flex-1"}`}>
                    <div className={`rounded-xl px-4 py-3 text-sm leading-6 ${message.role === "user" ? "bg-primary-600 text-white" : "bg-surface-muted text-ink"}`}>
                      <p className="whitespace-pre-wrap break-words">{message.content}</p>
                    </div>
                    {message.reply?.evidence && message.reply.evidence.length > 0 && (
                      <div className="rounded-xl border border-border bg-surface p-4">
                        <div className="mb-3 flex items-center justify-between gap-3">
                          <h4 className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Supporting inventory alerts</h4>
                          <span className="text-xs text-ink-faint">{message.reply.tool_results?.find((result) => result.tool === "get_low_stock_items")?.source_count ?? message.reply.evidence.length} records</span>
                        </div>
                        <div className="space-y-2">
                          {message.reply.evidence.map((item) => (
                            <div key={`${item.item_id}-${item.source}`} className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-border/70 py-2 first:border-0 first:pt-0">
                              <div className="min-w-[130px] flex-1">
                                <p className="text-sm font-medium text-ink">{item.item_name}</p>
                                <p className="text-xs text-ink-faint">ID: {item.item_id}</p>
                              </div>
                              <div className="text-right">
                                <p className="text-sm font-semibold tabular-nums text-ink">{formatQuantity(item.current_stock)}{item.unit ? ` ${item.unit}` : ""}</p>
                                <p className="text-xs text-ink-muted">Current stock</p>
                              </div>
                              {item.threshold != null && (
                                <div className="text-right">
                                  <p className="text-sm tabular-nums text-ink">{formatQuantity(item.threshold)}</p>
                                  <p className="text-xs text-ink-muted">Alert threshold</p>
                                </div>
                              )}
                              <span className={`rounded-full px-2 py-1 text-xs font-medium ${item.severity === "critical" ? "bg-danger-50 text-danger-700" : "bg-warning-50 text-warning-700"}`}>
                                {item.severity === "critical" ? "Critical" : "Low stock"}
                              </span>
                            </div>
                          ))}
                        </div>
                        <p className="mt-3 text-[11px] text-ink-faint">Source: existing RestFlow inventory alerts. No stock values were recalculated by the AI.</p>
                        {message.reply.tool_results?.find((result) => result.tool === "get_low_stock_items")?.truncated && <p className="mt-1 text-[11px] text-warning-700">The source returned more records than can be safely shown in one response; the displayed list is bounded.</p>}
                      </div>
                    )}
                    {message.reply?.tool_results && message.reply.tool_results.length > 0 && (
                      <div className="space-y-2">
                        {message.reply.tool_results.filter((result) => result.tool !== "get_low_stock_items").map((result, index) => (
                          <details key={`${result.tool}-${index}`} className="rounded-xl border border-border bg-surface p-3">
                            <summary className="cursor-pointer text-xs font-semibold text-ink">Supporting data · {result.tool.replaceAll("_", " ")}</summary>
                            <p className="mt-2 text-[11px] text-ink-faint">Source: {result.source}</p>
                            {result.truncated && <p className="mt-1 text-[11px] text-warning-700">This result was shortened to keep the assistant response bounded.</p>}
                            <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-surface-muted p-3 text-[11px] leading-5 text-ink-muted">{JSON.stringify(result.data, null, 2)}</pre>
                          </details>
                        ))}
                      </div>
                    )}
                    {message.reply?.limitations.map((limitation) => (
                      <p key={limitation} className="flex items-start gap-2 text-xs leading-5 text-ink-muted">
                        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />{limitation}
                      </p>
                    ))}
                    {message.reply?.suggested_questions && message.reply.suggested_questions.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {message.reply.suggested_questions.map((question) => (
                          <button key={question} type="button" onClick={() => void submitMessage(question)} disabled={pending} className="rounded-full border border-border px-3 py-1.5 text-xs text-ink-muted transition hover:border-primary-300 hover:text-primary-700 disabled:opacity-50">
                            {question}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  {message.role === "user" && (
                    <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-surface-muted text-ink-muted">
                      <UserRound className="h-4 w-4" aria-hidden />
                    </div>
                  )}
                </div>
              ))
            )}
            {pending && (
              <div className="flex items-start gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-50 text-primary-700"><Bot className="h-4 w-4" aria-hidden /></div>
                <div className="flex items-center gap-2 rounded-xl bg-surface-muted px-4 py-3 text-sm text-ink-muted"><Loader2 className="h-4 w-4 animate-spin" aria-hidden />Checking the available information…</div>
              </div>
            )}
          </div>

          <div className="border-t border-border p-4 sm:p-5">
            {error && (
              <div role="alert" className="mb-3 flex items-start gap-2 rounded-lg border border-danger-200 bg-danger-50 px-3 py-2.5 text-sm text-danger-700">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                <div className="flex-1">{error}</div>
                <button type="button" onClick={() => setError(null)} className="text-xs font-medium underline">Dismiss</button>
              </div>
            )}
            <form onSubmit={handleSubmit} className="flex items-end gap-2">
              <label className="sr-only" htmlFor="operations-assistant-message">Ask the RestFlow assistant</label>
              <textarea
                id="operations-assistant-message"
                ref={inputRef}
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    void submitMessage(draft);
                  }
                }}
                rows={2}
                maxLength={2000}
                placeholder="Ask about your restaurant operations…"
                disabled={pending}
                className="max-h-36 min-h-[48px] flex-1 resize-y rounded-lg border border-border bg-surface px-3 py-3 text-sm text-ink outline-none placeholder:text-ink-faint focus:border-primary-400 focus:ring-2 focus:ring-primary-100 disabled:opacity-60"
              />
              <Button type="submit" size="lg" disabled={pending || !draft.trim()} aria-label="Send message" className="h-12 w-12 px-0">
                {pending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Send className="h-4 w-4" aria-hidden />}
              </Button>
            </form>
            <p className="mt-2 text-[11px] text-ink-faint">AI responses can be incomplete. Verify important decisions against the original RestFlow records. Enter to send · Shift+Enter for a new line.</p>
          </div>
        </Card>

        <aside className="space-y-4">
          <Card className="p-4">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-success-600" aria-hidden />
              <h3 className="text-sm font-semibold text-ink">Available capabilities</h3>
            </div>
            <ul className="mt-3 space-y-2 text-sm text-ink-muted">
              <li className="flex gap-2"><span className="text-success-600">✓</span>Low-stock and expiry alerts</li>
              <li className="flex gap-2"><span className="text-success-600">✓</span>Inventory summary and stock movements</li>
              <li className="flex gap-2"><span className="text-success-600">✓</span>Waste analytics (manager/admin)</li>
              <li className="flex gap-2"><span className="text-success-600">✓</span>Dashboard KPIs (manager/admin)</li>
              <li className="flex gap-2"><span className="text-success-600">✓</span>Trace search and production trace (role-scoped)</li>
            </ul>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-primary-600" aria-hidden />
              <h3 className="text-sm font-semibold text-ink">Designed with guardrails</h3>
            </div>
            <p className="mt-2 text-sm leading-6 text-ink-muted">RestFlow authenticates requests and applies its existing role and shop permissions. The assistant cannot change inventory or create transactions.</p>
          </Card>
          <Card className="p-4">
            <h3 className="text-sm font-semibold text-ink">Safety boundary</h3>
            <p className="mt-2 text-sm leading-6 text-ink-muted">The assistant only reads existing NestJS endpoints. Production history is not offered because the current endpoint returns an empty stub. Costing explanations and approved operational actions remain disabled until their source contracts and approval safeguards are verified.</p>
          </Card>
        </aside>
      </div>
    </div>
  );
}
