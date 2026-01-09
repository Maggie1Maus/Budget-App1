const STORAGE_KEY = "budget-helper-monthly-v1";

function euro(value) {
  return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(value);
}

function uid() {
  return (crypto.randomUUID && crypto.randomUUID()) || String(Date.now()) + Math.random().toString(16).slice(2);
}

function monthKey(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`; // e.g. 2026-01
}

function monthLabel(key) {
  const [y, m] = key.split("-").map(Number);
  const d = new Date(y, m - 1, 1);
  return d.toLocaleDateString("de-DE", { month: "long", year: "numeric" });
}

function cloneMonthTemplate(fromMonthData) {
  return {
    pots: {
      potA: { ...fromMonthData.pots.potA },
      potB: { ...fromMonthData.pots.potB },
    },
    transactions: []
  };
}

function loadState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw) {
    try { return JSON.parse(raw); } catch {}
  }
  const current = monthKey();
  return {
    activePotId: "potA",
    activeMonth: current,
    months: {
      [current]: {
        pots: {
          potA: { name: "Topf A", startingBudget: 300 },
          potB: { name: "Topf B", startingBudget: 200 },
        },
        transactions: []
      }
    }
  };
}

let state = loadState();

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function ensureMonthExists(key) {
  if (!state.months[key]) {
    // Copy last known month settings if possible
    const existingKeys = Object.keys(state.months).sort();
    const lastKey = existingKeys[existingKeys.length - 1];
    const base = state.months[lastKey] || {
      pots: { potA: { name: "Topf A", startingBudget: 0 }, potB: { name: "Topf B", startingBudget: 0 } },
      transactions: []
    };
    state.months[key] = cloneMonthTemplate(base);
    saveState();
  }
}

function getMonthData() {
  ensureMonthExists(state.activeMonth);
  return state.months[state.activeMonth];
}

function getActivePot() {
  const month = getMonthData();
  return month.pots[state.activePotId];
}

function getActiveTx() {
  const month = getMonthData();
  return month.transactions
    .filter(t => t.potId === state.activePotId)
    .sort((a, b) => b.dateISO.localeCompare(a.dateISO));
}

// ===== Elements =====
const btnPotA = document.getElementById("btnPotA");
const btnPotB = document.getElementById("btnPotB");

const monthSelect = document.getElementById("monthSelect");
const newMonthBtn = document.getElementById("newMonthBtn");
const exportBtn = document.getElementById("exportBtn");
const importFile = document.getElementById("importFile");

const potNameTitle = document.getElementById("potNameTitle");
const remainingEl = document.getElementById("remaining");
const spentEl = document.getElementById("spent");

const potNameInput = document.getElementById("potNameInput");
const startingBudgetInput = document.getElementById("startingBudgetInput");

const amountInput = document.getElementById("amountInput");
const noteInput = document.getElementById("noteInput");
const addExpenseBtn = document.getElementById("addExpense");

const resetPotBtn = document.getElementById("resetPot");

const txList = document.getElementById("txList");
const emptyState = document.getElementById("emptyState");
const monthSummary = document.getElementById("monthSummary");

// ===== Render helpers =====
function computePotTotals(monthData, potId) {
  const pot = monthData.pots[potId];
  const spent = monthData.transactions
    .filter(t => t.potId === potId)
    .reduce((sum, t) => sum + Number(t.amount), 0);
  const remaining = Number(pot.startingBudget) - spent;
  return { spent, remaining, startingBudget: Number(pot.startingBudget) };
}

function rebuildMonthSelect() {
  const keys = Object.keys(state.months).sort(); // ascending
  // Always ensure current month exists
  const current = monthKey();
  if (!state.months[current]) {
    const lastKey = keys[keys.length - 1] || current;
    ensureMonthExists(current);
  }

  const finalKeys = Object.keys(state.months).sort();

  monthSelect.innerHTML = "";
  for (const k of finalKeys) {
    const opt = document.createElement("option");
    opt.value = k;
    opt.textContent = monthLabel(k);
    monthSelect.appendChild(opt);
  }
  monthSelect.value = state.activeMonth;
}

function renderTransactions(tx) {
  txList.innerHTML = "";
  emptyState.style.display = tx.length ? "none" : "block";

  for (const t of tx) {
    const li = document.createElement("li");
    li.className = "item";

    const left = document.createElement("div");

    const note = document.createElement("div");
    note.className = "note";
    note.textContent = t.note;

    const meta = document.createElement("div");
    meta.className = "meta";
    meta.textContent = new Date(t.dateISO).toLocaleString("de-DE");

    left.appendChild(note);
    left.appendChild(meta);

    const right = document.createElement("div");
    right.style.display = "flex";
    right.style.gap = "10px";
    right.style.alignItems = "center";

    const amt = document.createElement("div");
    amt.style.fontWeight = "950";
    amt.textContent = euro(Number(t.amount));

    const del = document.createElement("button");
    del.className = "link";
    del.type = "button";
    del.textContent = "löschen";
    del.addEventListener("click", () => {
      const month = getMonthData();
      month.transactions = month.transactions.filter(x => x.id !== t.id);
      saveState();
      render();
    });

    right.appendChild(amt);
    right.appendChild(del);

    li.appendChild(left);
    li.appendChild(right);
    txList.appendChild(li);
  }
}

function renderSummary() {
  const month = getMonthData();
  monthSummary.innerHTML = "";

  for (const potId of ["potA", "potB"]) {
    const pot = month.pots[potId];
    const totals = computePotTotals(month, potId);

    const div = document.createElement("div");
    div.className = "summary-card";

    const left = document.createElement("div");
    left.innerHTML = `
      <div style="font-weight:900;">${pot.name} <span class="badge">${potId}</span></div>
      <div class="muted tiny">Start: ${euro(totals.startingBudget)} · Ausgegeben: ${euro(totals.spent)}</div>
    `;

    const right = document.createElement("div");
    right.style.textAlign = "right";
    right.style.fontWeight = "950";
    right.style.color = totals.remaining < 0 ? "var(--danger)" : "inherit";
    right.textContent = euro(totals.remaining);

    div.appendChild(left);
    div.appendChild(right);
    monthSummary.appendChild(div);
  }
}

function render() {
  ensureMonthExists(state.activeMonth);
  rebuildMonthSelect();

  const month = getMonthData();
  const pot = getActivePot();
  const tx = getActiveTx();

  // Switch buttons
  btnPotA.classList.toggle("active", state.activePotId === "potA");
  btnPotB.classList.toggle("active", state.activePotId === "potB");
  btnPotA.textContent = month.pots.potA.name;
  btnPotB.textContent = month.pots.potB.name;

  // Budget calc
  const totals = computePotTotals(month, state.activePotId);

  potNameTitle.textContent = pot.name;
  potNameInput.value = pot.name;
  startingBudgetInput.value = String(pot.startingBudget);

  remainingEl.textContent = euro(totals.remaining);
  remainingEl.classList.toggle("danger", totals.remaining < 0);
  spentEl.textContent = `Ausgegeben: ${euro(totals.spent)}`;

  renderTransactions(tx);
  renderSummary();
}

// ===== Events =====
btnPotA.addEventListener("click", () => {
  state.activePotId = "potA";
  saveState();
  render();
});

btnPotB.addEventListener("click", () => {
  state.activePotId = "potB";
  saveState();
  render();
});

monthSelect.addEventListener("change", (e) => {
  state.activeMonth = e.target.value;
  ensureMonthExists(state.activeMonth);
  saveState();
  render();
});

newMonthBtn.addEventListener("click", () => {
  // create next month based on currently active month
  const [y, m] = state.activeMonth.split("-").map(Number);
  const next = new Date(y, (m - 1) + 1, 1);
  const nextKey = monthKey(next);

  if (state.months[nextKey]) {
    state.activeMonth = nextKey;
    saveState();
    render();
    return;
  }

  const currentData = getMonthData();
  state.months[nextKey] = cloneMonthTemplate(currentData);
  state.activeMonth = nextKey;
  saveState();
  render();
});

potNameInput.addEventListener("input", (e) => {
  const month = getMonthData();
  month.pots[state.activePotId].name = e.target.value;
  saveState();
  render();
});

startingBudgetInput.addEventListener("input", (e) => {
  const month = getMonthData();
  const v = Number(e.target.value);
  month.pots[state.activePotId].startingBudget = Number.isFinite(v) ? v : 0;
  saveState();
  render();
});

addExpenseBtn.addEventListener("click", () => {
  const raw = amountInput.value.trim().replace(",", ".");
  const amount = Number(raw);
  const note = noteInput.value.trim() || "Ausgabe";

  if (!Number.isFinite(amount) || amount <= 0) {
    alert("Bitte einen Betrag > 0 eingeben.");
    return;
  }

  const month = getMonthData();
  month.transactions.unshift({
    id: uid(),
    potId: state.activePotId,
    amount,
    note,
    dateISO: new Date().toISOString()
  });

  amountInput.value = "";
  noteInput.value = "";
  saveState();
  render();
});

resetPotBtn.addEventListener("click", () => {
  const month = getMonthData();
  const pot = month.pots[state.activePotId];
  if (!confirm(`Wirklich alle Ausgaben in "${pot.name}" für ${monthLabel(state.activeMonth)} löschen?`)) return;

  month.transactions = month.transactions.filter(t => t.potId !== state.activePotId);
  saveState();
  render();
});

// ===== Export / Import =====
exportBtn.addEventListener("click", () => {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `budget-backup-${monthKey()}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
});

importFile.addEventListener("change", async (e) => {
  const file = e.target.files?.[0];
  if (!file) return;

  try {
    const text = await file.text();
    const imported = JSON.parse(text);

    // Basic validation
    if (!imported || typeof imported !== "object" || !imported.months) {
      alert("Import-Datei sieht nicht wie ein gültiges Backup aus.");
      return;
    }

    state = imported;
    saveState();
    render();
    alert("✅ Import erfolgreich!");
  } catch (err) {
    alert("❌ Import fehlgeschlagen. Datei ist vermutlich kaputt oder kein JSON.");
  } finally {
    importFile.value = "";
  }
});

// Initial
ensureMonthExists(state.activeMonth);
saveState();
render();
