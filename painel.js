import { db, auth, configured, fs, au, esc, brl, toast, fbError, DEFAULT_SETTINGS, uploadImage } from "./firebase-init.js";
const { collection, doc, getDoc, setDoc, addDoc, updateDoc, deleteDoc, onSnapshot, query, orderBy, serverTimestamp } = fs;
const $ = s => document.querySelector(s);
const ST = { novo: "Novo", andamento: "Em andamento", concluido: "Concluído", cancelado: "Cancelado" };
let products = [], orders = [], unsubs = [], editId = null, settings = { ...DEFAULT_SETTINGS };

/* ---------- Acesso direto (sem login) ---------- */
$("#login").hidden = true; $("#logout").hidden = true;
if (!configured) { $("#app").hidden = false; document.querySelector(".panel").innerHTML = '<p class="state err">Firebase não configurado. Edite firebase-config.js.</p>'; }
else { $("#app").hidden = false; start(); }

/* ---------- Abas ---------- */
$("#tabs").addEventListener("click", e => {
  const b = e.target.closest("[data-tab]"); if (!b) return;
  document.querySelectorAll("#tabs button").forEach(x => x.classList.toggle("on", x === b));
  ["dash", "prod", "ped", "cfg"].forEach(t => $("#tab-" + t).hidden = t !== b.dataset.tab);
});

/* ---------- Dados em tempo real ---------- */
const onErr = e => toast(fbError(e), "bad");
function start() {
  unsubs.push(onSnapshot(collection(db, "products"), s => { products = s.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => a.name.localeCompare(b.name)); renderProducts(); renderDash(); }, onErr));
  unsubs.push(onSnapshot(query(collection(db, "orders"), orderBy("createdAt", "desc")), s => { orders = s.docs.map(d => ({ id: d.id, ...d.data() })); renderOrders(); renderDash(); }, onErr));
  getDoc(doc(db, "settings", "site")).then(s => { if (s.exists()) settings = { ...DEFAULT_SETTINGS, ...s.data() }; fillCfg(); }).catch(onErr);
}
const dt = o => o.createdAt?.toDate ? o.createdAt.toDate() : new Date();
const fmtDt = d => d.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });

/* ---------- Dashboard ---------- */
function renderDash() {
  const valid = orders.filter(o => o.status !== "cancelado");
  const rev = valid.reduce((s, o) => s + (o.total || 0), 0);
  $("#stats").innerHTML = [
    ["Produtos cadastrados", products.length], ["Produtos ativos", products.filter(p => p.active).length],
    ["Pedidos registrados", orders.length], ["Pedidos novos", orders.filter(o => o.status === "novo").length],
    ["Valor em pedidos (sem cancelados)", brl(rev)]
  ].map(([l, v]) => `<div class="stat"><span>${l}</span><b>${v}</b></div>`).join("");

  const days = [...Array(7)].map((_, i) => { const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - (6 - i)); return d; });
  const cnt = days.map(d => orders.filter(o => dt(o).toDateString() === d.toDateString()).length);
  const mx = Math.max(1, ...cnt);
  $("#chart7").innerHTML = days.map((d, i) => `<div class="bcol"><span>${cnt[i]}</span><div class="bar-v" style="height:${cnt[i] / mx * 100}%"></div><small>${d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}</small></div>`).join("");

  const mst = Math.max(1, ...Object.keys(ST).map(k => orders.filter(o => o.status === k).length));
  $("#chartSt").innerHTML = Object.keys(ST).map(k => { const n = orders.filter(o => o.status === k).length; return `<div class="hrow"><span>${ST[k]}</span><div><i class="s-${k}" style="width:${n / mst * 100}%"></i></div><b>${n}</b></div>`; }).join("");

  $("#recent").innerHTML = orders.slice(0, 5).map(o => `<div class="li"><div><b>${esc(o.customerName)}</b><small>${fmtDt(dt(o))}</small></div><div><b>${brl(o.total)}</b> <span class="tag s-${o.status}">${ST[o.status] || o.status}</span></div></div>`).join("") || '<p class="state">Nenhum pedido ainda.</p>';

  const tally = {};
  valid.forEach(o => (o.items || []).forEach(i => tally[i.name] = (tally[i.name] || 0) + i.qty));
  const top = Object.entries(tally).sort((a, b) => b[1] - a[1]).slice(0, 5);
  $("#top").innerHTML = top.map(([n, q]) => `<div class="li"><b>${esc(n)}</b><span>${q} un.</span></div>`).join("") || '<p class="state">Sem dados suficientes.</p>';
}

