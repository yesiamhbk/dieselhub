// server.mjs
import express from "express";
import cors from "cors";
import multer from "multer";
import crypto from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { buildTelegramOrderMessage } from "./lib/telegram-order.mjs";
import { productAvailabilityForQty, withDerivedProductAvailability } from "./lib/product-availability.mjs";
import { findProductForRoute, parseProductRouteSlug, productRoutePath } from "./lib/product-route.mjs";
import {
  buildProductOgSvg,
  buildProductShareMeta,
  renderProductOgJpeg,
  renderProductShareHtml,
} from "./lib/product-preview.mjs";

const app = express();
app.set('trust proxy', true);

// --- Admin IP allowlist (UI+API) ---
const ADMIN_IPS = (process.env.ADMIN_IPS || "78.154.188.94").split(',').map(s=>s.trim()).filter(Boolean);
function getClientIP(req) {
  const xf = (req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  const ip = xf || req.ip || req.connection?.remoteAddress || '';
  return ip.replace('::ffff:', '');
}
function isIpAllowed(ip) {
  if (!ADMIN_IPS.length) return true;
  if (ip === '127.0.0.1' || ip === '::1') return true; // local dev
  return ADMIN_IPS.includes(ip);
}

app.disable('x-powered-by');

// CORS whitelist (prod-safe). Override via CORS_ORIGINS env, comma-separated.
const DEFAULT_ORIGINS = ['http://localhost:5173','http://127.0.0.1:5173','https://dieselhub.com.ua','https://kropdieselhub.com','https://www.dieselhub.com.ua','https://www.kropdieselhub.com'];
const ORIGINS = (process.env.CORS_ORIGINS ? process.env.CORS_ORIGINS.split(',') : DEFAULT_ORIGINS).map(s=>s.trim());
app.use(cors({
  origin(origin, cb){ if(!origin) return cb(null,true); cb(null, ORIGINS.includes(origin)); },
}));
app.use(express.json({ limit: "5mb" }));

const {
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  ADMIN_TOKEN,
  TELEGRAM_BOT_TOKEN,
  TELEGRAM_CHAT_ID,
  NP_API_KEY,            // новый ключ (предпочтительно)
  NOVA_POSHTA_KEY,       // совместимость с предыдущим именем
} = process.env;

// === Anti-spam + Turnstile (minimal) ===
const TURNSTILE_SITE_KEY = process.env.TURNSTILE_SITE_KEY || process.env.VITE_TURNSTILE_SITE_KEY || "1x00000000000000000000AA"; // test
const TURNSTILE_SECRET_KEY = process.env.TURNSTILE_SECRET_KEY || "1x0000000000000000000000000000000AA"; // test
const ORDER_RATE_LIMIT_COUNT = Number(process.env.ORDER_RATE_LIMIT_COUNT || 2);
const ORDER_RATE_LIMIT_WINDOW_MS = Number(process.env.ORDER_RATE_LIMIT_WINDOW_MS || 5 * 60 * 1000);

const orderRateStore = new Map();
const rateKey = (ip, dev) => `${ip}|${dev || "no-device"}`;
function shouldAskCaptcha(ip, dev) {
  const now = Date.now();
  const k = rateKey(ip, dev);
  const list = (orderRateStore.get(k) || []).filter(t => now - t < ORDER_RATE_LIMIT_WINDOW_MS);
  orderRateStore.set(k, list);
  return list.length >= ORDER_RATE_LIMIT_COUNT;
}
function markAttempt(ip, dev) {
  const k = rateKey(ip, dev);
  const list = orderRateStore.get(k) || [];
  list.push(Date.now());
  orderRateStore.set(k, list);
}
async function verifyTurnstile(token, ip) {
  if (!token) return false;
  try {
    const r = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ secret: TURNSTILE_SECRET_KEY, response: token, remoteip: ip }),
    });
    const j = await r.json();
    return !!j.success;
  } catch (e) {
    console.error("[turnstile verify error]", e);
    return false;
  }
}

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("No SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env");
  process.exit(1);
}

// ====== Supabase (admin) ======
const supaAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const textValue = (value, max = 200) => String(value || "").trim().slice(0, max);
const normalizePartNumber = (value) => textValue(value, 120).toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 80);
const hashIp = (ip) => crypto.createHash("sha256").update(`${process.env.ANALYTICS_SALT || "dieselhub-local"}|${ip}`).digest("hex").slice(0, 24);
const PUBLIC_PRODUCT_FIELDS = "id,number,oem,cross,compat_for,manufacturer,condition,type,availability,qty,price,engine,images,sort_order,pinned";
const productOgCache = new Map();

async function findPublicProduct(rawNumber) {
  const { number } = parseProductRouteSlug(rawNumber);
  if (!number) return null;
  const exact = await supaAdmin.from("products").select(PUBLIC_PRODUCT_FIELDS).eq("number", number).order("id", { ascending: true }).limit(10);
  if (exact.error) throw exact.error;
  const exactMatch = findProductForRoute(exact.data || [], rawNumber, { matchRelated: false });
  if (exactMatch) return withDerivedProductAvailability(exactMatch);
  const insensitive = await supaAdmin.from("products").select(PUBLIC_PRODUCT_FIELDS).ilike("number", number).order("id", { ascending: true }).limit(10);
  if (insensitive.error) throw insensitive.error;
  return withDerivedProductAvailability(findProductForRoute(insensitive.data || [], rawNumber, { matchRelated: false }));
}

