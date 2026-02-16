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

renderCats();
renderList();
