// Roda no build da Vercel: gera firebase-config.js a partir das variáveis de ambiente.
const fs = require("fs");
const e = process.env;
if (!e.FIREBASE_API_KEY) { console.log("FIREBASE_API_KEY ausente: mantendo firebase-config.js atual."); process.exit(0); }
const cfg = {
  firebase: {
    apiKey: e.FIREBASE_API_KEY,
    authDomain: e.FIREBASE_AUTH_DOMAIN || "",
    projectId: e.FIREBASE_PROJECT_ID || "",
    appId: e.FIREBASE_APP_ID || ""
  },
  whatsapp: e.WHATSAPP_NUMBER || "5586999294401",
  adminEmail: "admin@moisesgourmet.app",
  imgbbKey: e.IMGBB_API_KEY || ""
};
fs.writeFileSync("firebase-config.js", "window.APP_CONFIG = " + JSON.stringify(cfg, null, 2) + ";\n");
console.log("firebase-config.js gerado.");