async function buildProductOgImage(product) {
  const photoUrl = Array.isArray(product.images) ? product.images.find(Boolean) : "";
  let source = null;
  if (photoUrl) {
    const parsed = new URL(photoUrl);
    if (parsed.protocol !== "https:") throw new Error("unsupported product image protocol");
    const response = await fetch(parsed, { signal: AbortSignal.timeout(7000) });
    if (!response.ok) throw new Error(`product image returned ${response.status}`);
    const declaredSize = Number(response.headers.get("content-length")) || 0;
    if (declaredSize > 12 * 1024 * 1024) throw new Error("product image is too large");
    source = Buffer.from(await response.arrayBuffer());
    if (source.length > 12 * 1024 * 1024) throw new Error("product image is too large");
  }
  return renderProductOgJpeg(product, source);
}

// ====== простая админ-авторизация ======
function requireAdmin(req, res, next) {
  const ip = getClientIP(req);
  if (!isIpAllowed(ip)) return res.status(403).json({ error:'forbidden_ip', ip });

  const token = req.header("x-admin-token");
  if (!token || token !== ADMIN_TOKEN) return res.status(401).json({ error: "unauthorized" });
  next();
}

app.get("/api/health", (_req, res) => res.json({ ok: true }));

// ===== Диагностика подключения (что видит сервер) =====
app.get("/api/debug/db", requireAdmin, async (_req, res) => {
  try {
    const { count, error } = await supaAdmin
      .from("products")
      .select("id", { count: "exact", head: true });

    const projectRef =
      SUPABASE_URL.match(/https:\/\/([a-z0-9-]+)\.supabase\.co/i)?.[1] || "unknown";

    res.json({
      ok: !error,
      projectRef,
      supabaseUrl: SUPABASE_URL,
      productsCount: count ?? 0,
      error: error ? String(error.message || error) : null,
    });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e.message || e) });
  }
});

// ===== Товары =====
app.get("/api/products", async (_req, res) => {
  try {
    const { data, error } = await supaAdmin
      .from("products")
      .select(PUBLIC_PRODUCT_FIELDS)
      .order("id", { ascending: true });
    if (error) throw error;
    res.json((data || []).map(withDerivedProductAvailability));
  } catch (e) {
    console.error("[/api/products] error:", e);
    res.status(500).json({ error: String(e.message || e) });
  }
});

app.get("/api/products/:number", async (req, res) => {
  try {
    const product = await findPublicProduct(req.params.number);
    if (!product) return res.status(404).json({ error: "product_not_found" });
    res.setHeader("Cache-Control", "public, max-age=60, s-maxage=300, stale-while-revalidate=600");
    res.json(product);
  } catch (error) {
    console.error("[/api/products/:number] error:", error);
    res.status(500).json({ error: "product_unavailable" });
  }
});

app.get("/api/og/product/:number", async (req, res) => {
  try {
    const product = await findPublicProduct(req.params.number);
    if (!product) return res.status(404).type("text/plain").send("product not found");
    const imageKey = JSON.stringify([product.id, product.number, product.price, product.qty, product.availability, product.condition, product.images?.[0] || ""]);
    const cached = productOgCache.get(imageKey);
    const now = Date.now();
    let image = cached && now - cached.createdAt < 5 * 60 * 1000 ? cached.buffer : null;
    if (!image) {
      try {
        image = await buildProductOgImage(product);
      } catch (imageError) {
        console.warn("[product OG photo] using fallback:", imageError.message || imageError);
        image = await buildProductOgImage({ ...product, images: [] });
      }
      if (productOgCache.size >= 64) productOgCache.delete(productOgCache.keys().next().value);
      productOgCache.set(imageKey, { buffer: image, createdAt: now });
    }
    res.setHeader("Cache-Control", "public, max-age=300, s-maxage=600, stale-while-revalidate=86400");
    res.type("image/jpeg").send(image);
  } catch (error) {
    console.error("[/api/og/product/:number] error:", error);
    res.status(500).type("text/plain").send("preview unavailable");
  }
});

app.get("/share/product/:number", async (req, res) => {
  try {
    const product = await findPublicProduct(req.params.number);
    if (!product) return res.status(404).type("text/plain").send("product not found");
    res.setHeader("Cache-Control", "public, max-age=60, s-maxage=300, stale-while-revalidate=600");
    res.type("html").send(renderProductShareHtml(product));
  } catch (error) {
    console.error("[/share/product/:number] error:", error);
    res.status(500).type("text/plain").send("preview unavailable");
  }
});

