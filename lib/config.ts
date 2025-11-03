import { ColorScheme, StartScreenPrompt, ThemeOption } from "@openai/chatkit";

export const WORKFLOW_ID =
  process.env.NEXT_PUBLIC_CHATKIT_WORKFLOW_ID?.trim() ?? "";

export const CREATE_SESSION_ENDPOINT = "/api/create-session";

/** ✅ Hebrew starter prompts */
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

export const PLACEHOLDER_INPUT = "...אני כאן לכל שאלה";
export const GREETING = "AI מדפורם";

/** ✅ Base theme (colors, fonts) — RTL will be controlled dynamically */
export const getThemeConfig = (theme: ColorScheme): ThemeOption => ({
  color: {
    grayscale: {
      hue: 204,
      tint: 2,
      shade: 1,
    },
    accent: {
      primary: "#262f5a", // Medform Navy
      level: 1,
    },
  },
  radius: "pill",
  density: "compact",
  typography: {
    baseSize: 16,
    fontFamily:
      '"Heebo", "Assistant", "OpenAI Sans", system-ui, Helvetica, Arial, sans-serif',
  },
});
