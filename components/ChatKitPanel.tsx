"use client";

import { useCallback, useRef, useState } from "react";
import { ChatKit, useChatKit } from "@openai/chatkit-react";
import {
  STARTER_PROMPTS,
  PLACEHOLDER_INPUT,
  GREETING,
  CREATE_SESSION_ENDPOINT,
  WORKFLOW_ID,
  getThemeConfig,
} from "@/lib/config";
import type { ColorScheme } from "@/hooks/useColorScheme";

/** ✅ Detect Hebrew */
const isHebrew = (text: string) => /[\u0590-\u05FF]/.test(text);

type ChatKitPanelProps = {
  theme: ColorScheme;
  onResponseEnd: () => void;
};

export function ChatKitPanel({ theme, onResponseEnd }: ChatKitPanelProps) {

  const [direction, setDirection] = useState<"rtl" | "ltr">("ltr");

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
    theme: {
      colorScheme: theme,
      ...getThemeConfig(theme),
      layout: { direction }, // ✅ auto RTL/LTR
    },
    startScreen: {
      greeting: GREETING,
      prompts: STARTER_PROMPTS,
    },
    composer: {
      placeholder: PLACEHOLDER_INPUT,
      onTextChange: handleTextInput, // ✅ track language
      attachments: { enabled: true },
    },
    onResponseEnd,
  });

  return (
    <div className="relative pb-8 flex h-[90vh] w-full rounded-2xl flex-col overflow-hidden bg-white shadow-sm dark:bg-slate-900">
      <ChatKit control={chatkit.control} className="block h-full w-full" />
    </div>
  );
}