app.get(["/sitemap.xml", "/api/sitemap.xml"], async (_req, res) => {
  try {
    const { data, error } = await supaAdmin.from("products").select("number,condition").not("number", "is", null).order("id", { ascending: true });
    if (error) throw error;
    const escapeXml = (value) => String(value).replace(/[<>&'\"]/g, char => ({ "<":"&lt;", ">":"&gt;", "&":"&amp;", "'":"&apos;", '"':"&quot;" }[char]));
    const urls = [...new Set(["https://dieselhub.com.ua/", ...(data || []).map(product => `https://dieselhub.com.ua${productRoutePath(product)}`)])];
    res.type("application/xml").send(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.map(url => `\n  <url><loc>${escapeXml(url)}</loc></url>`).join("")}\n</urlset>`);
  } catch (error) { res.status(500).type("text/plain").send("sitemap unavailable"); }
});

// Anonymous, allow-listed funnel/search collection. No raw IP, cookies or contact data.
app.post("/api/analytics/event", async (req, res) => {
  const allowedTypes = new Set(["visit", "search", "product_view", "add_to_cart", "checkout_start", "order", "zero_result_lead"]);
  const src = req.body || {};
  const eventType = textValue(src.event_type, 40);
  if (!allowedTypes.has(eventType)) return res.status(400).json({ error: "invalid_event" });
  const props = src.properties && typeof src.properties === "object" ? src.properties : {};
  const attr = src.attribution && typeof src.attribution === "object" ? src.attribution : {};
  const row = {
    event_type: eventType,
    session_id: textValue(src.session_id, 80) || null,
    page_path: textValue(src.page_path, 500) || null,
    query: eventType === "search" ? textValue(props.query, 120) : null,
    normalized_query: eventType === "search" ? normalizePartNumber(props.normalized_query || props.query) : null,
    result_count: eventType === "search" ? Math.max(0, Math.min(10000, Number(props.result_count) || 0)) : null,
    product_id: props.product_id == null ? null : textValue(props.product_id, 100),
    product_number: textValue(props.product_number, 120) || null,
    event_value: Math.max(0, Number(props.value) || 0),
    source: textValue(attr.source, 120) || "direct",
    medium: textValue(attr.medium, 120) || null,
    campaign: textValue(attr.campaign, 160) || null,
    referrer: textValue(attr.referrer, 500) || null,
    landing_path: textValue(attr.landing_path, 500) || null,
    ip_hash: hashIp(getClientIP(req)),
    user_agent_family: textValue(req.get("user-agent"), 240) || null,
  };
  try {
    const { error } = await supaAdmin.from("analytics_events").insert(row);
    if (error) throw error;
    res.status(202).json({ ok: true });
  } catch (error) {
    console.warn("[analytics insert] skip:", error.message || error);
    res.status(202).json({ ok: false });
  }
});

app.get("/api/admin/analytics", requireAdmin, async (req, res) => {
  const days = Math.max(1, Math.min(365, Number(req.query.days) || 30));
  try {
    const { data, error } = await supaAdmin.rpc("analytics_dashboard", { p_days: days });
    if (error) throw error;
    res.json(data);
  } catch (error) { res.status(500).json({ error: "analytics_unavailable" }); }
});

// Создание/апсерта товара
app.post("/api/admin/product", requireAdmin, async (req, res) => {
  try {
    const src = req.body || {};
    const allowed = ["price","qty","availability","number","oem","cross","compat_for","manufacturer","condition","type","engine","images","sort_order","pinned"];
    const payload = Object.fromEntries(Object.entries(src).filter(([k]) => allowed.includes(k)));
    const qty = payload.qty === "" || payload.qty == null ? 0 : Number(payload.qty);
    const price = payload.price === "" || payload.price == null ? 0 : Number(payload.price);
    const engine = payload.engine === "" || payload.engine == null ? null : Number(payload.engine);
    if (!Number.isInteger(qty) || qty < 0) return res.status(400).json({ error: "invalid_qty" });
    if (!Number.isFinite(price) || price < 0) return res.status(400).json({ error: "invalid_price" });
    if (engine !== null && (!Number.isFinite(engine) || engine <= 0)) return res.status(400).json({ error: "invalid_engine" });
    payload.qty = qty;
    payload.price = price;
    payload.engine = engine;
    payload.availability = productAvailabilityForQty(qty);
    const { data, error } = await supaAdmin
      .from("products")
      .upsert(payload)
      .select()
      .single();
    if (error) throw error;
    res.json({ ok: true, id: data.id });
  } catch (e) {
    console.error("[POST /api/admin/product] error:", e);
    res.status(500).json({ error: String(e.message || e) });
  }
});

// Частичное редактирование (обновляем только пришедшие поля)
app.patch("/api/admin/product/:id", requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const src = req.body || {};
    const allowed = ["price","qty","number","oem","cross","compat_for","manufacturer","condition","type","engine","images","sort_order","pinned"];
    const patch = {};
    for (const k of allowed) if (k in src && src[k] !== undefined) patch[k] = src[k];
    if (Object.keys(patch).length === 0) return res.json({ ok: true });
    if ("qty" in patch) {
      const qty = patch.qty === "" || patch.qty == null ? 0 : Number(patch.qty);
      if (!Number.isInteger(qty) || qty < 0) return res.status(400).json({ error: "invalid_qty" });
      patch.qty = qty;
      patch.availability = productAvailabilityForQty(qty);
    }
    if ("price" in patch) {
      const price = patch.price === "" || patch.price == null ? 0 : Number(patch.price);
      if (!Number.isFinite(price) || price < 0) return res.status(400).json({ error: "invalid_price" });
      patch.price = price;
    }
    if ("engine" in patch) {
      const engine = patch.engine === "" || patch.engine == null ? null : Number(patch.engine);
      if (engine !== null && (!Number.isFinite(engine) || engine <= 0)) return res.status(400).json({ error: "invalid_engine" });
      patch.engine = engine;
    }
// (One-off) Очистка поля models (переводим в NULL для всего каталога)
app.post("/api/admin/migrate/clear-models", requireAdmin, async (_req, res) => {
  try {
    const { error } = await supaAdmin
      .from("products")
      .update({ models: null });
    if (error) throw error;
    res.json({ ok: true });
  } catch (e) {
    console.error("[POST /api/admin/migrate/clear-models] error:", e);
    res.status(500).json({ error: String(e.message || e) });
  }
});


    const { data, error } = await supaAdmin
      .from("products")
      .update(patch)
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    res.json({ ok: true, id: data.id });
  } catch (e) {
    console.error("[PATCH /api/admin/product/:id] error:", e);
    res.status(500).json({ error: String(e.message || e) });
  }
});

// Удаление товара
app.delete("/api/admin/product/:id", requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { error } = await supaAdmin.from("products").delete().eq("id", id);
    if (error) throw error;
    res.json({ ok: true });
  } catch (e) {
    console.error("[DELETE /api/admin/product/:id] error:", e);
    res.status(500).json({ error: String(e.message || e) });
  }
});

// ===== Картинки (bucket: product-images) =====
const upload = multer({ storage: multer.memoryStorage() });

app.post("/api/admin/product/:id/upload", requireAdmin, upload.array("files", 10), async (req, res) => {
  try {
    const { id } = req.params;
    const files = req.files || [];
    if (!files.length) return res.json({ ok: true, added: 0, urls: [] });

    const urls = [];
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      const path = `${id}/${Date.now()}-${i}-${(f.originalname || "img").replace(/\s+/g, "_")}`;
      const { error: eUp } = await supaAdmin
        .storage
        .from("product-images")
        .upload(path, f.buffer, { contentType: f.mimetype || "image/jpeg", upsert: false });
      if (eUp) throw eUp;

      const { data } = supaAdmin.storage.from("product-images").getPublicUrl(path);
      urls.push(data.publicUrl);
    }

    const { data: prod, error: eSel } = await supaAdmin
      .from("products")
      .select("images")
      .eq("id", id)
      .single();
    if (eSel) throw eSel;

    const newImages = [...(prod?.images || []), ...urls];
    const { error: eUpd } = await supaAdmin.from("products").update({ images: newImages }).eq("id", id);
    if (eUpd) throw eUpd;

    res.json({ ok: true, added: urls.length, urls });
  } catch (e) {
    console.error("[POST /upload] error:", e);
    res.status(500).json({ error: String(e.message || e) });
  }
});

app.delete("/api/admin/product/:id/image", requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { url } = req.body || {};
    if (!url) return res.status(400).json({ error: "no url" });

    const idx = url.indexOf("/product-images/");
    if (idx !== -1) {
      const path = url.slice(idx + "/product-images/".length);
      await supaAdmin.storage.from("product-images").remove([path]).catch(() => {});
    }

    const { data: prod, error: eSel } = await supaAdmin
      .from("products")
      .select("images")
      .eq("id", id)
      .single();
    if (eSel) throw eSel;

    const filtered = (prod?.images || []).filter((u) => u !== url);
    const { error: eUpd } = await supaAdmin.from("products").update({ images: filtered }).eq("id", id);
    if (eUpd) throw eUpd;

    res.json({ ok: true });
  } catch (e) {
    console.error("[DELETE /image] error:", e);
    res.status(500).json({ error: String(e.message || e) });
  }
});

// ===== Заказ → Telegram =====
app.post("/api/order", async (req, res) => {
  try {
    const body = req.body || {};
    // Honeypot
    if (body.company && String(body.company).trim()) {
      console.warn("[order honeypot] bot blocked");
      return res.json({ ok: true });
    }
    if (!Array.isArray(body.items) || body.items.length === 0) {
      return res.status(400).json({ error: "no items" });
    }

    const ip = (req.headers["x-forwarded-for"] || req.socket.remoteAddress || "").toString().split(",")[0].trim();
    const deviceId = req.header("x-device-id") || "";

    if (shouldAskCaptcha(ip, deviceId)) {
      const ok = await verifyTurnstile(body.captchaToken, ip);
      if (!ok) return res.status(403).json({ needCaptcha: true, siteKey: TURNSTILE_SITE_KEY });
    }
    markAttempt(ip, deviceId);

    const name = String(body.name || "").trim();
    const phone = String(body.phone || "").trim();
    const delivery = String(body.delivery || "Нова пошта");
    const payment = typeof body.payment === "string" ? String(body.payment).trim() : null;
    const safeItems = body.items.map((item) => ({
      id: item.id || null,
      number: String(item.number || "").slice(0, 100),
      oem: String(item.oem || "").slice(0, 100),
      availability: String(item.availability || "").slice(0, 80),
      condition: String(item.condition || "").slice(0, 50),
      type: String(item.type || "").slice(0, 100),
      qty: Math.max(1, Number.parseInt(item.qty, 10) || 1),
      price: Math.max(0, Number(item.price) || 0),
    }));
    const total = safeItems.reduce((sum, item) => sum + item.qty * item.price, 0);

    
    // Save order to Supabase (fail-soft)
    let savedOrderId = null;
    let savedOrderNumber = null;
    try {
      const { data: ins, error: insErr } = await supaAdmin
        .from("orders")
        .insert({
          name,
          phone,
          delivery,
          payment,
          total,
          items: safeItems,
          utm: body.attribution || body.utm || null,
          source: textValue(body.attribution?.source, 120) || null,
          medium: textValue(body.attribution?.medium, 120) || null,
          campaign: textValue(body.attribution?.campaign, 160) || null,
          gclid: textValue(body.attribution?.gclid, 180) || null,
          referrer: textValue(body.attribution?.referrer, 500) || null,
          landing_path: textValue(body.attribution?.landing_path, 500) || null,
          device_id: deviceId || null,
          ip,
          status: "Новий"
        })
        .select()
        .single();
      if (insErr) throw insErr;
      savedOrderId = ins?.id || null;
      savedOrderNumber = Number(ins?.order_number) || null;
      if (!savedOrderNumber) {
        const { count } = await supaAdmin.from("orders").select("id", { count: "exact", head: true });
        savedOrderNumber = Number(count) || null;
      }
    } catch (e) {
      console.warn("[orders insert] skip:", e.message || e);
    }
    const text = buildTelegramOrderMessage({
      orderNumber: savedOrderNumber,
      name,
      phone,
      delivery,
      payment,
      items: safeItems,
      total,
    });

    if (TELEGRAM_BOT_TOKEN && TELEGRAM_CHAT_ID) {
      const tgUrl = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
      const telegramResponse = await fetch(tgUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text, parse_mode: "HTML" }),
      });
      if (!telegramResponse.ok) {
        const telegramError = await telegramResponse.text().catch(() => "");
        console.error("[Telegram order notification] failed:", telegramResponse.status, telegramError.slice(0, 500));
      }
    }

    res.json({ ok: true, orderNumber: savedOrderNumber, id: savedOrderId });
  } catch (e) {
    console.error("[POST /api/order] error:", e);
    res.status(500).json({ error: String(e.message || e) });
  }
});



// ===== Orders list for admin =====
app.get("/api/admin/orders", requireAdmin, async (_req, res) => {
  try {
    const { data, error } = await supaAdmin
      .from("orders")
      .select()
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) {
      console.warn("[GET /api/admin/orders] supabase error:", error.message || error);
      return res.json([]); // fail-soft: пустой список, чтобы админка не падала
    }
    res.json(data || []);
  } catch (e) {
    console.error("[GET /api/admin/orders] error:", e);
    res.json([]); // fail-soft
  }
});

// Get one order (admin)
app.get("/api/admin/orders/:id", requireAdmin, async (req, res) => {
  try {
    const { data, error } = await supaAdmin
      .from("orders")
      .select()
      .eq("id", req.params.id)
      .single();
    if (error) return res.status(404).json({ error: "not_found" });
    res.json(data);
  } catch (e) {
    console.error("[GET /api/admin/orders/:id] error:", e);
    res.status(500).json({ error: String(e.message || e) });
  }
});

// Update order status (admin)
app.patch("/api/admin/orders/:id", requireAdmin, async (req, res) => {
  try {
    const s = typeof req.body?.status === 'string' ? req.body.status : '';
    const comment = typeof req.body?.admin_comment === 'string' ? String(req.body.admin_comment).slice(0, 1000) : undefined;
    const upd = {};
    // Items editing (optional)
    const rawItems = Array.isArray(req.body?.items) ? req.body.items : null;
    if (rawItems) {
      const safe = rawItems.map((it) => {
        const number = String(it.number || it.code || it.sku || "").slice(0, 80);
        const oem = String(it.oem || it.OEM || "").slice(0, 80);
        const availability = String(it.availability || it.avail || it.stockStatus || "").slice(0, 80);
        const cond = String(it.condition || "").slice(0, 40);
        const qty = Math.max(1, parseInt(it.qty || it.quantity || 1));
        const price = Math.max(0, Number(it.price || it.unitPrice || 0));
        return { number, oem, availability, condition: cond, qty, price };
      });
      const total = safe.reduce((s, x) => s + (Number(x.qty||1) * Number(x.price||0)), 0);
      upd.items = safe;
      upd.total = total;
    }
    if (s) upd.status = s;
    if (comment !== undefined) upd.admin_comment = comment;
    const payment = typeof req.body?.payment === 'string' ? req.body.payment : undefined;
    if (payment !== undefined) upd.payment = payment;
    if (!Object.keys(upd).length) return res.status(400).json({ error: 'no_fields' });
    const { data, error } = await supaAdmin
      .from('orders')
      .update(upd)
      .eq('id', req.params.id)
      .select()
      .single();
    if (error) return res.status(500).json({ error: 'failed' });
    res.json(data);
  } catch (e) {
    console.error('[PATCH /api/admin/orders/:id] error:', e);
    res.status(500).json({ error: String(e.message || e) });
  }
});

/* =========================
   Nova Poshta proxy (server)
   ========================= */
const NP_KEY = NP_API_KEY || NOVA_POSHTA_KEY;

// Универсальный вызов API НП
async function npCall(modelName, calledMethod, methodProperties = {}) {
  if (!NP_KEY) throw new Error("Nova Poshta API key is missing (NP_API_KEY or NOVA_POSHTA_KEY)");
  const r = await fetch("https://api.novaposhta.ua/v2.0/json/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      apiKey: NP_KEY,
      modelName,
      calledMethod,
      methodProperties,
    }),
  });
  if (!r.ok) throw new Error(`NovaPoshta HTTP ${r.status}`);
  const j = await r.json();
  if (j?.success === false) {
    const msg = (j.errors && j.errors.join("; ")) || "NovaPoshta error";
    throw new Error(msg);
  }
  return j;
}

// кеш (6 часов)
const CACHE_MS = 6 * 60 * 60 * 1000;
const cityCache = new Map(); // key: qLower -> {ts, data}
const whCache = new Map();   // key: `${cityRef}|${type}` -> {ts, data}

const isPostomatLike = (w) =>
  /поштомат|postomat|parcel\s*locker/i.test(
    `${w.TypeOfWarehouse || ""} ${w.CategoryOfWarehouse || ""} ${w.Description || ""}`
  );

// --- settlements (поиск городов) ---
// GET /api/np/settlements?q=київ&limit=20
app.get("/api/np/settlements", async (req, res) => {
  try {
    const q = String(req.query.q || "").trim();
    const limit = Math.max(1, Math.min(50, parseInt(req.query.limit, 10) || 20));
    if (q.length < 2) return res.json([]);

    const key = `${q.toLowerCase()}|${limit}`;
    const hit = cityCache.get(key);
    if (hit && Date.now() - hit.ts < CACHE_MS) return res.json(hit.data);

    const j = await npCall("Address", "searchSettlements", {
      CityName: q,
      Limit: String(limit),
      Page: "1",
    });

    // структура: j.data[0].Addresses[]
    const addresses = j?.data?.[0]?.Addresses || [];
    const list = addresses.map((a) => ({
      Ref: a.DeliveryCity || a.Ref,     // используем как CityRef
      Present: a.Present || a.MainDescription, // "м. Київ, Київська обл."
      Area: a.Area,
      Region: a.Region,
    }));

    cityCache.set(key, { ts: Date.now(), data: list });
    res.json(list);
  } catch (e) {
    console.error("[/api/np/settlements] error:", e);
    // для UI безопаснее вернуть пустой массив, чем 500
    res.json([]);
  }
});

// --- warehouses (отделения/почтоматы) ---
// GET /api/np/warehouses?cityRef=XXXX&type=warehouse|postomat
app.get("/api/np/warehouses", async (req, res) => {
  try {
    const cityRef = String(req.query.cityRef || "").trim();
    const type = String(req.query.type || "warehouse").toLowerCase(); // warehouse | postomat
    if (!cityRef) return res.json([]);

    const key = `${cityRef}|${type}`;
    const hit = whCache.get(key);
    if (hit && Date.now() - hit.ts < CACHE_MS) return res.json(hit.data);

    // AddressGeneral.getWarehouses даёт полный состав полей
    const j = await npCall("AddressGeneral", "getWarehouses", {
      CityRef: cityRef,
      Page: "1",
      Limit: "500",
      Language: "UA",
    });

    let arr = Array.isArray(j?.data) ? j.data : [];

    if (type === "postomat") {
      arr = arr.filter(isPostomatLike);
    } else {
      arr = arr.filter((w) => !isPostomatLike(w));
    }

    const list = arr.map((w) => ({
      Ref: w.Ref,
      Number: String(w.Number || ""),
      Description: w.ShortAddress || w.Description,
      TypeOfWarehouse: w.TypeOfWarehouse,
      CategoryOfWarehouse: w.CategoryOfWarehouse,
    }));

    whCache.set(key, { ts: Date.now(), data: list });
    res.json(list);
  } catch (e) {
    console.error("[/api/np/warehouses] error:", e);
    res.json([]);
  }
});

// ===== Совместимость со старыми путями (/api/nova/...) [DEPRECATED: use /api/np/*] =====
app.get("/api/nova/cies", (req, res) => res.redirect(307, `/api/np/settlements?${new URLSearchParams(req.query).toString()}`)); // опечатки на всякий
app.get("/api/nova/cities", (req, res) => res.redirect(307, `/api/np/settlements?${new URLSearchParams(req.query).toString()}`));
app.get("/api/nova/warehouses", (req, res) => res.redirect(307, `/api/np/warehouses?${new URLSearchParams(req.query).toString()}`));


/* ======== IMPORT/EXPORT (CSV/JSON) — ADMIN ONLY ======== */
function normalizeKey(s){return String(s||"").toUpperCase().replace(/[\s\-_.]/g,"");}
function parseCSV(text){
  const delim=(text.indexOf(";")>-1&&text.indexOf(",")==-1)?";":",";
  const lines=text.replace(/\r\n?/g,"\n").split("\n");
  if(!lines.length)return[];
  const header=(lines.shift()||"").split(delim).map(h=>h.trim());
  const rows=[];
  for(const raw of lines){ if(!raw||!raw.trim())continue;
    const parts=raw.split(delim).map(x=>x.replace(/^"|"$|^'|'$/g,"").trim());
    const o={}; header.forEach((h,i)=>o[h]=parts[i]??""); rows.push(o);
  } return rows;
}
function csvStringify(rows){
  if(!Array.isArray(rows)||!rows.length)return"";
  const header=Object.keys(rows[0]); const esc=v=>{const s=(v==null?"":String(v)); return (s.includes(",")||s.includes(";")||s.includes("\n")||s.includes('"'))?'"'+s.replace(/"/g,'""')+'"':s;};
  const out=[header.join(",")]; for(const r of rows) out.push(header.map(k=>esc(r[k])).join(",")); return out.join("\n");
}
async function fetchAllProducts(){ const {data,error}=await supaAdmin.from("products").select("id,number,oem,cross,compat_for,manufacturer,condition,type,availability,qty,price,engine,images,sort_order,pinned").order("id",{ascending:true}); if(error) throw error; return data||[]; }
function shapeForExport(p){ return { id:p.id??"", number:p.number??"", oem:p.oem??"", cross:Array.isArray(p.cross)?p.cross.join("|"):"", manufacturer:p.manufacturer??"", condition:p.condition??"", type:p.type??"", engine:p.engine??"", availability:productAvailabilityForQty(p.qty), qty:p.qty??0, price:p.price??0, images:Array.isArray(p.images)?p.images.join("|"):"" }; }
const ALLOWED_CONDITIONS=new Set(["Нове","Відновлене"]); const ALLOWED_TYPES=new Set(["Форсунка","ТНВД","Клапан"]); const ALLOWED_AVAIL=new Set(["В наявності","Під замовлення"]);
function shapeIncoming(o){ const out={ id:o.id??null, number:(o.number??"").trim(), oem:(o.oem??"").trim(), cross:Array.isArray(o.cross)?o.cross:String(o.cross||"").split("|").map(s=>s.trim()).filter(Boolean), manufacturer:(o.manufacturer??"").trim(), condition:(o.condition??"").trim(), type:(o.type??"").trim(), engine:(o.engine===""||o.engine==null)?null:Number(o.engine), qty:(o.qty===""||o.qty==null)?0:parseInt(o.qty,10), price:(o.price===""||o.price==null)?0:Number(o.price), images:Array.isArray(o.images)?o.images:String(o.images||"").split("|").map(s=>s.trim()).filter(Boolean)}; if(!Number.isFinite(out.engine)) out.engine=null; if(!Number.isFinite(out.price)) out.price=0; if(!Number.isInteger(out.qty)||out.qty<0) out.qty=0; out.availability=productAvailabilityForQty(out.qty); return out; }
function validateItem(item){ const errors=[]; if(!item.number&&!item.oem) errors.push("должен быть number или oem"); if(item.condition&&!ALLOWED_CONDITIONS.has(item.condition)) errors.push("condition должен быть 'Нове' или 'Відновлене'"); if(item.type&&!ALLOWED_TYPES.has(item.type)) errors.push("type должен быть 'Форсунка' | 'ТНВД' | 'Клапан'"); if(item.availability&&!ALLOWED_AVAIL.has(item.availability)) errors.push("availability должен быть 'В наявності' | 'Під замовлення'"); if(item.price<0) errors.push("price не может быть отрицательным"); if(item.qty<0) errors.push("qty не может быть отрицательным"); return errors; }
async function findExistingId(item){ if(item.id) return item.id; const keys=[]; if(item.number) keys.push(normalizeKey(item.number)); if(item.oem) keys.push(normalizeKey(item.oem)); if(!keys.length) return null; const or=keys.map(k=>`number.ilike.%${k}%`).concat(keys.map(k=>`oem.ilike.%${k}%`)).join(","); const {data,error}=await supaAdmin.from("products").select("id,number,oem").or(or).limit(50); if(error||!data||!data.length) return null; for(const p of data){ if((p.number&&normalizeKey(p.number)===normalizeKey(item.number))||(p.oem&&normalizeKey(p.oem)===normalizeKey(item.oem))) return p.id; } return data[0].id; }

app.get("/api/admin/export.json", requireAdmin, async (_req,res)=>{
  try{ const items=await fetchAllProducts(); res.setHeader("Content-Type","application/json; charset=utf-8"); res.setHeader("Content-Disposition","attachment; filename=products.json"); res.json(items.map(shapeForExport)); }
  catch(e){ console.error("[GET /api/admin/export.json] error:", e); res.status(500).json({error:String(e.message||e)}); }
});

app.get("/api/admin/export.csv", requireAdmin, async (_req,res)=>{
  try{ const items=await fetchAllProducts(); const csv=csvStringify(items.map(shapeForExport)); res.setHeader("Content-Type","text/csv; charset=utf-8"); res.setHeader("Content-Disposition","attachment; filename=products.csv"); res.send(csv); }
  catch(e){ console.error("[GET /api/admin/export.csv] error:", e); res.status(500).json({error:String(e.message||e)}); }
});

const uploadOne = multer({ storage: multer.memoryStorage() });
app.post("/api/admin/import", requireAdmin, uploadOne.single("file"), async (req,res)=>{
  try{
    const dryRun=String(req.query.dryRun||req.body?.dryRun||"0")==="1";
    const mode=String(req.query.mode||req.body?.mode||"upsert"); // upsert | replace
    let rows=[];
    if(req.file?.buffer){
      const text=req.file.buffer.toString("utf8");
      rows = (/^\s*\[/.test(text)) ? JSON.parse(text) : parseCSV(text);
    }else if(Array.isArray(req.body)){ rows=req.body; }
      else if(req.body && Array.isArray(req.body.items)){ rows=req.body.items; }
      else { return res.status(400).json({error:"нет данных для импорта"}); }

    const items=rows.map(shapeIncoming);
    const report={updated:0, created:0, replaced:0, errors:[], total:items.length};

    const seen=new Set();
    for(let i=0;i<items.length;i++){
      const it=items[i];
      const key=normalizeKey(it.number||it.oem||("ROW"+i));
      if(seen.has(key)) report.errors.push({row:i+1, error:"дубль в файле по number/oem"});
      seen.add(key);
      const errs=validateItem(it); if(errs.length) report.errors.push({row:i+1, error:errs.join("; ")});
    }
    if(report.errors.length && !dryRun) return res.status(400).json({ok:false, ...report});

    if(mode==="replace" && !dryRun){
      const {error:delErr}=await supaAdmin.from("products").delete().neq("id",-1);
      if(delErr) throw delErr; report.replaced=1;
    }

    if(!dryRun){
      for(let i=0;i<items.length;i++){
        const it=items[i]; const id=await findExistingId(it);
        const payload={...it}; delete payload.id;
        if(id){
          const {error}=await supaAdmin.from("products").update(payload).eq("id", id);
          if(error) report.errors.push({row:i+1, error:String(error.message||error)}); else report.updated++;
        } else {
          const {error}=await supaAdmin.from("products").insert(payload);
          if(error) report.errors.push({row:i+1, error:String(error.message||error)}); else report.created++;
        }
      }
    }
    res.json({ok:true, mode, dryRun, ...report});
  }catch(e){ console.error("[POST /api/admin/import] error:", e); res.status(500).json({error:String(e.message||e)}); }
});


// === Inventory sync from Google Sheets (Автоекспорт) ===
app.post("/api/inventory/sync", async (req, res) => {
  try {
    const syncKey = req.get("x-sync-key");
    if (!syncKey || syncKey !== process.env.SYNC_KEY) {
      return res.status(401).json({ ok: false, error: "unauthorized" });
    }
    const items = Array.isArray(req.body.items) ? req.body.items : [];
    let updated = 0, notFound = [];

    for (const it of items) {
      const sku = String(it.sku || "").trim();
      const qty = Number(it.qty);
      if (!sku || Number.isNaN(qty)) continue;

      // find product by sku (preferred)
      let prod = null;
      let { data, error } = await supaAdmin
        .from("products")
        .select("id, qty, sku, number")
        .eq("sku", sku)
        .single();

      if (!data || error) {
        // fallback: some projects still use "number" as external code
        const r2 = await supaAdmin
          .from("products")
          .select("id, qty, sku, number")
          .eq("number", sku)
          .single();
        data = r2.data; error = r2.error;
      }

      if (!data || error) { notFound.push(sku); continue; }

      // update qty
      const before = Number(data.qty || 0);
      const after = qty;
      const up = await supaAdmin.from("products").update({
        qty: after,
        availability: productAvailabilityForQty(after),
      }).eq("id", data.id);
      if (up.error) continue;

      // log movement if table exists
      try {
        await supaAdmin.from("inventory_movements").insert({
          product_id: data.id,
          qty_before: before,
          qty_after: after,
          delta: after - before,
          reason: "sync",
          ref: "sheets",
          operator: "auto"
        });
      } catch (_e) {}

      updated++;
    }

    res.json({ ok: true, updated, notFound });
  } catch (e) {
    console.error("[POST /api/inventory/sync] error:", e);
    res.status(500).json({ ok: false, error: String(e.message || e) });
  }
});
/* === ВАЖНО ДЛЯ RENDER === */
app.listen(process.env.PORT || 10000, "0.0.0.0", () => { console.log("API server listening on port", process.env.PORT || 10000); });
// IP check for admin UI
app.get("/api/admin/allow-ip", (req, res) => {
  const ip = getClientIP(req);
  res.json({ allowed: isIpAllowed(ip), ip, allowlist: ADMIN_IPS });
});
