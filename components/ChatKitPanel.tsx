/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ColorScheme } from "@/hooks/useColorScheme";
import {
  STARTER_PROMPTS,
  PLACEHOLDER_INPUT,
  GREETING,
  CREATE_SESSION_ENDPOINT,
  WORKFLOW_ID,
  getThemeConfig,
} from "@/lib/config";
import { useChatKit } from "@openai/chatkit-react";
import { ErrorOverlay } from "./ErrorOverlay";

/** ─────────────────────────────────────────────────────────────
 * Types
 * ──────────────────────────────────────────────────────────── */
export type FactAction = {
  type: "save";
  factId: string;
  factText: string;
};

type ChatKitPanelProps = {
  theme: ColorScheme;
  onWidgetAction: (action: FactAction) => Promise<void>;
  onResponseEnd: () => void;
  onThemeRequest: (scheme: ColorScheme) => void;
};

type ErrorState = {
  script: string | null;
  session: string | null;
  integration: string | null;
  retryable: boolean;
};

/** Minimal message shape we render */
type UiMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
};

/** ─────────────────────────────────────────────────────────────
 * Helpers
 * ──────────────────────────────────────────────────────────── */
const isBrowser = typeof window !== "undefined";
const isDev = process.env.NODE_ENV !== "production";

const createInitialErrors = (): ErrorState => ({
  script: null,
  session: null,
  integration: null,
  retryable: false,
});

type ErrorPayload = {
  error?: string | { message?: string };
  message?: string;
  details?: unknown;
};
function extractErrorDetail(payload: ErrorPayload | undefined, fallback: string): string {
  if (!payload) return fallback;
  if (typeof payload.error === "string") return payload.error;
  if (
    payload.error &&
    typeof payload.error === "object" &&
    "message" in payload.error &&
    typeof payload.error.message === "string"
  ) {
    return payload.error.message;
  }
  if (typeof payload.message === "string") return payload.message;
  return fallback;
}

/** ─────────────────────────────────────────────────────────────
 * Custom Chat UI (user right, assistant left)
 *  - Hebrew content in BOTH bubbles is rtl + right-aligned
 *  - English renders ltr naturally
 * ──────────────────────────────────────────────────────────── */
function ChatUI({
  messages,
  sending,
  onSend,
}: {
  messages: UiMessage[];
  sending: boolean;
  onSend: (text: string) => Promise<void>;
}) {
  const [input, setInput] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sending]);

  async function handleSend(e?: React.FormEvent) {
    e?.preventDefault();
    const text = input.trim();
    if (!text || sending) return;
    setInput("");
    await onSend(text);
  }

  return (
    <div className="mf-chat-wrap">
      <div className="mf-thread">
        {messages.map((m) => {
          const isUser = m.role === "user";
          // Heuristic: if the text contains Hebrew/Arabic chars, force rtl + right-align
          const isRTL = /[\u0590-\u05FF\u0600-\u06FF]/.test(m.text);
          return (
            <div
              key={m.id}
              className={`mf-bubble ${isUser ? "mf-user" : "mf-assistant"}`}
            >
              <div
                className="mf-text"
                style={
                  isRTL
                    ? { direction: "rtl", textAlign: "right", unicodeBidi: "plaintext" as const }
                    : undefined
                }
              >
                {m.text}
              </div>
            </div>
          );
        })}
        {sending && (
          <div className="mf-bubble mf-assistant">
            <div className="mf-text">…</div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      <form className="mf-composer" onSubmit={handleSend}>
        <input
          className="mf-input"
          placeholder="אני כאן לכל שאלה…"
          dir="auto"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => (e.key === "Enter" ? handleSend(e) : null)}
        />
        <button className="mf-send" disabled={sending || !input.trim()} type="submit">
          שלח
        </button>
      </form>
    </div>
  );
}

/** ─────────────────────────────────────────────────────────────
 * Main component
 * ──────────────────────────────────────────────────────────── */
