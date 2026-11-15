const habits = [
  { name: "Drink water", icon: "💧", sub: "8 glasses", done: true },
  { name: "Read 20 pages", icon: "📚", sub: "12 day streak", done: true },
  { name: "Meditate", icon: "🧘", sub: "10 minutes", done: false },
  { name: "Evening walk", icon: "🌿", sub: "8,000 steps", done: false },
  { name: "Lights out by 11", icon: "🌙", sub: "4 day streak", done: false },
];

const list = document.getElementById("habit-list");
const checkIcon = '<svg viewBox="0 0 24 24"><path d="M6 12.5l4 4 8-9"/></svg>';

function render() {
  list.innerHTML = "";
  habits.forEach((habit, index) => {
    const item = document.createElement("li");
    item.className = "habit" + (habit.done ? " done" : "");
    item.innerHTML = `<span class="check">${checkIcon}</span><span class="habit-icon">${habit.icon}</span><span class="habit-body"><div class="habit-name">${habit.name}</div><div class="habit-sub">${habit.sub}</div></span>`;
    item.addEventListener("click", () => {
      habits[index].done = !habits[index].done;
      render();
    });
    list.appendChild(item);
  });
  const done = habits.filter((h) => h.done).length;
  const percent = Math.round((done / habits.length) * 100);
  document.getElementById("progress-fill").style.width = percent + "%";
  document.getElementById("progress-count").textContent = `${done} of ${habits.length} done`;
  document.getElementById("progress-percent").textContent = percent + "%";
}

document.getElementById("complete-all").addEventListener("click", () => {
  const allDone = habits.every((h) => h.done);
  habits.forEach((h) => (h.done = !allDone));
  render();
});

render();
