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

/** ✅ Detect Hebrew */
const isHebrew = (text: string) => /[\u0590-\u05FF]/.test(text);

export type ChatKitPanelProps = {
  theme: ColorScheme;
  onWidgetAction: () => Promise<void>;
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
  const [direction, setDirection] = useState<"rtl" | "ltr">("ltr");

  /** ✅ Listen for user typing to flip direction */
  const handleTextInput = useCallback((text: string) => {
    setDirection(isHebrew(text) ? "rtl" : "ltr");
  }, []);

  const getClientSecret = useCallback(async () => {
    const response = await fetch(CREATE_SESSION_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workflow: { id: WORKFLOW_ID } }),
    });

    const data = await response.json();
    return data.client_secret;
  }, []);

  const chatkit = useChatKit({
    api: { getClientSecret },

    /** ✅ Apply theme + dynamic RTL */
    theme: {
      colorScheme: theme,
      ...getThemeConfig(theme),
      layout: {
        direction, // ✅ <-- This is the auto-switch direction
      },
    },

    startScreen: {
      greeting: GREETING,
      prompts: STARTER_PROMPTS,
    },

    composer: {
      placeholder: PLACEHOLDER_INPUT,
      onTextChange: handleTextInput, // ✅ detect typing
      attachments: { enabled: true },
    },

    onResponseEnd,
  });

  return (
    <div className="relative pb-8 flex h-[90vh] w-full rounded-2xl flex-col overflow-hidden bg-white shadow-sm dark:bg-slate-900">
      <ChatKit control={chatkit.control} className="block h-full w-full" />
      <ErrorOverlay />
    </div>
  );
}
