import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import * as fs from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import * as au from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

const c = window.APP_CONFIG;
export const configured = !!(c && c.firebase.apiKey && !c.firebase.apiKey.startsWith("COLE_") && c.firebase.projectId && !c.firebase.projectId.startsWith("SEU-"));
export let db = null, auth = null;
if (configured) {
  const app = initializeApp(c.firebase);
  db = fs.getFirestore(app);
  auth = au.getAuth(app);
}
export { fs, au };
export const esc = s => String(s ?? "").replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]));
export const brl = n => Number(n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
export const toast = (msg, type = "ok") => {
  const t = document.createElement("div");
  t.className = "toast " + type; t.textContent = msg; t.setAttribute("role", "status");
  document.body.appendChild(t); setTimeout(() => t.remove(), 4500);
};
export const fbError = e => {
  const m = { "permission-denied": "Sem permissão. Verifique as regras do Firestore e se você é administrador.",
    "unavailable": "Sem conexão com o servidor. Tente novamente.",
    "auth/invalid-credential": "E-mail ou senha incorretos.", "auth/wrong-password": "E-mail ou senha incorretos.",
    "auth/user-not-found": "E-mail ou senha incorretos.", "auth/too-many-requests": "Muitas tentativas. Aguarde e tente novamente.",
    "auth/invalid-email": "E-mail inválido.", "auth/network-request-failed": "Falha de rede." };
  return m[e && e.code] || ("Erro: " + (e && e.message || e));
};
export const DEFAULT_SETTINGS = {
  companyName: "Moisés Gourmet", whatsapp: (c && c.whatsapp) || "5586999294401",
  heroTitle: "Doces artesanais que conquistam no primeiro pedaço",
  heroSubtitle: "Bolos de pote e bombons de travessa feitos com ingredientes selecionados e muito carinho.",
  heroImage: "https://images.unsplash.com/photo-1578985545062-69928b1d9587?auto=format&fit=crop&w=900&q=80",
  aboutText: "A Moisés Gourmet nasceu da paixão por confeitaria. Cada bolo de pote e cada bombom de travessa é preparado artesanalmente, com ingredientes de qualidade e sabor marcante.",
  address: "", hours: "", instagram: "", deliveryFee: 0
};
