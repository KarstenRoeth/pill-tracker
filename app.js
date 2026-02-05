const storageKey = "pillTrackerData";
const state = {
  viewDate: new Date(),
  pills: {},
  undoStack: []
};

const monthLabel = document.getElementById("monthLabel");
const calendarGrid = document.getElementById("calendarGrid");
const prevMonthBtn = document.getElementById("prevMonth");
const nextMonthBtn = document.getElementById("nextMonth");
const todayBtn = document.getElementById("todayBtn");
const undoBtn = document.getElementById("undoBtn");
const reminderOverlay = document.getElementById("reminderOverlay");
const reminderMark = document.getElementById("reminderMark");
const reminderLater = document.getElementById("reminderLater");
const statusText = document.getElementById("statusText");
const statTaken = document.getElementById("statTaken");
const statOpen = document.getElementById("statOpen");
const statRate = document.getElementById("statRate");
const statStreak = document.getElementById("statStreak");
const statBestStreak = document.getElementById("statBestStreak");

function loadState() {
  const raw = localStorage.getItem(storageKey);
  if (!raw) return;
  try {
    const parsed = JSON.parse(raw);
    state.pills = parsed.pills || {};
    state.undoStack = parsed.undoStack || [];
  } catch (err) {
    console.warn("Could not parse stored data", err);
  }
}

function saveState() {
  localStorage.setItem(storageKey, JSON.stringify({
    pills: state.pills,
    undoStack: state.undoStack.slice(-50)
  }));
}

function toDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function isSameDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function renderCalendar() {
  const year = state.viewDate.getFullYear();
  const month = state.viewDate.getMonth();
  const start = new Date(year, month, 1);
  const end = new Date(year, month + 1, 0);
  const monthName = state.viewDate.toLocaleDateString("de-DE", { month: "long", year: "numeric" });
  monthLabel.textContent = monthName.charAt(0).toUpperCase() + monthName.slice(1);

  const firstWeekday = (start.getDay() + 6) % 7;
  const daysInMonth = end.getDate();
  calendarGrid.innerHTML = "";

  for (let i = 0; i < firstWeekday; i++) {
    const empty = document.createElement("div");
    empty.className = "day inactive";
    calendarGrid.appendChild(empty);
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, month, day);
    const dayKey = toDateKey(date);
    const done = !!state.pills[dayKey];
    const dayEl = document.createElement("button");
    dayEl.type = "button";
    dayEl.className = `day${done ? " done" : ""}${isSameDay(date, new Date()) ? " today" : ""}`;
    dayEl.innerHTML = `
      <div class="day-number">${day}</div>
      <div class="pill-badge">${done ? "genommen" : "offen"}</div>
    `;

    dayEl.addEventListener("click", () => {
      toggleDay(dayKey);
    });

    calendarGrid.appendChild(dayEl);
  }

  updateUndoButton();
  updateStatus();
  updateStats();
}

function toggleDay(dayKey) {
  const previous = !!state.pills[dayKey];
  state.undoStack.push({ dayKey, previous });
  if (previous) {
    delete state.pills[dayKey];
  } else {
    state.pills[dayKey] = true;
  }
  saveState();
  renderCalendar();
}

function updateUndoButton() {
  undoBtn.disabled = state.undoStack.length === 0;
}

function undoLast() {
  const last = state.undoStack.pop();
  if (!last) return;
  if (last.previous) {
    state.pills[last.dayKey] = true;
  } else {
    delete state.pills[last.dayKey];
  }
  saveState();
  renderCalendar();
}

function updateStatus() {
  const todayKey = toDateKey(new Date());
  const done = !!state.pills[todayKey];
  statusText.textContent = done ? "Heute bereits eingetragen." : "Lokale Speicherung aktiv.";
}

function updateStats() {
  const year = state.viewDate.getFullYear();
  const month = state.viewDate.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  let taken = 0;

  for (let day = 1; day <= daysInMonth; day++) {
    const key = toDateKey(new Date(year, month, day));
    if (state.pills[key]) taken += 1;
  }

  const open = daysInMonth - taken;
  const rate = daysInMonth === 0 ? 0 : Math.round((taken / daysInMonth) * 100);

  statTaken.textContent = String(taken);
  statOpen.textContent = String(open);
  statRate.textContent = `${rate}%`;

  const { currentStreak, bestStreak } = calculateStreaks();
  statStreak.textContent = String(currentStreak);
  statBestStreak.textContent = String(bestStreak);
}

function calculateStreaks() {
  const keys = Object.keys(state.pills).filter((key) => state.pills[key]).sort();
  if (keys.length === 0) return { currentStreak: 0, bestStreak: 0 };

  let best = 1;
  let current = 1;
  let running = 1;

  for (let i = 1; i < keys.length; i++) {
    const prev = new Date(keys[i - 1]);
    const curr = new Date(keys[i]);
    const diffDays = Math.round((curr - prev) / (24 * 60 * 60 * 1000));
    if (diffDays === 1) {
      running += 1;
    } else {
      running = 1;
    }
    if (running > best) best = running;
  }

  const todayKey = toDateKey(new Date());
  const lastKey = keys[keys.length - 1];
  if (lastKey === todayKey) {
    current = 1;
    for (let i = keys.length - 1; i > 0; i--) {
      const prev = new Date(keys[i - 1]);
      const curr = new Date(keys[i]);
      const diffDays = Math.round((curr - prev) / (24 * 60 * 60 * 1000));
      if (diffDays === 1) {
        current += 1;
      } else {
        break;
      }
    }
  } else {
    current = 0;
  }

  return { currentStreak: current, bestStreak: best };
}

function showReminder() {
  reminderOverlay.classList.remove("hidden");
}

function hideReminder() {
  reminderOverlay.classList.add("hidden");
}

function scheduleReminderCheck() {
  const now = new Date();
  const reminderTime = new Date();
  reminderTime.setHours(8, 55, 0, 0);
  const todayKey = toDateKey(now);
  const alreadyDone = !!state.pills[todayKey];

  if (now >= reminderTime && !alreadyDone) {
    showReminder();
    return;
  }

  const msUntil = reminderTime.getTime() - now.getTime();
  if (msUntil > 0) {
    setTimeout(() => {
      const stillNotDone = !state.pills[toDateKey(new Date())];
      if (stillNotDone) showReminder();
    }, msUntil + 500);
  }
}

prevMonthBtn.addEventListener("click", () => {
  state.viewDate.setMonth(state.viewDate.getMonth() - 1);
  renderCalendar();
});

nextMonthBtn.addEventListener("click", () => {
  state.viewDate.setMonth(state.viewDate.getMonth() + 1);
  renderCalendar();
});

todayBtn.addEventListener("click", () => {
  state.viewDate = new Date();
  renderCalendar();
});

undoBtn.addEventListener("click", undoLast);

reminderMark.addEventListener("click", () => {
  toggleDay(toDateKey(new Date()));
  hideReminder();
});

reminderLater.addEventListener("click", hideReminder);

loadState();
renderCalendar();
scheduleReminderCheck();
