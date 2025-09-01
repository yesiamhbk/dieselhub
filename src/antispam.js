// Front-only anti-spam with Turnstile, minimal integration.
// Drop this file into src/ and add <script type="module" src="/src/antispam.js"></script> to index.html <head>.

const TURNSTILE_SITE_KEY = (import.meta.env && import.meta.env.VITE_TURNSTILE_SITE_KEY) || "1x00000000000000000000AA"; // test

const RATE_LIMIT = 2;
const WINDOW_MS = 5 * 60 * 1000;

function getDeviceId() {
  try {
    let id = localStorage.getItem("deviceId");
    if (!id) {
      id = ([1e7]+-1e3+-4e3+-8e3+-1e11).replace(/[018]/g, c =>
        (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)
      );
      localStorage.setItem("deviceId", id);
    }
    return id;
  } catch { return "no-localstorage"; }
}

function readAttempts() {
  try { return JSON.parse(localStorage.getItem("orderAttempts") || "[]"); } catch { return []; }
}
function writeAttempts(a) {
  try { localStorage.setItem("orderAttempts", JSON.stringify(a)); } catch {}
}
function prune(a) {
  const now = Date.now();
  return (a || []).filter(t => now - t < WINDOW_MS);
}

function ensureTurnstileLoaded() {
  return new Promise((resolve) => {
    const render = () => resolve();
    if (window.turnstile) return resolve();
    let s = document.getElementById("cf-turnstile-script");
    if (!s) {
      s = document.createElement("script");
      s.id = "cf-turnstile-script";
      s.src = "https://challenges.cloudflare.com/turnstile/v0/api.js";
      s.async = true; s.defer = true;
      s.onload = render;
      document.head.appendChild(s);
    } else if (s && !window.turnstile) {
      s.addEventListener("load", render, { once: true });
    } else {
      resolve();
    }
  });
}

function showCaptcha() {
  return new Promise(async (resolve, reject) => {
    await ensureTurnstileLoaded();

    const overlay = document.createElement("div");
    overlay.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,.6);display:flex;align-items:center;justify-content:center;z-index:99999;";
    const box = document.createElement("div");
    box.style.cssText = "background:#111;border:1px solid #333;border-radius:12px;padding:16px;max-width:360px;width:90%;color:#eaeaea;text-align:center;";
    box.innerHTML = '<div style="margin-bottom:10px;font-size:14px">Підтвердіть, що ви не робот</div><div id="cf-box"></div>';
    overlay.appendChild(box);
    document.body.appendChild(overlay);

    const cleanup = () => { overlay.remove(); };

    try {
      window.turnstile.render("#cf-box", {
        sitekey: TURNSTILE_SITE_KEY,
        theme: "dark",
        callback: (token) => { cleanup(); resolve(token); },
        "error-callback": () => { cleanup(); reject(new Error("captcha error")); },
        "expired-callback": () => { cleanup(); reject(new Error("captcha expired")); },
      });
    } catch (e) {
      cleanup();
      reject(e);
    }
  });
}

(function patchFetch() {
  const _fetch = window.fetch.bind(window);
  window.fetch = async (input, init={}) => {
    try {
      const url = typeof input === "string" ? input : input.url;
      const method = (init.method || (typeof input !== "string" ? input.method : "GET") || "GET").toUpperCase();
      const isOrder = url && url.includes("/api/order") && method === "POST";

      // Add x-device-id header and honeypot/company/captcha when needed
      if (isOrder) {
        init.headers = new Headers(init.headers || {});
        if (!init.headers.has("x-device-id")) init.headers.set("x-device-id", getDeviceId());

        let bodyObj = {};
        if (init.body) {
          try { bodyObj = JSON.parse(init.body); } catch {}
        }
        if (!("company" in bodyObj)) bodyObj.company = ""; // honeypot

        // if too many recent attempts — force captcha before first try
        const arr = prune(readAttempts());
        writeAttempts(arr);
        if (arr.length >= RATE_LIMIT) {
          try {
            const token = await showCaptcha();
            bodyObj.captchaToken = token;
            init.body = JSON.stringify(bodyObj);
          } catch (e) {
            console.warn("[antispam] captcha canceled", e);
            throw e;
          }
        } else {
          // mark the attempt locally (we считаем отправки на фронте)
          arr.push(Date.now());
          writeAttempts(arr);
          init.body = JSON.stringify(bodyObj);
        }
      }

      const res = await _fetch(input, init);

      // If server asks for captcha — show it and retry once with token
      if (isOrder && res.status === 403) {
        let data = null;
        try { data = await res.clone().json(); } catch {}
        if (data && data.needCaptcha) {
          const token = await showCaptcha();
          const retryInit = { ...(init || {}) };
          let bodyObj = {};
          try { bodyObj = JSON.parse(retryInit.body || "{}"); } catch {}
          bodyObj.captchaToken = token;
          retryInit.body = JSON.stringify(bodyObj);
          return _fetch(input, retryInit);
        }
      }

      return res;
    } catch (e) {
      return Promise.reject(e);
    }
  };
})();
