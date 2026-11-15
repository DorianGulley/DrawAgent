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

const trip = (id: string, place: string, when: string, color: string) =>
  node("card", `${place} card`, {
    id,
    style: { backgroundColor: color, gap: 6, padding: 16 },
    children: [
      node("text", `${place} dates`, { id: `${id}-when`, text: when, style: { fontSize: 13, color: "#6B6459" } }),
      node("heading", `${place} name`, { id: `${id}-name`, text: place, style: { fontSize: 19 } }),
    ],
  });

const wanderlist: AppDoc = {
  schemaVersion: 1,
  root: node("screen", "Screen", {
    id: "screen",
    style: { backgroundColor: "#F6F1EA" },
    children: [
      node("header", "Header", {
        id: "header",
        children: [
          node("text", "Kicker", { id: "kicker", text: "2027 travel board", style: { color: "#8A8378", fontSize: 15 } }),
          node("heading", "Title", { id: "title", text: "Wanderlist", style: { fontSize: 34, fontWeight: 800 } }),
        ],
      }),
      node("grid", "Trips grid", {
        id: "trips",
        children: [
          trip("trip-lisbon", "Lisbon", "Mar 4 – 9", "#FFE7D6"),
          trip("trip-kyoto", "Kyoto", "Apr 1 – 12", "#FCE1E7"),
          trip("trip-oaxaca", "Oaxaca", "May 20 – 26", "#FFF1C9"),
          trip("trip-oslo", "Oslo", "Jun 14 – 18", "#DDEBFF"),
          trip("trip-cape", "Cape Town", "Sep 2 – 15", "#DDF3E4"),
          trip("trip-hanoi", "Hanoi", "Nov 8 – 19", "#EDE4FF"),
        ],
      }),
      node("button", "Plan button", { id: "plan", text: "Plan the next one" }),
    ],
  }),
};

const widget = (id: string, label: string, value: string, style: StyleMap = {}) =>
  node("card", `${label} widget`, {
    id,
    style: { padding: 16, gap: 4, borderRadius: 24, ...style },
    children: [
      node("text", `${label} label`, { id: `${id}-label`, text: label, style: { fontSize: 13, fontWeight: 600 } }),
      node("heading", `${label} value`, { id: `${id}-value`, text: value, style: { fontSize: 22 } }),
    ],
  });

const lockDusk: AppDoc = {
  schemaVersion: 1,
  root: node("screen", "Wallpaper", {
    id: "screen",
    style: { backgroundColor: "#FF9A6B", accentColor: "#2A1B5E", color: "#FFFFFF", padding: 28, gap: 14 },
    children: [
      node("header", "Time and date", {
        id: "header",
        style: { gap: 0 },
        children: [
          node("text", "Date", { id: "date", text: "Sunday, November 15", style: { fontSize: 19, fontWeight: 600, textAlign: "center" } }),
          node("clock", "Clock", { id: "clock", text: "9:41" }),
        ],
      }),
      node("row", "Widgets", {
        id: "widgets",
        children: [
          widget("widget-weather", "Weather", "68° Sunny", { backgroundColor: "#FFFFFF33", color: "#FFFFFF" }),
          widget("widget-rings", "Move", "420 cal", { backgroundColor: "#FFFFFF33", color: "#FFFFFF" }),
        ],
      }),
    ],
  }),
};

const lockMono: AppDoc = {
  schemaVersion: 1,
  root: node("screen", "Wallpaper", {
    id: "screen",
    style: { backgroundColor: "#111111", accentColor: "#3A3A3A", color: "#F4F1EA", padding: 28, gap: 14 },
    children: [
      node("header", "Time and date", {
        id: "header",
        style: { gap: 0 },
        children: [
          node("text", "Date", { id: "date", text: "SUN 15", style: { fontSize: 17, fontWeight: 700, textAlign: "center" } }),
          node("clock", "Clock", { id: "clock", text: "9:41", style: { fontSize: 104, fontWeight: 300 } }),
        ],
      }),
      node("row", "Widgets", {
        id: "widgets",
        children: [
          widget("widget-next", "Next", "Standup 10:00", { backgroundColor: "#F4F1EA", color: "#111111" }),
          widget("widget-steps", "Steps", "6,214", { backgroundColor: "#F4F1EA", color: "#111111" }),
        ],
      }),
    ],
  }),
};

const logoSprout: AppDoc = {
  schemaVersion: 1,
  root: node("screen", "Canvas", {
    id: "screen",
    style: { backgroundColor: "#00000000", color: "#1B3A2B", padding: 40, gap: 0 },
    children: [
      node("row", "Lockup", {
        id: "lockup",
        style: { gap: 18 },
        children: [
          node("shape", "Mark", {
            id: "mark",
            style: { backgroundColor: "#2F9E5B", width: 112, height: 112, borderRadius: 999 },
            children: [node("heading", "Mark letter", { id: "mark-letter", text: "s", style: { fontSize: 72, fontWeight: 800, color: "#FFFFFF" } })],
          }),
          node("heading", "Wordmark", { id: "wordmark", text: "sprout", style: { fontSize: 76, fontWeight: 800 } }),
        ],
      }),
    ],
  }),
};

const logoMonogram: AppDoc = {
  schemaVersion: 1,
  root: node("screen", "Canvas", {
    id: "screen",
    style: { backgroundColor: "#00000000", color: "#16151A", padding: 40, gap: 22 },
    children: [
      node("shape", "Mark", {
        id: "mark",
        style: { backgroundColor: "#16151A", width: 240, height: 240, borderRadius: 64 },
        children: [node("heading", "Monogram", { id: "monogram", text: "D", style: { fontSize: 160, fontWeight: 800, color: "#F5F3EE" } })],
      }),
      node("text", "Name", { id: "name", text: "DIRECT STUDIO", style: { fontSize: 22, fontWeight: 700, textAlign: "center" } }),
    ],
  }),
};

export interface Template {
  id: string;
  name: string;
  tagline: string;
  emoji: string;
  doc: AppDoc;
}

export const TEMPLATES: Record<string, Template> = {
  habits: { id: "habits", name: "Bloom", tagline: "Habit tracker", emoji: "🌱", doc: habitTracker },
  dashboard: { id: "dashboard", name: "Daybook", tagline: "Personal dashboard", emoji: "☀️", doc: personalDashboard },
  wanderlist: { id: "wanderlist", name: "Wanderlist", tagline: "Travel board", emoji: "🧭", doc: wanderlist },
  dusk: { id: "dusk", name: "Dusk", tagline: "Warm gradient", emoji: "🌇", doc: lockDusk },
  mono: { id: "mono", name: "Mono", tagline: "Quiet and graphic", emoji: "🖤", doc: lockMono },
  sprout: { id: "sprout", name: "Sprout", tagline: "Round mark + wordmark", emoji: "🌿", doc: logoSprout },
  monogram: { id: "monogram", name: "Monogram", tagline: "Bold single letter", emoji: "🅳", doc: logoMonogram },
};
