const categories = [
  "Alimentari","Ristoranti","Trasporti","Casa",
  "Bollette","Salute","Svago","Shopping","Viaggi","Altro"
];

let activeCategory = categories[0];
let chartInstance = null;

const $ = (id) => document.getElementById(id);

// =====================
// Storage
// =====================
function load() {
  return JSON.parse(localStorage.getItem("expenses") || "[]");
}

function saveAll(arr) {
  localStorage.setItem("expenses", JSON.stringify(arr));
}

// =====================
// Helpers
// =====================
function fmtEUR(n) {
  return new Intl.NumberFormat("it-IT", { style:"currency", currency:"EUR" }).format(n);
}

function parseAmount(s) {
  if (!s) return null;
  const norm = s.replace(",", ".").replace(/\s/g,"");
  const n = Number(norm);
  return Number.isFinite(n) ? n : null;
}

// =====================
// UI - Categories
// =====================
function renderCats() {
  const grid = $("catGrid");
  grid.innerHTML = "";
  categories.forEach(c => {
    const b = document.createElement("div");
    b.className = "pill" + (c === activeCategory ? " active" : "");
    b.textContent = c;
    b.onclick = () => { activeCategory = c; renderCats(); };
    grid.appendChild(b);
  });
}

// =====================
// Totals
// =====================
function monthTotal(items) {
  const now = new Date();
  return items
    .filter(x => {
      const d = new Date(x.date);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    })
    .reduce((s,x)=> s + x.amount, 0);
}

function getThisMonth(items) {
  const now = new Date();
  return items.filter(x => {
    const d = new Date(x.date);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });
}

// =====================
// Chart
// =====================
function groupByCategory(items) {
  const map = new Map();
  items.forEach(x => map.set(x.category, (map.get(x.category) || 0) + x.amount));
  return { labels:[...map.keys()], values:[...map.values()] };
}

function groupByDay(items) {
  const map = new Map();
  items.forEach(x => {
    const d = new Date(x.date);
    const key = d.toLocaleDateString("it-IT", { day:"2-digit", month:"2-digit" });
    map.set(key, (map.get(key) || 0) + x.amount);
  });

  const labels = [...map.keys()];
  labels.sort((a,b)=>{
    const [da,ma] = a.split("/").map(Number);
    const [db,mb] = b.split("/").map(Number);
    return (ma*100+da) - (mb*100+db);
  });

  return { labels, values: labels.map(l => map.get(l)) };
}

function renderChart() {
  const mode = $("chartMode")?.value || "category";
  const items = getThisMonth(load());
  const data = (mode === "day") ? groupByDay(items) : groupByCategory(items);

  const canvas = document.getElementById("chart");
  if (!canvas) return;

  if (chartInstance) chartInstance.destroy();

  chartInstance = new Chart(canvas, {
    type: mode === "day" ? "line" : "bar",
    data: { labels: data.labels, datasets: [{ data: data.values }] },
    options: {
      responsive: true,
      plugins: { legend: { display: false } },
      scales: {
        y: { ticks: { callback: (v) => "€" + v } }
      }
    }
  });
}

// =====================
// Google Sheets Sync (append-only)
// =====================
function getSyncSettings() {
  return {
    enabled: localStorage.getItem("syncEnabled") === "true",
    url: localStorage.getItem("syncUrl") || "",
    token: localStorage.getItem("syncToken") || ""
  };
}

function setSyncSettings({ enabled, url, token }) {
  if (typeof enabled === "boolean") localStorage.setItem("syncEnabled", enabled ? "true" : "false");
  if (typeof url === "string") localStorage.setItem("syncUrl", url.trim());
  if (typeof token === "string") localStorage.setItem("syncToken", token.trim());
}

