import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";

const app = express();
app.use(express.json());
app.use(cors());

// === ENV ===
const PORT = Number(process.env.PORT || 8787);
const NODE_ENV = process.env.NODE_ENV || "production";
const ADMIN_TOKEN = (process.env.ADMIN_TOKEN || "").trim();
const SUPABASE_URL = process.env.SUPABASE_URL || "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

const supabase = (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY)
  ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
  : null;

// === helpers ===
function readAdminToken(req) {
  const h = req.header("x-admin-token") || "";
  if (h) return String(h).trim();
  const a = req.header("authorization") || req.header("Authorization") || "";
  if (a && typeof a === "string" && a.startsWith("Bearer ")) return a.slice(7).trim();
  return "";
}

function requireAdmin(req, res, next) {
  if (!ADMIN_TOKEN) {
    return res.status(401).json({ ok: false, error: "ADMIN_TOKEN not set on server" });
  }
  const t = readAdminToken(req);
  if (t !== ADMIN_TOKEN) {
    return res.status(401).json({ ok: false, error: "Invalid token" });
  }
  return next();
}

// === health ===
app.get("/api/health", (_req, res) => res.json({ ok: true }));

// === admin ping ===
app.get("/api/admin/ping", requireAdmin, (_req, res) => {
  res.json({ ok: true, message: "Admin access granted" });
});

// === debug db ===
app.get("/api/debug/db", async (_req, res) => {
  try {
    const projectRef = (SUPABASE_URL.split("https://")[1] || "").split(".")[0] || "";
    if (!supabase) {
      return res.json({ ok: true, projectRef, supabaseUrl: SUPABASE_URL, productsCount: 0, error: null });
    }
    const { count, error } = await supabase
      .from("products")
      .select("*", { count: "exact", head: true });
    return res.json({
      ok: true,
      projectRef,
      supabaseUrl: SUPABASE_URL,
      productsCount: count || 0,
      error: error ? error.message : null,
    });
  } catch (e) {
    return res.status(200).json({ ok: false, error: String(e) });
  }
});

// === public products ===
app.get("/api/products", async (_req, res) => {
  if (!supabase) return res.json({ items: [] });
  try {
    const { data, error } = await supabase
      .from("products")
      .select("*")
      .order("id", { ascending: false })
      .limit(200);
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ items: data || [] });
  } catch (e) {
    return res.status(500).json({ error: "unexpected" });
  }
});

// === SPA static in production ===
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const distPath = path.join(__dirname, "dist");

if (NODE_ENV === "production") {
  app.use(express.static(distPath));
  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/api")) return next();
    res.sendFile(path.join(distPath, "index.html"));
  });
}

app.listen(PORT, () => {
  console.log(`[diesel-api] listening on :${PORT} (env=${NODE_ENV})`);
});
