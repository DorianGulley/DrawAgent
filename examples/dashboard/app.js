const tasks = [
  { name: "Finish pitch deck", sub: "Due 2pm", done: false },
  { name: "Call mom", sub: "Evening", done: false },
  { name: "Gym session", sub: "Leg day", done: true },
];

document.getElementById("date-badge").textContent = new Date().toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" });

const list = document.getElementById("task-list");
function renderTasks() {
  list.innerHTML = "";
  tasks.forEach((task, index) => {
    const item = document.createElement("li");
    item.className = "task" + (task.done ? " done" : "");
    item.innerHTML = `<span class="task-check"></span><span class="task-body"><div class="task-name">${task.name}</div><div class="task-sub">${task.sub}</div></span>`;
    item.addEventListener("click", () => {
      tasks[index].done = !tasks[index].done;
      renderTasks();
    });
    list.appendChild(item);
  });
}
renderTasks();

let remaining = 25 * 60;
let interval = null;
const timer = document.getElementById("timer");
const button = document.getElementById("focus-button");
button.addEventListener("click", () => {
  if (interval) {
    clearInterval(interval);
    interval = null;
    button.textContent = "Resume focus";
    button.classList.remove("running");
    return;
  }
  button.textContent = "Pause";
  button.classList.add("running");
  interval = setInterval(() => {
    remaining = Math.max(0, remaining - 1);
    timer.textContent = `${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, "0")}`;
  }, 1000);
});
