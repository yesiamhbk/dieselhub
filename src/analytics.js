const API = import.meta.env?.VITE_API_BASE || "";
const STORAGE_KEY = "dh_attribution_v1";
const SESSION_KEY = "dh_session_id";

export function normalizeSearchQuery(value) {
  return String(value || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 80);
}

function randomId() {
  return globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function getSessionId() {
  try {
    let value = sessionStorage.getItem(SESSION_KEY);
    if (!value) { value = randomId(); sessionStorage.setItem(SESSION_KEY, value); }
    return value;
  } catch { return randomId(); }
}

export function captureAttribution() {
  try {
    const existing = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    if (existing) return existing;
    const params = new URLSearchParams(location.search);
    const referrer = document.referrer || "";
    const source = params.get("utm_source") || (referrer ? new URL(referrer).hostname.replace(/^www\./, "") : "direct");
    const value = {
      source: String(source).slice(0, 120),
      medium: String(params.get("utm_medium") || (source === "direct" ? "none" : "referral")).slice(0, 120),
      campaign: String(params.get("utm_campaign") || "").slice(0, 160),
      term: String(params.get("utm_term") || "").slice(0, 160),
      content: String(params.get("utm_content") || "").slice(0, 160),
      gclid: String(params.get("gclid") || "").slice(0, 180),
      referrer: referrer.slice(0, 500),
      landing_path: `${location.pathname}${location.search}`.slice(0, 500),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
    return value;
  } catch { return { source: "direct", medium: "none" }; }
}

export function trackEvent(eventType, properties = {}) {
  const body = JSON.stringify({
    event_type: eventType,
    session_id: getSessionId(),
    page_path: `${location.pathname}${location.search}`.slice(0, 500),
    attribution: captureAttribution(),
    properties,
  });
  try {
    if (navigator.sendBeacon) {
      navigator.sendBeacon(`${API}/api/analytics/event`, new Blob([body], { type: "application/json" }));
      return;
    }
  } catch {}
  fetch(`${API}/api/analytics/event`, { method: "POST", headers: { "Content-Type": "application/json" }, body, keepalive: true }).catch(() => {});
}

export function trackSearch(query, resultCount) {
  const normalized = normalizeSearchQuery(query);
  if (!normalized) return;
  trackEvent("search", { query: String(query).trim().slice(0, 120), normalized_query: normalized, result_count: Math.max(0, Number(resultCount) || 0) });
}
