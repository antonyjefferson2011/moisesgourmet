import { db, configured, fs, esc, brl, toast, fbError, DEFAULT_SETTINGS } from "./firebase-init.js";
const { collection, query, where, getDocs, getDoc, doc, addDoc, serverTimestamp } = fs;
const $ = s => document.querySelector(s);

let settings = { ...DEFAULT_SETTINGS };
let products = [];
let cart = [];
try { cart = JSON.parse(localStorage.getItem("mg_cart") || "[]"); } catch { cart = []; }
let activeCat = "Todos";

/* ---------- Configurações do site ---------- */
function applySettings() {
  document.querySelectorAll("[data-t]").forEach(el => { el.textContent = settings[el.dataset.t] || ""; });
  document.title = settings.companyName + " — Bolos de pote e bombons de travessa";
  const img = $("#heroImg"); img.src = settings.heroImage || DEFAULT_SETTINGS.heroImage;
  img.onerror = () => { img.style.display = "none"; };
  const num = String(settings.whatsapp).replace(/\D/g, "");
  $("#waLink").href = "https://wa.me/" + num;
  const show = (id, txt, href) => { const e = $(id); e.hidden = !txt; if (txt) { e.textContent = txt; if (href) e.href = href; } };
  show("#cAddr", settings.address && "📍 " + settings.address);
  show("#cHours", settings.hours && "🕒 " + settings.hours);
  const ig = (settings.instagram || "").replace(/^@/, "").replace(/^https?:\/\/(www\.)?instagram\.com\//, "").replace(/\/$/, "");
  show("#cInsta", ig && "Instagram @" + ig, "https://instagram.com/" + ig);
  updateCart();
}

async function loadSettings() {
  try {
    const s = await getDoc(doc(db, "settings", "site"));
    if (s.exists()) settings = { ...DEFAULT_SETTINGS, ...s.data() };
  } catch (e) { console.warn(e); }
  applySettings();
}

/* ---------- Cardápio ---------- */
const ORDER = ["Bolos de pote", "Bombons de travessa"];
async function loadProducts() {
  const menu = $("#menu");
  if (!configured) { menu.innerHTML = '<p class="state err">Firebase não configurado. Edite o arquivo firebase-config.js (veja as instruções).</p>'; return; }
  try {
    const snap = await getDocs(query(collection(db, "products"), where("active", "==", true)));
    products = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (e) { menu.innerHTML = `<p class="state err">${esc(fbError(e))}</p>`; return; }
  renderMenu(); updateCart();
}

function cats() {
  const set = [...new Set(products.map(p => p.category || "Outros"))];
  return set.sort((a, b) => { const ia = ORDER.indexOf(a), ib = ORDER.indexOf(b); return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib) || a.localeCompare(b); });
}

function renderMenu() {
  const menu = $("#menu"), f = $("#filters");
  if (!products.length) { f.innerHTML = ""; menu.innerHTML = '<p class="state">O cardápio será atualizado em breve.</p>'; return; }
  const list = cats();
  f.innerHTML = ["Todos", ...list].map(c => `<button class="chip${c === activeCat ? " on" : ""}" data-cat="${esc(c)}">${esc(c)}</button>`).join("");
  menu.innerHTML = list.filter(c => activeCat === "Todos" || c === activeCat).map(c => `
    <h3 class="cat">${esc(c)}</h3>
    <div class="grid">${products.filter(p => (p.category || "Outros") === c).sort((a, b) => a.name.localeCompare(b.name)).map(card).join("")}</div>`).join("");
}

const card = p => `
  <article class="card">
    <div class="ph">${p.imageUrl ? `<img src="${esc(p.imageUrl)}" alt="${esc(p.name)}" loading="lazy" onerror="this.remove()">` : ""}<span>🍫</span></div>
    <div class="cb"><h4>${esc(p.name)}</h4><p>${esc(p.description)}</p>
      <div class="cf"><b>${brl(p.price)}</b><button class="btn gold sm" data-add="${esc(p.id)}">Adicionar ao pedido</button></div>
    </div>
  </article>`;

$("#filters").addEventListener("click", e => { const c = e.target.closest("[data-cat]"); if (c) { activeCat = c.dataset.cat; renderMenu(); } });
$("#menu").addEventListener("click", e => {
  const b = e.target.closest("[data-add]"); if (!b) return;
  const it = cart.find(i => i.id === b.dataset.add);
  it ? it.qty++ : cart.push({ id: b.dataset.add, qty: 1 });
  updateCart(); toast("Adicionado ao pedido");
});

/* ---------- Carrinho ---------- */
const lines = () => cart.map(i => ({ ...i, p: products.find(p => p.id === i.id) })).filter(i => i.p);
const isDelivery = () => $("#fDelivery").value === "entrega";
function totals() {
  const sub = lines().reduce((s, i) => s + i.p.price * i.qty, 0);
  const fee = isDelivery() && sub > 0 ? Number(settings.deliveryFee) || 0 : 0;
  return { sub, fee, total: sub + fee };
}
function updateCart() {
  if (products.length) cart = cart.filter(i => products.some(p => p.id === i.id));
  localStorage.setItem("mg_cart", JSON.stringify(cart));
  const L = lines();
  $("#cartCount").textContent = L.reduce((s, i) => s + i.qty, 0);
  $("#cartItems").innerHTML = L.length ? L.map(i => `
    <div class="ci"><div><b>${esc(i.p.name)}</b><small>${brl(i.p.price)} cada</small></div>
      <div class="qty"><button data-dec="${esc(i.id)}" aria-label="Diminuir">−</button><span>${i.qty}</span><button data-inc="${esc(i.id)}" aria-label="Aumentar">+</button></div>
      <b class="lt">${brl(i.p.price * i.qty)}</b><button class="x" data-del="${esc(i.id)}" aria-label="Remover">🗑</button></div>`).join("")
    : '<p class="state">Seu pedido está vazio. Escolha itens no cardápio.</p>';
  const t = totals();
  $("#subtotal").textContent = brl(t.sub); $("#fee").textContent = brl(t.fee); $("#total").textContent = brl(t.total);
  $("#feeRow").hidden = !t.fee;
}
$("#cartItems").addEventListener("click", e => {
  const g = a => e.target.closest(`[data-${a}]`)?.dataset[a];
  const inc = g("inc"), dec = g("dec"), del = g("del");
  if (inc) cart.find(i => i.id === inc).qty++;
  if (dec) { const it = cart.find(i => i.id === dec); it.qty--; if (it.qty < 1) cart = cart.filter(i => i !== it); }
  if (del) cart = cart.filter(i => i.id !== del);
  if (inc || dec || del) updateCart();
});

const open = v => { $("#drawer").classList.toggle("open", v); $("#overlay").classList.toggle("on", v); $("#drawer").setAttribute("aria-hidden", !v); document.body.style.overflow = v ? "hidden" : ""; };
$("#openCart").onclick = () => open(true);
$("#closeCart").onclick = $("#overlay").onclick = () => open(false);
$("#burger").onclick = () => { const n = $("#nav"); const o = n.classList.toggle("open"); $("#burger").setAttribute("aria-expanded", o); };
$("#nav").addEventListener("click", e => { if (e.target.tagName === "A") $("#nav").classList.remove("open"); });
$("#fDelivery").onchange = () => { $("#addrWrap").hidden = !isDelivery(); updateCart(); };
$("#year").textContent = new Date().getFullYear();

/* ---------- Envio do pedido ---------- */
function setMsg(t, ok) { const m = $("#formMsg"); m.textContent = t; m.className = "msg " + (t ? (ok ? "ok" : "bad") : ""); }

$("#orderForm").addEventListener("submit", async e => {
  e.preventDefault(); setMsg("");
  const L = lines();
  const name = $("#fName").value.trim(), phone = $("#fPhone").value.trim(), digits = phone.replace(/\D/g, "");
  const delivery = $("#fDelivery").value, address = $("#fAddress").value.trim(), notes = $("#fNotes").value.trim();
  if (!configured) return setMsg("Firebase não configurado.", false);
  if (!L.length) return setMsg("Adicione ao menos um produto ao pedido.", false);
  if (name.length < 2) return setMsg("Informe seu nome.", false);
  if (digits.length < 10 || digits.length > 13) return setMsg("Informe um telefone válido com DDD.", false);
  if (delivery === "entrega" && address.length < 5) return setMsg("Informe o endereço de entrega.", false);

  const t = totals();
  const items = L.map(i => ({ id: i.id, name: i.p.name, price: i.p.price, qty: i.qty }));
  const btn = $("#submitBtn"); btn.disabled = true; btn.textContent = "Registrando pedido…";
  try {
    await addDoc(collection(db, "orders"), {
      customerName: name, phone, items, subtotal: t.sub, deliveryFee: t.fee, total: t.total,
      notes, delivery, address: delivery === "entrega" ? address : "", status: "novo", createdAt: serverTimestamp()
    });
  } catch (err) {
    btn.disabled = false; btn.textContent = "Enviar pedido pelo WhatsApp";
    return setMsg("Não foi possível registrar o pedido: " + fbError(err), false);
  }
  const msg = [
    `*Novo pedido — ${settings.companyName}*`, "",
    `*Cliente:* ${name}`, `*Telefone:* ${phone}`,
    `*Recebimento:* ${delivery === "entrega" ? "Entrega" : "Retirada"}`,
    ...(delivery === "entrega" ? [`*Endereço:* ${address}`] : []), "",
    "*Itens:*", ...items.map(i => `• ${i.qty}x ${i.name} — ${brl(i.price * i.qty)}`), "",
    `Subtotal: ${brl(t.sub)}`, ...(t.fee ? [`Entrega: ${brl(t.fee)}`] : []), `*Total: ${brl(t.total)}*`,
    ...(notes ? ["", `*Observações:* ${notes}`] : [])
  ].join("\n");
  const url = `https://wa.me/${String(settings.whatsapp).replace(/\D/g, "")}?text=${encodeURIComponent(msg)}`;
  cart = []; updateCart(); e.target.reset(); $("#addrWrap").hidden = true;
  btn.disabled = false; btn.textContent = "Enviar pedido pelo WhatsApp";
  $("#formMsg").className = "msg ok";
  $("#formMsg").innerHTML = `Pedido registrado. Para finalizar, envie a mensagem no WhatsApp: <a href="${esc(url)}" target="_blank" rel="noopener">abrir WhatsApp</a>`;
  if (!window.open(url, "_blank")) location.href = url;
});

/* ---------- Início ---------- */
applySettings();
if (configured) loadSettings();
loadProducts();
