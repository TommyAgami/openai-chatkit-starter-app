"use client";

import { useCallback } from "react";
import { ChatKitPanel, type FactAction } from "@/components/ChatKitPanel";
import { useColorScheme } from "@/hooks/useColorScheme";

/**
 * IMPORTANT:
 * This app now renders YOUR custom Chat UI (ChatKitPanel),
 * NOT the OpenAI <ChatKit /> web component.
 */

export default function App() {
  const { scheme, setScheme } = useColorScheme();

  const handleWidgetAction = useCallback(async (action: FactAction) => {
    // optional: save facts to your DB / CRM later
    console.log("FACT ACTION:", action);
  }, []);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4 bg-black">
      <div className="w-full max-w-2xl mx-auto">
        <ChatKitPanel
          theme={scheme}
          onWidgetAction={handleWidgetAction}
          onResponseEnd={() => {}}
          onThemeRequest={setScheme}
        />
      </div>
    </main>
  );
}
