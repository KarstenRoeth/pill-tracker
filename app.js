// ─── State ───────────────────────────────────────────────────────────────────
const storageKey = "pillTrackerData_v2";

// dosePattern: array of 4 booleans [morgens, mittags, abends, nachts]
const state = {
  viewWeekStart: getMonday(new Date()),
  pills: {},          // key: "YYYY-MM-DD-N" (N = dose index 0..3), value: true
  dosePattern: [true, false, false, false],
  undoStack: []
};

const SLOT_NAMES = ["Morgens", "Mittags", "Abends", "Nachts"];
const DAY_NAMES  = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];

// ─── DOM refs ────────────────────────────────────────────────────────────────
const weekGrid        = document.getElementById("weekGrid");
const weekLabel       = document.getElementById("weekLabel");
const prevWeekBtn     = document.getElementById("prevWeek");
const nextWeekBtn     = document.getElementById("nextWeek");
const todayBtn        = document.getElementById("todayBtn");
const undoBtn         = document.getElementById("undoBtn");
const settingsBtn     = document.getElementById("settingsBtn");
const settingsOverlay = document.getElementById("settingsOverlay");
const closeSettings   = document.getElementById("closeSettings");
const slotBtns        = document.querySelectorAll(".slot-btn");
const statusText      = document.getElementById("statusText");
const statTaken       = document.getElementById("statTaken");
const statOpen        = document.getElementById("statOpen");
const statRate        = document.getElementById("statRate");
const statStreak      = document.getElementById("statStreak");
const statBestStreak  = document.getElementById("statBestStreak");

// ─── Helpers ─────────────────────────────────────────────────────────────────
function getMonday(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay();
  const diff = (day === 0) ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d;
}

function toDateKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function toPillKey(date, doseIndex) {
  return `${toDateKey(date)}-${doseIndex}`;
}

function isSameDay(a, b) {
  return a.getFullYear() === b.getFullYear() &&
         a.getMonth()    === b.getMonth()    &&
         a.getDate()     === b.getDate();
}

