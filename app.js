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
  if (items.length === 0) {
    list.innerHTML = `<div class="meta" style="padding:12px 0;">Nessuna spesa ancora.</div>`;
    return;
  }

  items.forEach((x, idx) => {
    const d = new Date(x.date);
    const line = document.createElement("div");
    line.className = "item";
    line.innerHTML = `
      <div>
        <div style="font-weight:700">${x.category}</div>
        <div class="meta">${d.toLocaleString("it-IT")} • ${x.pay}${x.note ? " • " + x.note : ""}</div>
      </div>
      <div style="text-align:right">
        <div class="amount">${fmtEUR(x.amount)}</div>
        <div class="meta" style="cursor:pointer;text-decoration:underline" data-del="${idx}">Elimina</div>
      </div>
    `;
    list.appendChild(line);
  });

  // delete handler
  list.querySelectorAll("[data-del]").forEach(el => {
    el.onclick = () => {
      const i = Number(el.getAttribute("data-del"));
      const arr = load().sort((a,b)=> new Date(b.date) - new Date(a.date));
      arr.splice(i,1);
      // salva in ordine "naturale" (append style)
      saveAll(arr.reverse()); // piccolo trick per non perdere append feel
      renderList();
    };
  });
}

function addExpense() {
  const amount = parseAmount($("amount").value);
  if (amount === null) { alert("Importo non valido"); return; }

  const arr = load();
  arr.push({
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

  const now = new Date();
  const name = `spese-${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}-${String(now.getDate()).padStart(2,"0")}.xlsx`;
  XLSX.writeFile(wb, name);
}

$("save").onclick = addExpense;
$("exportXlsx").onclick = exportXlsx;
$("clearAll").onclick = () => {
  if (confirm("Sicuro di cancellare tutto?")) {
    localStorage.removeItem("expenses");
    renderList();
  }
};

renderCats();
renderList();
