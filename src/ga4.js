// src/ga4.js
const MEASUREMENT_ID = (typeof import.meta !== "undefined" && import.meta.env && import.meta.env.VITE_GA_MEASUREMENT_ID) || "G-XXXXXXXXXX";
(function loadGA(){
  window.dataLayer = window.dataLayer || [];
  function gtag(){ dataLayer.push(arguments); }
  window.gtag = window.gtag || gtag;
  gtag("js", new Date());
  gtag("config", MEASUREMENT_ID, { send_page_view: true });
  const s = document.createElement("script");
  s.async = true;
  s.src = `https://www.googletagmanager.com/gtag/js?id=${MEASUREMENT_ID}`;
  document.head.appendChild(s);
})();
window.DH_GA = { event(name, params){ try{ window.gtag && window.gtag("event", name, params || {}); } catch{} } };
window.addEventListener("dh:begin_checkout", (e) => {
  const d = e.detail || {};
  window.DH_GA.event("begin_checkout", {
    currency: "UAH",
    value: d.total || 0,
    items: (d.items || []).map(x => ({ item_id: x.number || x.id || "", item_name: x.number || "", price: x.price || 0, quantity: x.qty || 1 })),
  });
});
window.addEventListener("dh:purchase", (e) => {
  const d = e.detail || {};
  window.DH_GA.event("purchase", {
    currency: "UAH",
    value: d.total || 0,
    transaction_id: d.txid || Date.now().toString(36),
    items: (d.items || []).map(x => ({ item_id: x.number || x.id || "", item_name: x.number || "", price: x.price || 0, quantity: x.qty || 1 })),
  });
});
