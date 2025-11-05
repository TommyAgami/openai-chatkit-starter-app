"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useChatKit } from "@openai/chatkit-react";
import {
  STARTER_PROMPTS,
  PLACEHOLDER_INPUT,
  GREETING,
  CREATE_SESSION_ENDPOINT,
  WORKFLOW_ID,
  getThemeConfig,
} from "@/lib/config";
import type { ColorScheme } from "@/hooks/useColorScheme";

/** Detect Hebrew/Arabic so we can right-align only when needed */
function detectDirection(text: string): "rtl" | "ltr" {
  return /[\u0590-\u05FF\u0600-\u06FF]/.test(text) ? "rtl" : "ltr";
}

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

export function ChatKitPanel({
  theme,
  onWidgetAction,
  onResponseEnd,
  onThemeRequest,
}: ChatKitPanelProps) {
  const processedFacts = useRef(new Set<string>());
  const isMountedRef = useRef(true);
  const [isInitializingSession, setIsInitializingSession] = useState(true);

  /** Create a client secret (keep your backend as-is) */
  const getClientSecret = useCallback(async () => {
    const res = await fetch(CREATE_SESSION_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        workflow: { id: WORKFLOW_ID },
        chatkit_configuration: { file_upload: { enabled: true } },
      }),
    });

    const raw = await res.text();
    const data = raw ? JSON.parse(raw) : {};
    if (!res.ok || !data?.client_secret) {
      throw new Error("Failed to initialize chat session.");
    }
    return data.client_secret as string;
  }, []);

  /** Keep using ChatKit logic; we’ll render our own UI */
  const chatkit: any = useChatKit({
    api: { getClientSecret },
    theme: { colorScheme: theme, ...getThemeConfig(theme) },
    startScreen: { greeting: GREETING, prompts: STARTER_PROMPTS },
    composer: { placeholder: PLACEHOLDER_INPUT, attachments: { enabled: true } },
    onResponseEnd,
    onThreadChange: () => processedFacts.current.clear(),
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
  });

  /** Thread/messages access that works across versions */
  const thread: any = chatkit?.thread ?? chatkit?.control?.thread ?? null;
  const rawMessages: any[] =
    thread?.items ??
    thread?.messages ??
    chatkit?.messages ??
    [];

  /** Map to simple shape (role, text) */
  const messages = useMemo(
    () =>
      rawMessages
        .map((m: any) => {
          const role: "user" | "assistant" | string =
            m.role ?? m.author ?? m.sender ?? "";
          // content could be various shapes across versions
          const text: string =
            (typeof m.content === "string" && m.content) ||
            m.text ||
            m.message ||
            m.delta ||
            m.content?.text ||
            m.content?.[0]?.text ||
            m.content?.[0]?.content ||
            "";
          if (!text || (role !== "user" && role !== "assistant")) return null;
          return { role: role as "user" | "assistant", text };
        })
        .filter(Boolean),
    [rawMessages]
  ) as Array<{ role: "user" | "assistant"; text: string }>;

  /** Consider session ready when control AND thread exist */
  const isReady = Boolean(chatkit?.control && thread);

  useEffect(() => {
    if (!isReady && isInitializingSession) {
      // allow a moment for the session to initialize
      const t = setTimeout(() => setIsInitializingSession(false), 300);
      return () => clearTimeout(t);
    }
  }, [isReady, isInitializingSession]);

  if (!isReady) {
    return (
      <div className="flex items-center justify-center h-[90vh] text-gray-400 bg-white dark:bg-slate-900">
        טוען שיחה...
      </div>
    );
  }

  /** Send message via whichever API is available in your version */
  const doSend = async (text: string) => {
    const api: any = chatkit;
    if (api?.sendMessage) {
      await api.sendMessage({ content: text, text });
      return;
    }
    if (api?.control?.sendMessage) {
      await api.control.sendMessage({ text, content: text });
      return;
    }
    if (api?.control?.composer?.send) {
      await api.control.composer.send(text);
      return;
    }
    console.warn("[ChatKitPanel] No sendMessage API found on chatkit; check library version.");
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = (new FormData(e.currentTarget as HTMLFormElement).get("message") as string)?.trim();
    if (!text) return;
    await doSend(text);
    (e.currentTarget as HTMLFormElement).reset();
  };

  const isStreaming = Boolean(chatkit?.isStreaming || chatkit?.control?.isStreaming);

  return (
    <div className="relative flex flex-col h-[90vh] bg-white dark:bg-slate-900 rounded-2xl shadow-sm">

      {/* Thread */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.map((m, i) => {
          const dir = detectDirection(m.text);
          const isUser = m.role === "user";
          return (
            <div
              key={i}
              className={`max-w-[75%] px-3 py-2 rounded-xl whitespace-pre-wrap break-words ${
                isUser
                  ? "bg-[#DCF8C6] ml-auto text-right"
                  : "bg-[#F1F1F1] mr-auto text-right"
              }`}
              style={{ direction: dir, unicodeBidi: "plaintext" }}
            >
              {m.text}
            </div>
          );
        })}

        {isStreaming && (
          <div
            className="max-w-[75%] px-3 py-2 rounded-xl whitespace-pre-wrap break-words bg-[#F1F1F1] mr-auto text-right"
            style={{ direction: "rtl", unicodeBidi: "plaintext" }}
          >
            …
          </div>
        )}
      </div>

      {/* Composer */}
      <form onSubmit={onSubmit} className="p-3 border-t flex gap-2 bg-white dark:bg-slate-900">
        <input
          name="message"
          placeholder="הקלד הודעה…"
          className="flex-1 border rounded-lg px-3 py-2 bg-white dark:bg-slate-800 dark:text-white"
          style={{ direction: "rtl", textAlign: "right" }}
        />
        <button
          type="submit"
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg"
        >
          שלח
        </button>
      </form>
    </div>
  );
}
