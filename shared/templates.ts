import { AppDoc, AppNode, NodeType, StyleMap } from "./model";

type Spec = Omit<AppNode, "style" | "children" | "type" | "name"> & { style?: StyleMap; children?: AppNode[] };

const node = (type: NodeType, name: string, spec: Spec): AppNode => ({ type, name, style: {}, ...spec });

const habit = (id: string, text: string, icon: string, subtext: string, done: boolean) =>
  node("habit", text, { id, text, icon, subtext, done });

const stat = (id: string, text: string, subtext: string) => node("stat", `${subtext} stat`, { id, text, subtext });

const habitTracker: AppDoc = {
  schemaVersion: 1,
  root: node("screen", "Screen", {
    id: "screen",
    children: [
      node("header", "Header", {
        id: "header",
        children: [
          node("text", "Greeting", { id: "greeting", text: "Good morning, Alex", style: { color: "#8A8378", fontSize: 15 } }),
          node("heading", "Title", { id: "title", text: "Today", style: { fontSize: 34, fontWeight: 800 } }),
        ],
      }),
      node("card", "Progress card", {
        id: "progress-card",
        children: [
          node("heading", "Progress heading", { id: "progress-heading", text: "Daily progress", style: { fontSize: 17, fontWeight: 600 } }),
          node("progress", "Progress bar", { id: "progress-bar", style: { accentColor: "#22A06B" } }),
          node("text", "Encouragement", { id: "encouragement", text: "Small steps, every day.", style: { color: "#8A8378", fontSize: 14 } }),
        ],
      }),
      node("section", "Habits section", {
        id: "habits",
        children: [
          node("heading", "Habits heading", { id: "habits-heading", text: "Today's habits", style: { fontSize: 20 } }),
          habit("habit-water", "Drink water", "💧", "8 glasses", true),
          habit("habit-read", "Read 20 pages", "📚", "12 day streak", true),
          habit("habit-meditate", "Meditate", "🧘", "10 minutes", false),
          habit("habit-walk", "Evening walk", "🌿", "8,000 steps", false),
          habit("habit-sleep", "Lights out by 11", "🌙", "4 day streak", false),
        ],
      }),
      node("statGroup", "Stats row", {
        id: "stats",
        children: [stat("stat-streak", "12", "Day streak"), stat("stat-week", "86%", "This week"), stat("stat-perfect", "4", "Perfect days")],
      }),
      node("button", "Complete all button", { id: "complete-all", text: "Complete all habits", action: "completeAll" }),
    ],
  }),
};

const personalDashboard: AppDoc = {
  schemaVersion: 1,
  root: node("screen", "Screen", {
    id: "screen",
    style: { backgroundColor: "#F2F4F8" },
    children: [
      node("header", "Header", {
        id: "header",
        children: [
          node("badge", "Date badge", { id: "date-badge", text: "Saturday · Sunny 68°", style: { backgroundColor: "#E3ECFF", color: "#2F5BD3" } }),
          node("heading", "Title", { id: "title", text: "Hi, Jordan", style: { fontSize: 32, fontWeight: 800 } }),
        ],
      }),
      node("card", "Focus card", {
        id: "focus-card",
        style: { backgroundColor: "#1F2A44", color: "#FFFFFF" },
        children: [
          node("text", "Focus label", { id: "focus-label", text: "Deep work", style: { color: "#AFC0E8", fontSize: 14 } }),
          node("heading", "Focus timer", { id: "focus-timer", text: "25:00", style: { fontSize: 44, fontWeight: 800 } }),
          node("button", "Start focus button", {
            id: "focus-button",
            text: "Start focus",
            action: "startFocus",
            style: { backgroundColor: "#FFFFFF", color: "#1F2A44" },
          }),
        ],
      }),
      node("statGroup", "Stats row", {
        id: "stats",
        children: [stat("stat-steps", "6.2k", "Steps"), stat("stat-sleep", "7h 40m", "Sleep"), stat("stat-mood", "Great", "Mood")],
      }),
      node("section", "Tasks section", {
        id: "tasks",
        children: [
          node("heading", "Tasks heading", { id: "tasks-heading", text: "Top priorities" }),
          habit("task-deck", "Finish pitch deck", "📊", "Due 2pm", false),
          habit("task-call", "Call mom", "📞", "Evening", false),
          habit("task-gym", "Gym session", "🏋️", "Leg day", true),
        ],
      }),
    ],
  }),
};

export const TEMPLATES = {
  habits: { name: "Bloom", tagline: "Habit tracker", emoji: "🌱", doc: habitTracker },
  dashboard: { name: "Daybook", tagline: "Personal dashboard", emoji: "☀️", doc: personalDashboard },
} as const;

export type TemplateId = keyof typeof TEMPLATES;
