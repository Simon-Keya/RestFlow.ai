import { readAuthTokenClient } from "@/lib/auth/token";

const ASSISTANT_URL = (process.env.NEXT_PUBLIC_AI_ASSISTANT_URL || "http://localhost:8001").replace(/\/$/, "");

export interface AssistantEvidence {
  item_id: string;
  item_name: string;
  current_stock: number;
  threshold?: number | null;
  severity?: "low" | "critical" | null;
  unit?: string | null;
  source: string;
}

export interface AssistantToolResult {
  tool: string;
  source: string;
  data: unknown;
  truncated: boolean;
  source_count?: number | null;
}

export interface AssistantReply {
  answer: string;
  evidence: AssistantEvidence[];
  tool_results: AssistantToolResult[];
  tool_used: string[];
  suggested_questions: string[];
  limitations: string[];
}

export async function askOperationsAssistant(message: string, shopId: string): Promise<AssistantReply> {
  const token = readAuthTokenClient();
  if (!token) throw new Error("Your session is missing. Please sign in again.");

  let response: Response;
  try {
    response = await fetch(`${ASSISTANT_URL}/v1/assistant/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ message, shop_id: shopId }),
      signal: AbortSignal.timeout(35_000),
    });
  } catch {
    throw new Error("Could not connect to the AI assistant. Check that the assistant service is running and try again.");
  }

  if (!response.ok) {
    let detail = "The assistant could not complete your request.";
    try {
      const body = (await response.json()) as { detail?: string };
      if (body.detail) detail = body.detail;
    } catch {
      // Keep the safe default message for non-JSON errors.
    }
    throw new Error(detail);
  }

  return (await response.json()) as AssistantReply;
}
