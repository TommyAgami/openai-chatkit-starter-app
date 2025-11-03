import { ColorScheme, StartScreenPrompt, ThemeOption } from "@openai/chatkit";

export const WORKFLOW_ID =
  process.env.NEXT_PUBLIC_CHATKIT_WORKFLOW_ID?.trim() ?? "";

export const CREATE_SESSION_ENDPOINT = "/api/create-session";

export const STARTER_PROMPTS: StartScreenPrompt[] = [
  {
    label: "איזה פיצ'רים יש במדפורם",
    prompt: "מה הפיצ'רים הבולטים שלכם?",
    icon: "circle-question",
  },
  {
   label: "מעוניין/ת בהדגמה?",
    prompt: "שלום אפשר לקבוע הדגמה?",
    icon: "circle-question",
  },
];

export const PLACEHOLDER_INPUT = "אני כאן לכל שאלה...";

export const GREETING = "מדפורם AI";

export const getThemeConfig = (theme: ColorScheme): ThemeOption => ({
  color: {
    grayscale: {
      hue: 220,
      tint: 6,
      shade: theme === "dark" ? -1 : -4,
    },
    accent: {
      primary: theme === "dark" ? "#f1f5f9" : "#0f172a",
      level: 1,
    },
  },
  radius: "round",
  import type { ChatKitOptions } from "@openai/chatkit";

const options: ChatKitOptions = {
  api: {
    // TODO: configure your ChatKit API integration (URL, auth, uploads).
  },
  theme: {
    colorScheme: 'light',
    radius: 'pill',
    density: 'compact',
    color: {
      grayscale: {
        hue: 204,
        tint: 7,
        shade: 1
      },
      accent: {
        primary: '#262f5a',
        level: 1
      }
    },
    typography: {
      baseSize: 16,
      fontFamily: '"OpenAI Sans", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif',
      fontFamilyMono: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "DejaVu Sans Mono", "Courier New", monospace',
      fontSources: [
        {
          family: 'OpenAI Sans',
          src: 'https://cdn.openai.com/common/fonts/openai-sans/v2/OpenAISans-Regular.woff2',
          weight: 400,
          style: 'normal',
          display: 'swap'
        }
      // ...and 7 more font sources
      ]
    }
  },
  composer: {
    placeholder: 'כאן לכל שאלה',
    attachments: {
      enabled: true,
      maxCount: 5,
      maxSize: 10485760
    },
  },
  startScreen: {
    greeting: 'AI מדפורם',
    prompts: [
      {
        icon: 'circle-question',
        label: 'What is ChatKit?',
        prompt: 'What is ChatKit?'
      }
      // ...and 4 more prompts
    ],
  },
  // Optional fields not shown: locale, initialThread, threadItemActions, header, onClientTool, entities, widgets
};
  // Add other theme options here
  // chatkit.studio/playground to explore config options
});