function getKW(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

function formatShortDate(date) {
  return date.toLocaleDateString("de-DE", { day: "numeric", month: "short" });
}

// ─── Persistence ─────────────────────────────────────────────────────────────
function loadState() {
  const raw = localStorage.getItem(storageKey);
  if (!raw) return;
  try {
    const parsed = JSON.parse(raw);
    state.pills       = parsed.pills       || {};
    state.dosePattern = parsed.dosePattern || [true, false, false, false];
    state.undoStack   = parsed.undoStack   || [];
  } catch (e) {
    console.warn("Could not parse stored data", e);
  }
}

function saveState() {
  localStorage.setItem(storageKey, JSON.stringify({
    pills:       state.pills,
    dosePattern: state.dosePattern,
    undoStack:   state.undoStack.slice(-50)
  }));
}

// ─── Render week ─────────────────────────────────────────────────────────────
function renderWeek() {
  const monday = state.viewWeekStart;
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  const today  = new Date();
  today.setHours(0, 0, 0, 0);

  const kw = getKW(monday);
  weekLabel.textContent = `KW ${kw}  ·  ${formatShortDate(monday)} – ${formatShortDate(sunday)}`;

  weekGrid.innerHTML = "";

  for (let i = 0; i < 7; i++) {
    const date    = new Date(monday);
    date.setDate(monday.getDate() + i);
    const isToday  = isSameDay(date, today);
    const isFuture = date > today;

    const row = document.createElement("div");
    row.className = `day-row${isToday ? " today" : ""}`;

    const label = document.createElement("div");
    label.className = "day-label" + (isToday ? " today-label" : "");
    label.textContent = DAY_NAMES[i];
    row.appendChild(label);

    const cells = document.createElement("div");
    cells.className = "dose-cells";

    for (let d = 0; d < 4; d++) {
      const cell    = document.createElement("button");
      cell.type     = "button";
      const pillKey = toPillKey(date, d);
      const taken   = !!state.pills[pillKey];
      const active  = state.dosePattern[d];

      if (!active) {
        cell.className = "dose-cell inactive";
        cell.disabled  = true;
      } else if (taken) {
        cell.className = "dose-cell done";
      } else if (isFuture) {
        cell.className = "dose-cell future";
      } else {
        cell.className = "dose-cell missed";
      }

      cell.setAttribute("aria-label", `${DAY_NAMES[i]}, ${SLOT_NAMES[d]}`);

      if (active) {
        cell.addEventListener("click", () => toggleDose(pillKey));
      }

      cells.appendChild(cell);
    }

    row.appendChild(cells);
    weekGrid.appendChild(row);
  }

  updateUndoButton();
  updateStats();
  updateStatus();
}

// ─── Toggle ───────────────────────────────────────────────────────────────────
function toggleDose(pillKey) {
  const previous = !!state.pills[pillKey];
  state.undoStack.push({ pillKey, previous });
  if (previous) {
    delete state.pills[pillKey];
  } else {
    state.pills[pillKey] = true;
  }
  saveState();
  renderWeek();
}

// ─── Undo ─────────────────────────────────────────────────────────────────────
function undoLast() {
  const last = state.undoStack.pop();
  if (!last) return;
  if (last.previous) {
    state.pills[last.pillKey] = true;
  } else {
    delete state.pills[last.pillKey];
  }
  saveState();
  renderWeek();
}

function updateUndoButton() {
  undoBtn.disabled = state.undoStack.length === 0;
}

// ─── Status ───────────────────────────────────────────────────────────────────
function updateStatus() {
  const todayKey   = toDateKey(new Date());
  const totalToday = state.dosePattern.filter(Boolean).length;
  let takenToday   = 0;
  for (let d = 0; d < 4; d++) {
    if (state.dosePattern[d] && state.pills[`${todayKey}-${d}`]) takenToday++;
  }
  if (totalToday === 0) {
    statusText.textContent = "Keine Einnahme konfiguriert.";
  } else if (takenToday === totalToday) {
    statusText.textContent = "Heute vollständig eingetragen ✓";
  } else if (takenToday > 0) {
    statusText.textContent = `Heute ${takenToday} von ${totalToday} eingetragen.`;
  } else {
    statusText.textContent = "Lokale Speicherung aktiv.";
  }
}

// ─── Stats ────────────────────────────────────────────────────────────────────
function updateStats() {
  const today       = new Date();
  const year        = today.getFullYear();
  const month       = today.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  let taken = 0;
  let total = 0;

  for (let day = 1; day <= daysInMonth; day++) {
    const d = new Date(year, month, day);
    if (d > today) break;
    for (let i = 0; i < 4; i++) {
      if (!state.dosePattern[i]) continue;
      total++;
      if (state.pills[toPillKey(d, i)]) taken++;
    }
  }

  const open = total - taken;
  const rate = total === 0 ? 0 : Math.round((taken / total) * 100);

  statTaken.textContent    = String(taken);
  statOpen.textContent     = String(open);
  statRate.textContent     = `${rate}%`;

  const { currentStreak, bestStreak } = calculateStreaks();
  statStreak.textContent     = String(currentStreak);
  statBestStreak.textContent = String(bestStreak);
}

// Streak = consecutive days where ALL active doses were taken
function calculateStreaks() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  function isDayComplete(date) {
    if (!state.dosePattern.some(Boolean)) return false;
    for (let i = 0; i < 4; i++) {
      if (state.dosePattern[i] && !state.pills[toPillKey(date, i)]) return false;
    }
    return true;
  }

  const allKeys = Object.keys(state.pills).filter(k => state.pills[k]);
  if (allKeys.length === 0) return { currentStreak: 0, bestStreak: 0 };

  const dates = allKeys.map(k => {
    const parts = k.split("-");
    return new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
  });
  const minDate = new Date(Math.min(...dates.map(d => d.getTime())));
  const maxDate = new Date(Math.min(Math.max(...dates.map(d => d.getTime())), today.getTime()));

  let best    = 0;
  let running = 0;
  const cur   = new Date(minDate);

  while (cur <= maxDate) {
    if (isDayComplete(cur)) {
      running++;
      if (running > best) best = running;
    } else {
      running = 0;
    }
    cur.setDate(cur.getDate() + 1);
  }

  let current = 0;
  const check = new Date(today);
  while (isDayComplete(check)) {
    current++;
    check.setDate(check.getDate() - 1);
  }

  return { currentStreak: current, bestStreak: best };
}

// ─── Settings ────────────────────────────────────────────────────────────────
function openSettings() {
  settingsOverlay.classList.remove("hidden");
  syncSlotButtons();
}

function syncSlotButtons() {
  slotBtns.forEach(btn => {
    const idx = parseInt(btn.dataset.slot);
    btn.classList.toggle("active", state.dosePattern[idx]);
  });
}

function closeSettingsPanel() {
  settingsOverlay.classList.add("hidden");
}

slotBtns.forEach(btn => {
  btn.addEventListener("click", () => {
    const idx = parseInt(btn.dataset.slot);
    state.dosePattern[idx] = !state.dosePattern[idx];
    syncSlotButtons();
    saveState();
    renderWeek();
  });
});

// ─── Event listeners ─────────────────────────────────────────────────────────
prevWeekBtn.addEventListener("click", () => {
  state.viewWeekStart.setDate(state.viewWeekStart.getDate() - 7);
  renderWeek();
});

nextWeekBtn.addEventListener("click", () => {
  state.viewWeekStart.setDate(state.viewWeekStart.getDate() + 7);
  renderWeek();
});

todayBtn.addEventListener("click", () => {
  state.viewWeekStart = getMonday(new Date());
  renderWeek();
});

undoBtn.addEventListener("click", undoLast);
settingsBtn.addEventListener("click", openSettings);
closeSettings.addEventListener("click", closeSettingsPanel);
settingsOverlay.addEventListener("click", e => {
  if (e.target === settingsOverlay) closeSettingsPanel();
});

// ─── Init ─────────────────────────────────────────────────────────────────────
loadState();
renderWeek();