/* ---------- Produtos ---------- */
function renderProducts() {
  $("#prodList").innerHTML = products.length ? products.map(p => `
    <div class="prow ${p.active ? "" : "off"}">
      <div class="thumb">${p.imageUrl ? `<img src="${esc(p.imageUrl)}" alt="" onerror="this.remove()">` : "🍫"}</div>
      <div class="pinfo"><b>${esc(p.name)}</b><small>${esc(p.category)} · ${brl(p.price)} · ${p.active ? "Ativo" : "Inativo"}</small><p>${esc(p.description)}</p></div>
      <div class="acts"><button class="btn out sm" data-tg="${p.id}">${p.active ? "Desativar" : "Ativar"}</button><button class="btn out sm" data-ed="${p.id}">Editar</button><button class="btn danger sm" data-rm="${p.id}">Excluir</button></div>
    </div>`).join("") : '<p class="state">Nenhum produto cadastrado. Clique em "Novo produto".</p>';
}
$("#prodList").addEventListener("click", async e => {
  const g = a => e.target.closest(`[data-${a}]`)?.dataset[a];
  const tg = g("tg"), ed = g("ed"), rm = g("rm");
  try {
    if (tg) { const p = products.find(x => x.id === tg); await updateDoc(doc(db, "products", tg), { active: !p.active }); toast(p.active ? "Produto desativado" : "Produto ativado"); }
    if (ed) openDlg(products.find(x => x.id === ed));
    if (rm && confirm("Excluir este produto definitivamente?")) { await deleteDoc(doc(db, "products", rm)); toast("Produto excluído"); }
  } catch (err) { toast(fbError(err), "bad"); }
});
const dlg = $("#prodDlg"), pf = $("#prodForm");
function openDlg(p) {
  editId = p?.id || null; pf.reset(); $("#pMsg").textContent = "";
  $("#dlgTitle").textContent = p ? "Editar produto" : "Novo produto";
  if (p) { pf.name.value = p.name; pf.description.value = p.description || ""; pf.price.value = p.price; pf.category.value = p.category; pf.imageUrl.value = p.imageUrl || ""; pf.active.checked = !!p.active; }
  setPv(pf, "imageUrl", p?.imageUrl); $("#prodForm .upst").textContent = ""; dlg.showModal();
}
$("#newProd").onclick = () => openDlg();
$("#pCancel").onclick = () => dlg.close();
pf.addEventListener("submit", async e => {
  e.preventDefault();
  const m = $("#pMsg"), price = parseFloat(pf.price.value), name = pf.name.value.trim(), category = pf.category.value.trim(), img = pf.imageUrl.value.trim();
  m.className = "msg bad";
  if (name.length < 2) return m.textContent = "Informe o nome.";
  if (!(price > 0)) return m.textContent = "Informe um preço válido.";
  if (!category) return m.textContent = "Informe a categoria.";
  if (img && !/^https?:\/\//i.test(img)) return m.textContent = "A URL da imagem deve começar com http:// ou https://";
  const data = { name, description: pf.description.value.trim(), price, category, imageUrl: img, active: pf.active.checked };
  $("#pBtn").disabled = true; $("#pBtn").textContent = "Salvando…";
  try {
    if (editId) await updateDoc(doc(db, "products", editId), data);
    else await addDoc(collection(db, "products"), { ...data, createdAt: serverTimestamp() });
    dlg.close(); toast("Produto salvo");
  } catch (err) { m.textContent = fbError(err); }
  $("#pBtn").disabled = false; $("#pBtn").textContent = "Salvar";
});

/* ---------- Pedidos ---------- */
const waNum = p => { let d = String(p).replace(/\D/g, ""); if (d.length <= 11) d = "55" + d; return d; };
function renderOrders() {
  const f = $("#stFilter").value, list = orders.filter(o => !f || o.status === f);
  $("#ordList").innerHTML = list.length ? list.map(o => {
    const txt = `Olá ${o.customerName}! Sobre o seu pedido na ${settings.companyName}:`;
    return `<div class="box ord">
      <div class="oh"><div><b>${esc(o.customerName)}</b> · ${esc(o.phone)}<small>${fmtDt(dt(o))} · ${o.delivery === "entrega" ? "Entrega: " + esc(o.address) : "Retirada"}</small></div><b class="ot">${brl(o.total)}</b></div>
      <ul>${(o.items || []).map(i => `<li>${i.qty}x ${esc(i.name)} — ${brl(i.price * i.qty)}</li>`).join("")}</ul>
      ${o.notes ? `<p class="note">Obs.: ${esc(o.notes)}</p>` : ""}
      <div class="of"><select data-st="${o.id}">${Object.keys(ST).map(k => `<option value="${k}"${o.status === k ? " selected" : ""}>${ST[k]}</option>`).join("")}</select>
      <a class="btn gold sm" target="_blank" rel="noopener" href="https://wa.me/${waNum(o.phone)}?text=${encodeURIComponent(txt)}">Abrir WhatsApp</a></div></div>`;
  }).join("") : '<p class="state">Nenhum pedido encontrado.</p>';
}
$("#stFilter").onchange = renderOrders;
$("#ordList").addEventListener("change", async e => {
  const id = e.target.dataset.st; if (!id) return;
  try { await updateDoc(doc(db, "orders", id), { status: e.target.value }); toast("Status atualizado"); }
  catch (err) { toast(fbError(err), "bad"); renderOrders(); }
});

/* ---------- Configurações ---------- */
const cf = $("#cfgForm");
const setPv = (form, name, url) => { const pv = form.querySelector(`[data-up="${name}"]`)?.parentElement.querySelector(".pv"); if (pv) { pv.hidden = !url; if (url) pv.src = url; } };
document.addEventListener("change", async e => {
  const t = e.target; if (!t.matches?.("[data-up]") || !t.files[0]) return;
  const st = t.parentElement.querySelector(".upst"); st.textContent = "Enviando imagem…"; t.disabled = true;
  try { const url = await uploadImage(t.files[0]); t.form[t.dataset.up].value = url; setPv(t.form, t.dataset.up, url); st.textContent = "Imagem enviada ✔ (clique em Salvar)"; }
  catch (err) { st.textContent = err.message; }
  t.disabled = false; t.value = "";
});
function fillCfg() {
  setPv(cf, "heroImage", settings.heroImage); setPv(cf, "aboutImage", settings.aboutImage); ["companyName", "whatsapp", "heroTitle", "heroSubtitle", "heroImage", "aboutImage", "aboutText", "address", "hours", "instagram", "deliveryFee"].forEach(k => cf[k].value = settings[k] ?? ""); }
cf.addEventListener("submit", async e => {
  e.preventDefault();
  const m = $("#cMsg"); m.className = "msg bad";
  const data = Object.fromEntries(new FormData(cf).entries());
  data.whatsapp = data.whatsapp.replace(/\D/g, ""); data.deliveryFee = parseFloat(data.deliveryFee) || 0;
  if (data.companyName.trim().length < 2) return m.textContent = "Informe o nome da empresa.";
  if (data.whatsapp.length < 12) return m.textContent = "WhatsApp inválido. Use 55 + DDD + número.";
  if (data.heroImage && !/^https?:\/\//i.test(data.heroImage)) return m.textContent = "URL da imagem inválida.";
  $("#cBtn").disabled = true; $("#cBtn").textContent = "Salvando…";
  try { await setDoc(doc(db, "settings", "site"), data, { merge: true }); settings = { ...settings, ...data }; m.className = "msg ok"; m.textContent = "Configurações salvas."; toast("Configurações salvas"); }
  catch (err) { m.textContent = fbError(err); }
  $("#cBtn").disabled = false; $("#cBtn").textContent = "Salvar configurações";
});
