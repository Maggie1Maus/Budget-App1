const STORAGE_KEY = "budget-helper-monthly-v2";

/* ========= Utils ========= */
function euro(v) {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
  }).format(v);
}

function uid() {
  return crypto.randomUUID?.() ?? String(Date.now() + Math.random());
}

function monthKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(key) {
  const [y, m] = key.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("de-DE", {
    month: "long",
    year: "numeric",
  });
}

/* ========= State ========= */
function loadState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw) {
    try {
      return JSON.parse(raw);
    } catch {}
  }

  const current = monthKey();
  return {
    activeMonth: current,
    activePotId: "potA",
    months: {
      [current]: {
        pots: {
          potA: { name: "", startingBudget: 0 },
          potB: { name: "", startingBudget: 0 },
        },
        transactions: [],
      },
    },
  };
}

let state = loadState();

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function ensureMonth(key) {
  if (!state.months[key]) {
    state.months[key] = {
      pots: {
        potA: { name: "", startingBudget: 0 },
        potB: { name: "", startingBudget: 0 },
      },
      transactions: [],
    };
  }
}

/* ========= DOM ========= */
const $ = (id) => document.getElementById(id);

const btnPotA = $("btnPotA");
const btnPotB = $("btnPotB");
const monthSelect = $("monthSelect");
const newMonthBtn = $("newMonthBtn");
const exportBtn = $("exportBtn");
const importFile = $("importFile");

const potNameTitle = $("potNameTitle");
const potNameInput = $("potNameInput");
const startingBudgetInput = $("startingBudgetInput");

const remainingEl = $("remaining");
const spentEl = $("spent");

const amountInput = $("amountInput");
const noteInput = $("noteInput");
const addExpenseBtn = $("addExpense");
const resetPotBtn = $("resetPot");

const txList = $("txList");
const emptyState = $("emptyState");
const monthSummary = $("monthSummary");

/* ========= Logic ========= */
function currentMonth() {
  ensureMonth(state.activeMonth);
  return state.months[state.activeMonth];
}

function activePot() {
  return currentMonth().pots[state.activePotId];
}

function transactions() {
  return currentMonth().transactions.filter(
    (t) => t.potId === state.activePotId
  );
}

function totals(potId) {
  const month = currentMonth();
  const pot = month.pots[potId];
  const spent = month.transactions
    .filter((t) => t.potId === potId)
    .reduce((s, t) => s + t.amount, 0);

  return {
    spent,
    remaining: pot.startingBudget - spent,
  };
}

/* ========= Render ========= */
function render() {
  ensureMonth(state.activeMonth);
  saveState();

  /* Month select */
  monthSelect.innerHTML = "";
  Object.keys(state.months)
    .sort()
    .forEach((k) => {
      const o = document.createElement("option");
      o.value = k;
      o.textContent = monthLabel(k);
      monthSelect.appendChild(o);
    });
  monthSelect.value = state.activeMonth;

  /* Switch */
  btnPotA.classList.toggle("active", state.activePotId === "potA");
  btnPotB.classList.toggle("active", state.activePotId === "potB");

  btnPotA.textContent = currentMonth().pots.potA.name || "Topf A";
  btnPotB.textContent = currentMonth().pots.potB.name || "Topf B";

  /* Budget */
  const pot = activePot();
  const t = totals(state.activePotId);

  potNameTitle.textContent = pot.name || "—";
  potNameInput.value = pot.name;
  startingBudgetInput.value = pot.startingBudget || "";

  remainingEl.textContent = euro(t.remaining);
  remainingEl.classList.toggle("danger", t.remaining < 0);
  spentEl.textContent = `Ausgegeben: ${euro(t.spent)}`;

  /* Transactions */
  txList.innerHTML = "";
  const tx = transactions();
  emptyState.style.display = tx.length ? "none" : "block";

  tx.forEach((e) => {
    const li = document.createElement("li");
    li.className = "item";

    li.innerHTML = `
      <div>
        <div class="note">${e.note}</div>
        <div class="meta">${new Date(e.date).toLocaleString("de-DE")}</div>
      </div>
      <div style="display:flex;gap:10px;align-items:center;">
        <strong>${euro(e.amount)}</strong>
        <button class="link">löschen</button>
      </div>
    `;

    li.querySelector("button").onclick = () => {
      currentMonth().transactions = currentMonth().transactions.filter(
        (x) => x.id !== e.id
      );
      render();
    };

    txList.appendChild(li);
  });

  /* Summary */
  monthSummary.innerHTML = "";
  ["potA", "potB"].forEach((pid) => {
    const s = totals(pid);
    const p = currentMonth().pots[pid];
    const d = document.createElement("div");
    d.className = "summary-card";
    d.innerHTML = `
      <div>
        <strong>${p.name || pid}</strong>
        <div class="muted tiny">Start: ${euro(p.startingBudget)}</div>
      </div>
      <strong style="color:${s.remaining < 0 ? "var(--danger)" : "inherit"}">
        ${euro(s.remaining)}
      </strong>
    `;
    monthSummary.appendChild(d);
  });
}

/* ========= Events ========= */
btnPotA.onclick = () => {
  state.activePotId = "potA";
  render();
};
btnPotB.onclick = () => {
  state.activePotId = "potB";
  render();
};

monthSelect.onchange = (e) => {
  state.activeMonth = e.target.value;
  render();
};

newMonthBtn.onclick = () => {
  const [y, m] = state.activeMonth.split("-").map(Number);
  const next = new Date(y, m, 1);
  state.activeM
}