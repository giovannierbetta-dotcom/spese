const categories = ["Alimentari","Ristoranti","Trasporti","Casa","Bollette","Salute","Svago","Shopping","Viaggi","Altro"];
let activeCategory = categories[0];

const $ = (id) => document.getElementById(id);

function load() {
  return JSON.parse(localStorage.getItem("expenses") || "[]");
}
function saveAll(arr) {
  localStorage.setItem("expenses", JSON.stringify(arr));
}

function fmtEUR(n) {
  return new Intl.NumberFormat("it-IT", { style:"currency", currency:"EUR" }).format(n);
}

function parseAmount(s) {
  if (!s) return null;
  const norm = s.replace(",", ".").replace(/\s/g,"");
  const n = Number(norm);
  return Number.isFinite(n) ? n : null;
}

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

function monthTotal(items) {
  const now = new Date();
  return items
    .filter(x => {
      const d = new Date(x.date);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    })
    .reduce((s,x)=> s + x.amount, 0);
}

function renderList() {
  const items = load().sort((a,b)=> new Date(b.date) - new Date(a.date));
  $("monthTotal").textContent = fmtEUR(monthTotal(items));

  const list = $("list");
  list.innerHTML = "";

  items.forEach((x, index) => {
    const d = new Date(x.date);
    const div = document.createElement("div");
    div.className = "item";
    div.innerHTML = `
      <div>
        <div style="font-weight:700">${x.category}</div>
        <div class="meta">${d.toLocaleString("it-IT")} • ${x.pay}${x.note ? " • " + x.note : ""}</div>
      </div>
      <div style="text-align:right">
        <div class="amount">${fmtEUR(x.amount)}</div>
        <div class="meta" style="cursor:pointer;color:#ff4d4d" onclick="deleteExpense(${index})">Elimina</div>
      </div>
    `;
    list.appendChild(div);
  });
}

function deleteExpense(index) {
  if (!confirm("Eliminare questa spesa?")) return;
  const items = load().sort((a,b)=> new Date(b.date) - new Date(a.date));
  items.splice(index,1);
  saveAll(items);
  renderList();
}

function addExpense() {
  const amount = parseAmount($("amount").value);
  if (amount === null) { alert("Importo non valido"); return; }

  const arr = load();
  arr.push({
    id: Date.now(),
    date: new Date().toISOString(),
    amount,
    category: activeCategory,
    pay: $("pay").value,
    note: $("note").value.trim()
  });

  saveAll(arr);
  $("amount").value = "";
  $("note").value = "";
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

$("save").onclick = addExpense;
$("exportXlsx").onclick = exportXlsx;

let chartInstance = null;

function getThisMonth(items) {
  const now = new Date();
  return items.filter(x => {
    const d = new Date(x.date);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });
}

function groupByCategory(items) {
  const m = new Map();
  items.forEach(x => m.set(x.category, (m.get(x.category) || 0) + x.amount));
  return { labels: [...m.keys()], values: [...m.values()] };
}

function groupByDay(items) {
  const m = new Map();
  items.forEach(x => {
    const d = new Date(x.date);
    const key = d.toLocaleDateString("it-IT", { day:"2-digit", month:"2-digit" });
    m.set(key, (m.get(key) || 0) + x.amount);
  });
  const labels = [...m.keys()];
  // ordina per giorno (approssimazione robusta per mese corrente)
  labels.sort((a,b) => {
    const [da,ma] = a.split("/").map(Number);
    const [db,mb] = b.split("/").map(Number);
    return (ma*100+da) - (mb*100+db);
  });
  return { labels, values: labels.map(k => m.get(k)) };
}

function renderChart() {
  const mode = $("chartMode")?.value || "category";
  const items = getThisMonth(load());
  const data = (mode === "day") ? groupByDay(items) : groupByCategory(items);

  const ctx = document.getElementById("chart");
  if (!ctx) return;

  if (chartInstance) chartInstance.destroy();

  chartInstance = new Chart(ctx, {
    type: mode === "day" ? "line" : "bar",
    data: {
      labels: data.labels,
      datasets: [{
        label: mode === "day" ? "Spesa per giorno" : "Spesa per categoria",
        data: data.values
      }]
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false } },
      scales: { y: { ticks: { callback: (v) => "€" + v } } }
    }
  });
}



renderCats();
renderList();