export function ChatKitPanel({
  theme,
  onWidgetAction,
  onResponseEnd,
  onThemeRequest,
}: ChatKitPanelProps) {
  const processedFacts = useRef(new Set<string>());
  const [errors, setErrors] = useState<ErrorState>(() => createInitialErrors());
  const [isInitializingSession, setIsInitializingSession] = useState(true);
  const isMountedRef = useRef(true);
  const [scriptStatus, setScriptStatus] = useState<"pending" | "ready" | "error">(
    () => (isBrowser && (window as any).customElements?.get("openai-chatkit") ? "ready" : "pending")
  );
  const [widgetInstanceKey, setWidgetInstanceKey] = useState(0);

  const setErrorState = useCallback((updates: Partial<ErrorState>) => {
    setErrors((current) => ({ ...current, ...updates }));
  }, []);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Keep your existing script status plumbing (harmless with custom UI)
  useEffect(() => {
    if (!isBrowser) return;

    let timeoutId: number | undefined;

    const handleLoaded = () => {
      if (!isMountedRef.current) return;
      setScriptStatus("ready");
      setErrorState({ script: null });
    };

    const handleError = (event: Event) => {
      if (!isMountedRef.current) return;
      setScriptStatus("error");
      const detail = (event as CustomEvent<unknown>)?.detail ?? "unknown error";
      setErrorState({ script: `Error: ${detail}`, retryable: false });
      setIsInitializingSession(false);
    };

    window.addEventListener("chatkit-script-loaded", handleLoaded);
    window.addEventListener("chatkit-script-error", handleError as EventListener);

    if ((window as any).customElements?.get("openai-chatkit")) {
      handleLoaded();
    } else if (scriptStatus === "pending") {
      timeoutId = window.setTimeout(() => {
        if (!(window as any).customElements?.get("openai-chatkit")) {
          handleError(new CustomEvent("chatkit-script-error", { detail: "Web component unavailable" }));
        }
      }, 5000);
    }

    return () => {
      window.removeEventListener("chatkit-script-loaded", handleLoaded);
      window.removeEventListener("chatkit-script-error", handleError as EventListener);
      if (timeoutId) window.clearTimeout(timeoutId);
    };
  }, [scriptStatus, setErrorState]);

  const isWorkflowConfigured = Boolean(
    WORKFLOW_ID && !WORKFLOW_ID.startsWith("wf_replace")
  );

  useEffect(() => {
    if (!isWorkflowConfigured && isMountedRef.current) {
      setErrorState({
        session: "Set NEXT_PUBLIC_CHATKIT_WORKFLOW_ID in your .env.local file.",
        retryable: false,
      });
      setIsInitializingSession(false);
    }
  }, [isWorkflowConfigured, setErrorState]);

  const handleResetChat = useCallback(() => {
    processedFacts.current.clear();
    if (isBrowser) {
      setScriptStatus((window as any).customElements?.get("openai-chatkit") ? "ready" : "pending");
    }
    setIsInitializingSession(true);
    setErrors(createInitialErrors());
    setWidgetInstanceKey((prev) => prev + 1);
  }, []);

  const getClientSecret = useCallback(
    async (currentSecret: string | null) => {
      if (isDev) {
        console.info("[ChatKitPanel] getClientSecret invoked", {
          currentSecretPresent: Boolean(currentSecret),
          workflowId: WORKFLOW_ID,
          endpoint: CREATE_SESSION_ENDPOINT,
        });
      }

      if (!isWorkflowConfigured) {
        const detail = "Set NEXT_PUBLIC_CHATKIT_WORKFLOW_ID in your .env.local file.";
        if (isMountedRef.current) {
          setErrorState({ session: detail, retryable: false });
          setIsInitializingSession(false);
        }
        throw new Error(detail);
      }

      try {
        const response = await fetch(CREATE_SESSION_ENDPOINT, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            workflow: { id: WORKFLOW_ID },
            chatkit_configuration: { file_upload: { enabled: true } },
          }),
        });

        const raw = await response.text();
        const data = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};

        if (!response.ok) {
          const detail = extractErrorDetail(data as ErrorPayload, response.statusText);
          throw new Error(detail);
        }

        return (data as any)?.client_secret as string;
      } finally {
        if (isMountedRef.current && !currentSecret) setIsInitializingSession(false);
      }
    },
    [isWorkflowConfigured, setErrorState]
  );

  /** Keep using ChatKit logic, just render our own UI */
  const chatkit = useChatKit({
    api: { getClientSecret },
    theme: {
      colorScheme: theme,
      ...getThemeConfig(theme),
    },
    startScreen: { greeting: GREETING, prompts: STARTER_PROMPTS },
    composer: {
      placeholder: PLACEHOLDER_INPUT,
      attachments: { enabled: true },
    },
    threadItemActions: { feedback: false },
    onClientTool: async (invocation: { name: string; params: Record<string, unknown> }) => {
      if (invocation.name === "switch_theme") {
        const requested = invocation.params.theme;
        if (requested === "light" || requested === "dark") {
          onThemeRequest(requested as ColorScheme);
          return { success: true };
        }
        return { success: false };
      }
      if (invocation.name === "record_fact") {
        const id = String(invocation.params.fact_id ?? "");
        const text = String(invocation.params.fact_text ?? "");
        if (!id || processedFacts.current.has(id)) return { success: true };
        processedFacts.current.add(id);
        await onWidgetAction({ type: "save", factId: id, factText: text.replace(/\s+/g, " ").trim() });
        return { success: true };
      }
      return { success: false };
    },
    onResponseEnd: () => onResponseEnd(),
    onResponseStart: () => setErrorState({ integration: null, retryable: false }),
    onThreadChange: () => processedFacts.current.clear(),
    onError: ({ error }: { error: unknown }) => console.error("ChatKit error", error),
  });

  /** Convert ChatKit messages → simple UiMessage[]  */
  const uiMessages: UiMessage[] = useMemo(() => {
    // We defensively read from possible shapes
    const raw: any[] =
      (chatkit as any)?.messages ||
      (chatkit as any)?.thread?.messages ||
      (chatkit as any)?.thread?.items ||
      [];

    return raw
      .map((m) => {
        const role: string = m.role ?? m.author ?? "";
        const text: string =
          typeof m.content === "string"
            ? m.content
            : m.content?.text ??
              m.content?.[0]?.text ??
              m.delta ??
              m.message ??
              "";
        const id = String(m.id ?? crypto.randomUUID());
        if (role !== "user" && role !== "assistant") return null;
        return { id, role, text } as UiMessage;
      })
      .filter(Boolean) as UiMessage[];
  }, [/* rerender when chatkit changes: */ (chatkit as any)?.messages, (chatkit as any)?.thread]);

  const sending = Boolean((chatkit as any)?.isStreaming || (chatkit as any)?.isSending);

  const handleSend = useCallback(
    async (text: string) => {
      // ChatKit send (defensive, across versions)
      const api: any = chatkit;
      if (api?.sendMessage) {
        await api.sendMessage({ content: text });
      } else if (api?.control?.sendMessage) {
        await api.control.sendMessage({ content: text });
      } else if (api?.control?.composer?.send) {
        await api.control.composer.send(text);
      } else {
        console.warn("[ChatKitPanel] No sendMessage available on hook; check library version.");
      }
    },
    [chatkit]
  );

  const activeError = errors.session ?? errors.integration;
  const blockingError = errors.script ?? activeError;

  return (
    <div className="relative pb-8 flex h-[90vh] w-full rounded-2xl flex-col overflow-hidden bg-white shadow-sm transition-colors dark:bg-slate-900">
      {/* Custom UI replaces <ChatKit /> */}
      {!blockingError && !isInitializingSession ? (
        <ChatUI messages={uiMessages} sending={sending} onSend={handleSend} />
      ) : (
        <div className="flex-1" />
      )}

      <ErrorOverlay
        error={blockingError}
        fallbackMessage={
          blockingError || !isInitializingSession ? null : "Loading assistant session..."
        }
        onRetry={blockingError && errors.retryable ? handleResetChat : null}
        retryLabel="Restart chat"
      />
    </div>
  );
}
