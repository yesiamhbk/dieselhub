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
  NP_API_KEY,            // новый ключ (предпочтительно)
  NOVA_POSHTA_KEY,       // совместимость с предыдущим именем
} = process.env;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("No SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env");
  process.exit(1);
}

// ====== Supabase (admin) ======
const supaAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// ====== простая админ-авторизация ======
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
      .select("id,number,oem,cross,manufacturer,condition,type,availability,qty,price,engine,images")
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
    const src = req.body || {};
    const allowed = ["price","qty","availability","number","oem","cross","manufacturer","condition","type","engine","images"];
    const payload = Object.fromEntries(Object.entries(src).filter(([k]) => allowed.includes(k)));
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
    const allowed = ["price","qty","availability","number","oem","cross","manufacturer","condition","type","engine","images"];
    const patch = {};
    for (const k of allowed) if (k in src && src[k] !== undefined) patch[k] = src[k];
    if (Object.keys(patch).length === 0) return res.json({ ok: true });
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

// ===== Совместимость со старыми путями (/api/nova/...) =====
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
async function fetchAllProducts(){ const {data,error}=await supaAdmin.from("products").select("id,number,oem,cross,manufacturer,condition,type,availability,qty,price,engine,images").order("id",{ascending:true}); if(error) throw error; return data||[]; }
function shapeForExport(p){ return { id:p.id??"", number:p.number??"", oem:p.oem??"", cross:Array.isArray(p.cross)?p.cross.join("|"):"", manufacturer:p.manufacturer??"", condition:p.condition??"", type:p.type??"", engine:p.engine??"", availability:p.availability??"", qty:p.qty??0, price:p.price??0, images:Array.isArray(p.images)?p.images.join("|"):"" }; }
const ALLOWED_CONDITIONS=new Set(["Нове","Відновлене"]); const ALLOWED_TYPES=new Set(["Форсунка","ТНВД","Клапан"]); const ALLOWED_AVAIL=new Set(["В наявності","Під замовлення"]);
function shapeIncoming(o){ const out={ id:o.id??null, number:(o.number??"").trim(), oem:(o.oem??"").trim(), cross:Array.isArray(o.cross)?o.cross:String(o.cross||"").split("|").map(s=>s.trim()).filter(Boolean), manufacturer:(o.manufacturer??"").trim(), condition:(o.condition??"").trim(), type:(o.type??"").trim(), engine:(o.engine===""||o.engine==null)?null:Number(o.engine), availability:(o.availability??"").trim(), qty:(o.qty===""||o.qty==null)?0:parseInt(o.qty,10), price:(o.price===""||o.price==null)?0:Number(o.price), images:Array.isArray(o.images)?o.images:String(o.images||"").split("|").map(s=>s.trim()).filter(Boolean)}; if(!Number.isFinite(out.engine)) out.engine=null; if(!Number.isFinite(out.price)) out.price=0; if(!Number.isInteger(out.qty)||out.qty<0) out.qty=0; return out; }
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

/* === ВАЖНО ДЛЯ RENDER === */
app.listen(process.env.PORT || 10000, "0.0.0.0", () => { console.log("API server listening on port", process.env.PORT || 10000); });