async function syncSend(eventName, expenseObj) {
  const s = getSyncSettings();
  if (!s.enabled || !s.url || !s.token) return;

  const payload = {
    token: s.token,
    event: eventName, // "ADD" / "DELETE"
    ...expenseObj
  };

  try {
    // no-cors per evitare problemi CORS con Apps Script
    await fetch(s.url, {
      method: "POST",
      mode: "no-cors",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
  } catch (e) {
    console.error("Sync error", e);
  }
}

function syncInitUI() {
  const s = getSyncSettings();

  const urlEl = $("syncUrl");
  const tokenEl = $("syncToken");
  const enableBtn = $("syncEnable");
  const testBtn = $("syncTest");

  if (!urlEl || !tokenEl || !enableBtn || !testBtn) return;

  urlEl.value = s.url;
  tokenEl.value = s.token;
  enableBtn.textContent = s.enabled ? "Sync: ON" : "Sync: OFF";

  urlEl.addEventListener("change", () => setSyncSettings({ url: urlEl.value }));
  tokenEl.addEventListener("change", () => setSyncSettings({ token: tokenEl.value }));

  enableBtn.addEventListener("click", () => {
    const cur = getSyncSettings();
    const next = !cur.enabled;
    setSyncSettings({ enabled: next });
    enableBtn.textContent = next ? "Sync: ON" : "Sync: OFF";
    if (next) alert("Sync attivato! Ora ogni Salva/Elimina va su Google Sheets.");
  });

  testBtn.addEventListener("click", async () => {
    setSyncSettings({ url: urlEl.value, token: tokenEl.value });
    const testExpense = {
      id: "TEST-" + Date.now(),
      date: new Date().toISOString(),
      amount: 0,
      category: "TEST",
      pay: "N/A",
      note: "Test sync"
    };
    await syncSend("ADD", testExpense);
    alert("Test inviato. Apri il foglio Google e controlla che sia apparsa una riga.");
  });
}

// =====================
// List
// =====================
function renderList() {
  const items = load().sort((a,b)=> new Date(b.date) - new Date(a.date));
  $("monthTotal").textContent = fmtEUR(monthTotal(items));

  const list = $("list");
  list.innerHTML = "";

  if (items.length === 0) {
    list.innerHTML = `<div class="meta" style="padding:12px 0;">Nessuna spesa ancora.</div>`;
    renderChart();
    return;
  }

  items.forEach((x, index) => {
    const d = new Date(x.date);
    const div = document.createElement("div");
    div.className = "item";
    div.innerHTML = `
      <div>
        <div style="font-weight:700">${x.category}</div>
        <div class="meta">
          ${d.toLocaleString("it-IT")} • ${x.pay}${x.note ? " • " + x.note : ""}
        </div>
      </div>
      <div style="text-align:right">
        <div class="amount">${fmtEUR(x.amount)}</div>
        <div class="meta" style="cursor:pointer;color:#ff4d4d" onclick="deleteExpense(${index})">
          Elimina
        </div>
      </div>
    `;
    list.appendChild(div);
  });

  renderChart();
}

// =====================
// Actions
// =====================
function addExpense() {
  const amount = parseAmount($("amount").value);
  if (amount === null) { alert("Importo non valido"); return; }

  const expense = {
    id: Date.now(),
    date: new Date().toISOString(),
    amount,
    category: activeCategory,
    pay: $("pay").value,
    note: $("note").value.trim()
  };

  const arr = load();
  arr.push(expense);
  saveAll(arr);

  // Sync
  syncSend("ADD", expense);

  $("amount").value = "";
  $("note").value = "";

  renderList();
}

function deleteExpense(index) {
  if (!confirm("Eliminare questa spesa?")) return;

  const items = load().sort((a,b)=> new Date(b.date) - new Date(a.date));
  const removed = items[index];

  items.splice(index, 1);
  saveAll(items);

  // Sync
  if (removed) syncSend("DELETE", removed);

  renderList();
}

function exportXlsx() {
  const items = load().map(x => ({
    DateTime: x.date,
    Amount: x.amount,
    Category: x.category,
    Payment: x.pay,
    Note: x.note
  }));

  const ws = XLSX.utils.json_to_sheet(items);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Spese");

  XLSX.writeFile(wb, "spese.xlsx");
}

// =====================
// Wire up
// =====================
$("save").onclick = addExpense;
$("exportXlsx").onclick = exportXlsx;

$("clearAll").onclick = () => {
  if (confirm("Sicuro di cancellare tutto?")) {
    localStorage.removeItem("expenses");
    renderList();
  }
};

$("chartMode")?.addEventListener("change", renderChart);

// Init
renderCats();
renderList();
syncInitUI();
