// src/seo.js
// Lightweight SEO helper: builds JSON-LD ItemList from products once.

(function () {
  const MAX_ITEMS = 50;
  let injected = false;

  function injectJsonLd(products) {
    if (injected) return;
    injected = true;
    try {
      const list = (products || []).slice(0, MAX_ITEMS).map((p, idx) => ({
        "@type": "ListItem",
        "position": idx + 1,
        "item": {
          "@type": "Product",
          "name": [p.manufacturer, p.number].filter(Boolean).join(" "),
          "sku": p.number || String(p.id || ""),
          "mpn": p.oem || undefined,
          "brand": p.manufacturer ? { "@type": "Brand", "name": p.manufacturer } : undefined,
          "offers": {
            "@type": "Offer",
            "priceCurrency": "UAH",
            "price": typeof p.price === "number" ? p.price : String(p.price || ""),
            "availability": (p.availability && /in|в наявності/i.test(p.availability)) ? "http://schema.org/InStock" : "http://schema.org/PreOrder"
          }
        }
      }));

      const jsonLd = {
        "@context": "https://schema.org",
        "@type": "ItemList",
        "itemListElement": list
      };
      const script = document.createElement("script");
      script.type = "application/ld+json";
      script.textContent = JSON.stringify(jsonLd);
      document.head.appendChild(script);
    } catch (e) {
      console.warn("[seo] json-ld inject failed:", e);
    }
  }

  const _fetch = window.fetch.bind(window);
  window.fetch = async (input, init) => {
    const res = await _fetch(input, init);
    try {
      const url = typeof input === "string" ? input : input.url;
      const method = (init && init.method ? init.method : "GET").toUpperCase();
      if (!injected && url && url.includes("/api/products") && method === "GET") {
        const clone = res.clone();
        clone.json().then((data) => {
          if (Array.isArray(data)) injectJsonLd(data);
        }).catch(() => {});
      }
    } catch (e) {}
    return res;
  };
})();