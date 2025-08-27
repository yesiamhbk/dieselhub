import express from "express";
import cors from "cors";
import { createClient } from "@supabase/supabase-js";

const PORT = process.env.PORT || 10000;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || "";
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID || "";
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || "";

const app = express();
// при желании ограничим доменом сайта
app.use(cors({ origin: "*" }));
app.use(express.json({ limit: "2mb" }));

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function tgSend(text, opts = {}) {
  try {
    if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) return;
    const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text, parse_mode: opts.parse_mode || "Markdown" })
    });
  } catch (e) {
    console.error("Telegram error:", e?.message || e);
  }
}

function formatMoney(n) {
  try { 
    const num = Number(n || 0);
    return new Intl.NumberFormat("uk-UA").format(num) + " ₴";
  } catch { return String(n); }
}

function pickUTM(body) {
  const u = body?.utm || {};
  return {
    utm_source: body.utm_source || u.utm_source || null,
    utm_medium: body.utm_medium || u.utm_medium || null,
    utm_campaign: body.utm_campaign || u.utm_campaign || null,
    utm_term: body.utm_term || u.utm_term || null,
    utm_content: body.utm_content || u.utm_content || null,
    gclid: body.gclid || u.gclid || null,
    landing_url: body.landing_url || u.landing_url || null,
    referrer: body.referrer || u.referrer || null,
  };
}

app.post("/api/order", async (req, res) => {
  try {
    const {
      name, phone, comment,
      delivery_type, delivery_city, delivery_branch,
      items = [], total = 0,
    } = req.body || {};

    if (!name || !phone || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ ok: false, error: "INVALID_ORDER_DATA" });
    }

    const utm = pickUTM(req.body);

    const { data: orderInsert, error: orderErr } = await supabase
      .from("orders")
      .insert([{
        name, phone, comment: comment || null,
        delivery_type: delivery_type || null,
        delivery_city: delivery_city || null,
        delivery_branch: delivery_branch || null,
        total,
        ...utm
      }])
      .select("*")
      .single();

    if (orderErr) {
      console.error("Insert order error:", orderErr);
      return res.status(500).json({ ok: false, error: "DB_ORDER_INSERT_FAILED" });
    }

    const orderId = orderInsert.id;

    const itemsPayload = items.map((it) => ({
      order_id: orderId,
      product_id: it.id || it.product_id || null,
      number: it.number || null,
      oem: it.oem || null,
      state: it.state || it.stan || null,
      price: it.price || 0,
      qty: it.qty || it.quantity || 1,
    }));
    if (itemsPayload.length) {
      const { error: itemsErr } = await supabase.from("order_items").insert(itemsPayload);
      if (itemsErr) console.error("Insert items error:", itemsErr);
    }

    const utmLineParts = [];
    if (utm.utm_source) utmLineParts.push(`src:${utm.utm_source}`);
    if (utm.utm_medium) utmLineParts.push(`med:${utm.utm_medium}`);
    if (utm.utm_campaign) utmLineParts.push(`cmp:${utm.utm_campaign}`);
    if (utm.gclid) utmLineParts.push(`gclid:${utm.gclid}`);
    const utmLine = utmLineParts.length ? `\nUTM: ${utmLineParts.join(" | ")}` : "";
    const landRef = (utm.landing_url || utm.referrer) ? `\nURL: ${utm.landing_url || ""}\nRef: ${utm.referrer || ""}` : "";

    const itemsText = itemsPayload.map((p, idx) => {
      const sum = (Number(p.price||0) * Number(p.qty||1)) || 0;
      return `${idx+1}) ${p.number || p.product_id || ""} • ${formatMoney(p.price)} × ${p.qty} = ${formatMoney(sum)}`;
    }).join("\n");

    const text = [
      `*Нове замовлення #${orderId}*`,
      `👤 ${name} | 📞 ${phone}`,
      comment ? `💬 ${comment}` : null,
      delivery_type ? `🚚 ${delivery_type} — ${delivery_city || ""} ${delivery_branch || ""}`.trim() : null,
      `—`,
      itemsText,
      `—`,
      `Сума: *${formatMoney(total)}*`,
      utmLine || null,
      landRef || null,
    ].filter(Boolean).join("\n");

    tgSend(text).catch(()=>{});

    return res.json({ ok: true, id: orderId });
  } catch (e) {
    console.error("Order error:", e?.message || e);
    return res.status(500).json({ ok: false, error: "ORDER_FAILED" });
  }
});

function assertAdmin(req, res, next) {
  const token = req.headers["x-admin-token"] || req.headers["X-Admin-Token"];
  if (!ADMIN_TOKEN || token !== ADMIN_TOKEN) {
    return res.status(401).json({ ok: false, error: "UNAUTHORIZED" });
  }
  next();
}

app.get("/api/admin/orders", assertAdmin, async (req, res) => {
  try {
    const { data: orders, error } = await supabase
      .from("orders").select("*, order_items(*)")
      .order("id", { ascending: false }).limit(1000);

    if (error) return res.status(500).json({ ok: false, error: "DB_LIST_FAILED" });
    return res.json({ ok: true, count: orders?.length || 0, orders });
  } catch (e) {
    return res.status(500).json({ ok: false, error: "LIST_FAILED" });
  }
});

app.get("/api/admin/orders.csv", assertAdmin, async (req, res) => {
  try {
    const { data: orders, error } = await supabase
      .from("orders").select("*, order_items(*)")
      .order("id", { ascending: false }).limit(1000);

    if (error) return res.status(500).send("DB error");
    const lines = [];
    lines.push(["id","created_at","name","phone","delivery_type","delivery_city","delivery_branch","total",
      "utm_source","utm_medium","utm_campaign","utm_term","utm_content","gclid","landing_url","referrer",
      "items_count","items_detail"].join(","));
    for (const o of (orders || [])) {
      const items = o.order_items || [];
      const detail = items.map(it => `${it.number||it.product_id||""} x${it.qty} @${it.price}`).join(" | ");
      const row = [
        o.id, o.created_at, `"${(o.name||"").replaceAll('"','""')}"`, `"${(o.phone||"").replaceAll('"','""')}"`,
        o.delivery_type||"", `"${(o.delivery_city||"").replaceAll('"','""')}"`, `"${(o.delivery_branch||"").replaceAll('"','""')}"`,
        o.total||0, o.utm_source||"", o.utm_medium||"", o.utm_campaign||"", o.utm_term||"", o.utm_content||"", o.gclid||"",
        `"${(o.landing_url||"").replaceAll('"','""')}"`, `"${(o.referrer||"").replaceAll('"','""')}"`,
        items.length, `"${detail.replaceAll('"','""')}"`
      ].join(",");
      lines.push(row);
    }
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.send(lines.join("\n"));
  } catch (e) {
    res.status(500).send("CSV export failed");
  }
});

app.use(express.static("dist"));
app.use(express.static("public"));

app.get("*", (req, res) => {
  res.sendFile(process.cwd() + "/dist/index.html");
});

app.listen(PORT, () => console.log("Server listening on", PORT));
