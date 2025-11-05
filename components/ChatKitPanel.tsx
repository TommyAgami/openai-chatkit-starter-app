"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChatKit, useChatKit } from "@openai/chatkit-react";
import {
  STARTER_PROMPTS,
  PLACEHOLDER_INPUT,
  GREETING,
  CREATE_SESSION_ENDPOINT,
  WORKFLOW_ID,
  getThemeConfig,
} from "@/lib/config";
import { ErrorOverlay } from "./ErrorOverlay";
import type { ColorScheme } from "@/hooks/useColorScheme";

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

const isBrowser = typeof window !== "undefined";
const isDev = process.env.NODE_ENV !== "production";

const createInitialErrors = (): ErrorState => ({
  script: null,
  session: null,
  integration: null,
  retryable: false,
});

export function ChatKitPanel({
  theme,
  onWidgetAction: _onWidgetAction,   // renamed to avoid unused var TS warning
  onResponseEnd,
  onThemeRequest: _onThemeRequest,   // renamed to avoid unused var TS warning
}: ChatKitPanelProps) {
  const processedFacts = useRef(new Set<string>());
  const [errors, setErrors] = useState<ErrorState>(() => createInitialErrors());
  const [isInitializingSession, setIsInitializingSession] = useState(true);
  const isMountedRef = useRef(true);
  const [scriptStatus, setScriptStatus] = useState<
    "pending" | "ready" | "error"
  >(() =>
    isBrowser && window.customElements?.get("openai-chatkit")
      ? "ready"
      : "pending"
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

    if (window.customElements?.get("openai-chatkit")) {
      handleLoaded();
    } else if (scriptStatus === "pending") {
      timeoutId = window.setTimeout(() => {
        if (!window.customElements?.get("openai-chatkit")) {
          handleError(
            new CustomEvent("chatkit-script-error", {
              detail:
                "ChatKit web component is unavailable. Verify that the script URL is reachable.",
            })
          );
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
      setScriptStatus(
        window.customElements?.get("openai-chatkit") ? "ready" : "pending"
      );
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
        const detail =
          "Set NEXT_PUBLIC_CHATKIT_WORKFLOW_ID in your .env.local file.";
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
        const data = raw ? JSON.parse(raw) : {};
        if (!response.ok) throw new Error(data?.error ?? response.statusText);

        return data.client_secret as string;
      } finally {
        if (isMountedRef.current && !currentSecret) {
          setIsInitializingSession(false);
        }
      }
    },
    [isWorkflowConfigured, setErrorState]
  );

  const chatkit = useChatKit({
    api: { getClientSecret },
    theme: { colorScheme: theme, ...getThemeConfig(theme) },
    startScreen: { greeting: GREETING, prompts: STARTER_PROMPTS },
    composer: { placeholder: PLACEHOLDER_INPUT, attachments: { enabled: true } },
    threadItemActions: { feedback: false },
    onClientTool: async () => ({ success: true }),
    onResponseEnd,
    onResponseStart: () => setErrorState({ integration: null, retryable: false }),
    onThreadChange: () => processedFacts.current.clear(),
    onError: ({ error }) => console.error("ChatKit error", error),
  });

  /** ✅ Apply RTL + bubble alignment inside Shadow DOM */
  useEffect(() => {
    if (typeof window === "undefined") return;

    const host =
      document.querySelector("openai-chatkit") ||
      document.querySelector("openai-chat");

    if (!host || !host.shadowRoot) return;

    const style = document.createElement("style");
    style.textContent = `
      :host {
        direction: rtl !important;
        text-align: right !important;
      }

      .assistant,
      .assistant *,
      .user,
      .user * {
        direction: rtl !important;
        text-align: right !important;
      }

      .assistant,
      .user {
        margin-left: auto !important;
        margin-right: 0 !important;
        align-self: flex-end !important;
      }

      thread-item,
      .thread-item,
      .thread-item * {
        text-align: right !important;
        direction: rtl !important;
        justify-content: flex-end !important;
      }
    `;
    host.shadowRoot.appendChild(style);
  }, []);

  const activeError = errors.session ?? errors.integration;
  const blockingError = errors.script ?? activeError;

  if (isDev) {
    console.debug("[ChatKitPanel] render state", {
      isInitializingSession,
      hasControl: Boolean(chatkit.control),
      scriptStatus,
      hasError: Boolean(blockingError),
      workflowId: WORKFLOW_ID,
    });
  }

  return (
    <div
      className="relative pb-8 flex h-[90vh] w-full rounded-2xl flex-col overflow-hidden bg-white shadow-sm transition-colors dark:bg-slate-900"
      dir="rtl"
      style={{ textAlign: "right" }}
    >
      <ChatKit
        key={widgetInstanceKey}
        control={chatkit.control}
        className={
          blockingError || isInitializingSession
            ? "pointer-events-none opacity-0"
            : "block h-full w-full"
        }
      />
      <ErrorOverlay
        error={blockingError}
        fallbackMessage={
          blockingError || !isInitializingSession
            ? null
            : "Loading assistant session..."
        }
        onRetry={blockingError && errors.retryable ? handleResetChat : null}
        retryLabel="Restart chat"
      />
    </div>
  );
}

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
