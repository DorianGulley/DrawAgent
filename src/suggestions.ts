import { NodeType } from "../shared/model";

const SUGGESTIONS: Record<NodeType, string[]> = {
  button: ["Make it a pill", "Make this button bigger and purple", "Use the same color as the cards", "Move this to the top"],
  heading: ["Make it bigger and bold", "Make the text indigo", "Center it", "Change this to 'My week'"],
  text: ["Make the text teal", "Make it bold", "Center it", "Change the text to 'You've got this'"],
  card: ["Make them rounder", "Make it light purple", "Add more padding", "Match the header"],
  section: ["Move this above the progress bar", "Add more spacing between items", "Move this to the top"],
  progress: ["Make the bar green and taller", "Use the same color as the button", "Square the corners"],
  habit: ["Make the check purple", "Make them rounder", "Give it a light yellow background", "Move it up"],
  statGroup: ["Move this to the top", "Add more space between stats"],
  stat: ["Make the text blue", "Make it a light mint background", "Make it bigger"],
  badge: ["Make it light green", "Make it bigger", "Change the text to 'Today'"],
  header: ["Move this below the stats", "Add more spacing"],
  screen: ["Make the background light lavender", "Dark navy background", "Add more spacing"],
  grid: ["Add more space between cards", "Tighter spacing"],
  row: ["Add more space between them", "Tighter spacing"],
  shape: ["Make it rounder", "Make it bigger and green", "Make it a circle", "Square the corners"],
  clock: ["Make it bigger", "Make it thinner", "Make the text cream"],
  page: ["Add more spacing", "Change the tab name to 'Home'"],
  image: ["Make it taller", "Rounder corners", "Square the corners"],
  input: ["Make it rounder", "Give it a light gray background"],
  divider: ["Make it darker", "Make it thicker"],
};

export const EVERYTHING_SUGGESTIONS = ["Make the whole thing feel warmer", "Tighten all the spacing", "Rounder corners everywhere", "Match my style", "Bigger text", "Cooler colors"];

export function suggestionsFor(type: NodeType, count: number): string[] {
  const list = SUGGESTIONS[type] ?? [];
  return count > 1 ? ["Make them rounder", "Do the same", ...list.filter((s) => !/rounder/.test(s))].slice(0, 5) : list;
}
