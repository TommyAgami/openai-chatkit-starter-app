import { ColorScheme, StartScreenPrompt, ThemeOption } from "@openai/chatkit";

export const WORKFLOW_ID =
  process.env.NEXT_PUBLIC_CHATKIT_WORKFLOW_ID?.trim() ?? "";

export const CREATE_SESSION_ENDPOINT = "/api/create-session";

export const STARTER_PROMPTS: StartScreenPrompt[] = [
  {
    label: "איזה פיצ'רים יש במדפורם?",
    prompt: "מה הפיצ'רים הבולטים שלכם?",
    icon: "circle-question",
  },
  {
    label: "מעוניין/ת בהדגמה?",
    prompt: "שלום, אפשר לקבוע הדגמה?",
    icon: "circle-question",
  },
];

export const PLACEHOLDER_INPUT = "אני כאן לכל שאלה…";
export const GREETING = "מדפורם AI";

/** Theme (matches the ChatKit studio config) */
export const getThemeConfig = (theme: ColorScheme): ThemeOption => ({
  colorScheme: theme,
  radius: "pill",
  density: "comfortable",
  color: {
    grayscale: {
      hue: 204,
      tint: 7,
      shade: theme === "dark" ? -2 : 1,
    },
    accent: {
      primary: "#1B2A59",
      level: 1,
    },
  },
  typography: {
    baseSize: 16,
    fontFamily: `"Assistant", "Heebo", Arial, sans-serif`,
  },
});
