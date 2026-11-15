import { NodeType } from "../shared/model";

const SUGGESTIONS: Record<NodeType, string[]> = {
  button: ["Make this button bigger and purple", "Make it a pill", "Give it a coral fill", "Move this to the top"],
  heading: ["Change this heading to 'My Daily Goals'", "Make it bigger and bold", "Make the text indigo", "Center it"],
  text: ["Make the text teal", "Make it bold", "Change the text to “You’ve got this”", "Center it"],
  card: ["Give this card rounded corners", "Make it light purple", "Add more padding", "Move this up"],
  section: ["Move this section above the progress bar", "Add more spacing between items", "Move this to the top"],
  progress: ["Make the bar green and taller", "Make the progress bar coral", "Square the corners"],
  habit: ["Make the check purple", "Move it up", "Rename to 'Stretch'", "Give it a light yellow background"],
  statGroup: ["Move this to the top", "Add more space between stats"],
  stat: ["Make the text blue", "Make it a light mint background", "Make it bigger"],
  badge: ["Make it light green", "Make it bigger", "Change the text to 'Today'"],
  header: ["Move this below the stats", "Add more spacing"],
  screen: ["Make the background light lavender", "Dark navy background", "Add more spacing"],
};

export function suggestionsFor(type: NodeType): string[] {
  return SUGGESTIONS[type] ?? [];
}
