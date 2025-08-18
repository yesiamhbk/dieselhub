// server.mjs
import express from "express";
import cors from "cors";
import multer from "multer";
import { createClient } from "@supabase/supabase-js";

const app = express();
app.use(cors());
app.use(express.json({ limit: "5mb" }));

const {
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  ADMIN_TOKEN,
  TELEGRAM_BOT_TOKEN,
  TELEGRAM_CHAT_ID,
} = process.env;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("No SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env");
  process.exit(1);
}

// админ-клиент по service role
const supaAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// простая админ-авторизация
function requireAdmin(req, res, next) {
  const token = req.header("x-admin-token");
  if (!token || token !== ADMIN_TOKEN) return res.status(401).json({ error: "unauthorized" });
  next();
}

app.get("/api/health", (_req, res) => res.json({ ok: true }));

// ===== Диагностика подключения (что видит сервер) =====
app.get("/api/debug/db", async (_req, res) => {
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
      .select("*")
      .order("id", { ascending: true });
    if (error) throw error;
    res.json(data || []);
  } catch (e) {
    console.error("[/api/products] error:", e);
    res.status(500).json({ error: String(e.message || e) });
  }
});

// Создание/апсерта товара
app.post("/api/admin/product", requireAdmin, async (req, res) => {
  try {
    const payload = req.body;
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
    const allowed = [
      "price", "qty", "availability", "number", "oem",
      "cross", "manufacturer", "condition", "type", "engine", "models", "images",
    ];
    const patch = {};
    for (const k of allowed) if (k in src && src[k] !== undefined) patch[k] = src[k];
    if (Object.keys(patch).length === 0) return res.json({ ok: true });

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
    if (!Array.isArray(body.items) || body.items.length === 0) {
      return res.status(400).json({ error: "no items" });
    }

    const name = String(body.name || "").trim();
    const phone = String(body.phone || "").trim();
    const delivery = String(body.delivery || "Нова пошта");
    const total = Number(body.total || 0);

    const itemsText = body.items
      .map(i => `• ${i.number || i.id} | OEM: ${i.oem || "—"} | ${i.qty} шт × ${i.price} ₴`)
      .join("\n");

    const text =
      `🛒 *Нове замовлення*\n` +
      `👤 ${name}\n` +
      `📞 ${phone}\n` +
      `🚚 ${delivery}\n\n` +
      `${itemsText}\n\n` +
      `Σ Разом: *${total.toLocaleString("uk-UA")} ₴*`;

    if (TELEGRAM_BOT_TOKEN && TELEGRAM_CHAT_ID) {
      const tgUrl = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
      await fetch(tgUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text, parse_mode: "Markdown" }),
      });
    }

    res.json({ ok: true });
  } catch (e) {
    console.error("[POST /api/order] error:", e);
    res.status(500).json({ error: String(e.message || e) });
  }
});

/* === ВАЖНО ДЛЯ RENDER === */
const PORT = process.env.PORT || 8787;   // <-- Render даст свой порт
app.listen(PORT, "0.0.0.0", () => console.log(`API server on :${PORT}`));
