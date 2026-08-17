// src/admin.jsx
import React, { useEffect, useMemo, useState } from "react";



// Базовый URL API для продакшна (например, https://diesel-api.onrender.com)
// ЛОКАЛЬНО можно оставить пустым (тогда будут ходить на /api через прокси Vite)
const API = import.meta.env.VITE_API_BASE || "";
const IS_LOCAL_DEV = import.meta.env.DEV;
const LOCAL_ADMIN_TOKEN = "local-only-placeholder";

/* ===== мини-компоненты ===== */
function FieldLabel({ label, required = false, hint = "" }) {
  return (
    <div className="mb-2 flex items-baseline justify-between gap-3">
      <span className="text-sm font-medium text-neutral-100">
        {label}
        {required && <span className="ml-1 text-[#76DAD8]">*</span>}
      </span>
      {hint && <span className="text-xs text-neutral-500">{hint}</span>}
    </div>
  );
}

function Input({ label, required = false, hint = "", ...props }) {
  return (
    <label className="block">
      <FieldLabel label={label} required={required} hint={hint} />
      <input
        {...props}
        required={required}
        className={
          "w-full rounded-xl bg-[#071516] border border-[#173536] px-3.5 py-3 text-sm text-neutral-100 outline-none transition placeholder:text-neutral-600 hover:border-[#245052] focus:border-[#34B7B7] focus:ring-2 focus:ring-[#34B7B7]/15 " +
          (props.className || "")
        }
      />
    </label>
  );
}
function Textarea({ label, required = false, hint = "", ...props }) {
  return (
    <label className="block">
      <FieldLabel label={label} required={required} hint={hint} />
      <textarea
        {...props}
        required={required}
        className={
          "w-full min-h-[104px] resize-y rounded-xl bg-[#071516] border border-[#173536] px-3.5 py-3 text-sm text-neutral-100 outline-none transition placeholder:text-neutral-600 hover:border-[#245052] focus:border-[#34B7B7] focus:ring-2 focus:ring-[#34B7B7]/15 " +
          (props.className || "")
        }
      />
    </label>
  );
}

function SelectField({ label, hint = "", children, ...props }) {
  return (
    <label className="block">
      <FieldLabel label={label} hint={hint} />
      <select
        {...props}
        className={
          "w-full rounded-xl bg-[#071516] border border-[#173536] px-3.5 py-3 text-sm text-neutral-100 outline-none transition hover:border-[#245052] focus:border-[#34B7B7] focus:ring-2 focus:ring-[#34B7B7]/15 " +
          (props.className || "")
        }
      >
        {children}
      </select>
    </label>
  );
}

/* ===== константы ===== */
const MANUFACTURERS = ["Bosch", "Denso", "Delphi", "Siemens VDO", "Continental"];
const CONDITIONS = ["Нове", "Відновлене"];
const TYPES = ["Форсунка", "ПНВТ", "Клапан", "Пружина розпилювача", "Ремкомплект", "Коннектор", "Гайка", "Розпилювач форсунки", "Клапан керування форсунки", "Гайка розпилювача форсунки", "Регулятор тиску", "Плунжерна пара", "Ремкомплект прокладок", "ПННТ", "Кришка ПННТ", "Пластина ПННТ", "Сальник ПНВТ", "Ремкомплект ПНВТ (напрямний ролик + башмак штовхача)", "Підшипник ПНВТ Delphi (великий)", "Клапан дозування палива насоса", "Вал ПНВТ", "Підшипник ПНВТ Delphi (малий)", "Підкачувальний насос у повному комплекті", "Напрямний ролик ПНВТ", "Штовхач ПНВТ", "Фланець насоса"];
const AVAILABILITIES = ["В наявності", "Під замовлення"];

function createEmptyProductForm() {
  return {
    number: "",
    oem: "",
    cross: "",
    compat_for: "",
    manufacturer: MANUFACTURERS[0],
    condition: CONDITIONS[0],
    type: TYPES[0],
    availability: AVAILABILITIES[1],
    qty: "0",
    price: "0",
    engine: "",
    images: "",
    pinned: false,
    sort_order: "0",
  };
}

function availabilityForQty(value) {
  return Number(value) > 0 ? AVAILABILITIES[0] : AVAILABILITIES[1];
}

/* ===== страница ===== */
export default function AdminPanel() {
  // Guard admin UI by IP (server-side check) — inside component
  const [ipAllowed, setIpAllowed] = useState(null);
  useEffect(() => {
    if (IS_LOCAL_DEV) {
      setIpAllowed(true);
      return;
    }
    (async () => {
      try {
        const base = import.meta.env.VITE_API_BASE || "";
        const r = await fetch(base + "/api/admin/allow-ip");
        const j = await r.json();
        setIpAllowed(!!j.allowed);
      } catch (e) { setIpAllowed(false); }
    })();
  }, []);
  if (ipAllowed === false) {
    return (
      <div className="min-h-screen bg-black text-center text-neutral-300 flex items-center justify-center">
        <div className="p-6 rounded-xl border border-neutral-800 bg-neutral-950 max-w-md">
          <div className="text-xl font-semibold mb-2">Доступ за IP заборонено</div>
          <div className="text-sm text-neutral-400">Ваш IP не у білому списку. Зверніться до адміністратора.</div>
        </div>
      </div>
    );
  }

  /* --- токен --- */
  const storedToken = localStorage.getItem("dh_admin_token") || "";
  const [token, setToken] = useState(storedToken);
  const [tokenInput, setTokenInput] = useState("");
  const [localDemoAdmin, setLocalDemoAdmin] = useState(IS_LOCAL_DEV && storedToken === LOCAL_ADMIN_TOKEN);
  
  // --- статус API/токена ---
  const [apiOk, setApiOk] = useState(null); // null=неизвестно, true=OK, false=нет доступа

  // Унифицированный fetch для админ-эндпоинтов: подставляет токен и авто-логаут при 401
  async function adminFetch(path, opts = {}) {
    if (localDemoAdmin) {
      const method = String(opts.method || "GET").toUpperCase();
      if (method === "GET" && path === "/api/admin/export.json") return fetch("/__demo/products.json");
      if (method === "GET" && path === "/api/admin/orders") {
        return new Response(JSON.stringify([]), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      if (method === "GET" && path.startsWith("/api/admin/analytics")) {
        return new Response(JSON.stringify({ days: 30, funnel: { visitors: 0, searches: 0, found: 0, add_to_cart: 0, checkout_start: 0, orders: 0, zero_results: 0, zero_result_leads: 0 }, lost_demand: [], sources: [] }), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      return new Response(JSON.stringify({ error: "Локальний демо-режим доступний лише для перегляду" }), {
        status: 403,
        headers: { "Content-Type": "application/json" },
      });
    }

    const headers = Object.assign({}, opts.headers || {}, token ? { "x-admin-token": token } : {});
    const resp = await fetch(`${API}${path}`, { ...opts, headers });
    if (resp.status === 401) {
      localStorage.removeItem("dh_admin_token");
      setToken("");
      setApiOk(false);
      alert("Невірний ADMIN_TOKEN. Увійдіть знову.");
    }
    return resp;
  }

  /* ===== ORDERS: state/helpers ===== */
  const [ordersOpen, setOrdersOpen] = useState(false);
  const [analyticsOpen, setAnalyticsOpen] = useState(false);
  const [analytics, setAnalytics] = useState(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  async function loadAnalytics() {
    setAnalyticsLoading(true);
    try { const response = await adminFetch("/api/admin/analytics?days=30"); if (!response.ok) throw new Error(); setAnalytics(await response.json()); }
    catch { setAnalytics(null); alert("Аналітика недоступна. Перевірте, чи застосована міграція."); }
    finally { setAnalyticsLoading(false); }
  }
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [orders, setOrders] = useState([]);
  const [ordersErr, setOrdersErr] = useState("");
  const [orderDetails, setOrderDetails] = useState(null);
  useEffect(() => {
    const lock = ordersOpen || analyticsOpen || !!orderDetails;
    const prev = document.body.style.overflow;
    if (lock) document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [ordersOpen, analyticsOpen, orderDetails]);
  const [orderStatus, setOrderStatus] = useState("");
  const [orderPayment, setOrderPayment] = useState("");
  const [orderComment, setOrderComment] = useState("");

  // Пошук по замовленнях
  const [ordersSearch, setOrdersSearch] = useState("");
  // Мапа реальних номерів (№) для кожного id по початковому списку (нові зверху)
  const seqMap = useMemo(() => new Map(orders.map((o, idx) => [o.id, orders.length - idx])), [orders]);
  const getOrderNumber = (order) => Number(order?.order_number) || seqMap.get(order?.id) || "—";
  const filteredOrders = useMemo(() => {
    const q = (ordersSearch || "").trim().toLowerCase();
    if (!q) return orders;
    const qDigits = q.replace(/\D/g, "");
    return orders.filter((o) => {
      const seq = String(getOrderNumber(o) || "");
      const name = (o.name || "").toLowerCase();
      const phoneDigits = (o.phone || "").replace(/\D/g, "");
      const status = (o.status || "").toLowerCase();
      if (qDigits && (seq === qDigits || phoneDigits.includes(qDigits))) return true;
      if (name.includes(q)) return true;
      if (status.includes(q)) return true;
      return false;
    });
  }, [orders, ordersSearch, seqMap]);

  function truncateText(s, n) {
    if (!s) return "";
    return s.length > n ? s.slice(0, n) + "…" : s;
  }
  const STATUS_OPTIONS = ['Новий','В обробці','Зарезервований','Оплачений','Відправлений','Виконаний','Скасовано','Повернення'];
  const money = (n) => Number(n||0).toLocaleString('uk-UA', { style:'currency', currency:'UAH', maximumFractionDigits:0 });
  const StatusBadge = ({status}) => {
    const map = {
      'Новий': 'bg-[#34B7B7]/10 text-[#76DAD8] border-[#34B7B7]/30',
      'В обробці': 'bg-blue-500/10 text-blue-300 border-blue-500/30',
      'Зарезервований': 'bg-amber-500/10 text-amber-300 border-amber-500/30',
      'Оплачений': 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30',
      'Відправлений': 'bg-cyan-500/10 text-cyan-300 border-cyan-500/30',
      'Виконаний': 'bg-green-500/10 text-green-300 border-green-500/30',
      'Скасовано': 'bg-rose-500/10 text-rose-300 border-rose-500/30',
      'Повернення': 'bg-orange-500/10 text-orange-300 border-orange-500/30',
    };
    return <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs ${map[status] || 'border-neutral-700 text-neutral-300'}`}>{status || '—'}</span>;
  };

  async function loadOrders() {
    try {
      setOrdersErr(""); setOrdersLoading(true);
      const r = await adminFetch(`/api/admin/orders`, { method:'GET' });
      if (!r.ok) throw new Error('http '+r.status);
      const data = await r.json();
      data.sort((a,b)=> new Date(b.created_at) - new Date(a.created_at));
      setOrders(data);
    } catch(e) {
      setOrdersErr("Не вдалося отримати замовлення");
    } finally { setOrdersLoading(false); }
  }

  async function openOrder(id, seq) {
    try {
      const r = await adminFetch(`/api/admin/orders/${id}`, { method:'GET' });
      if (!r.ok) throw new Error('http '+r.status);
      const data = await r.json();
      setOrderDetails({ ...data, seq });
      setOrderStatus(data.status || 'Новий');
      setOrderComment(data.admin_comment || '');
      setOrderPayment(data.payment || '');
    } catch(e) {
      alert('Не вдалося відкрити замовлення');
    }
  }

  async function saveOrderPayment() {
    if (!orderDetails) return;
    try {
      const r = await adminFetch(`/api/admin/orders/${orderDetails.id}`, {
        method:'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payment: orderPayment })
      });
      if (!r.ok) throw new Error('http '+r.status);
      const upd = await r.json();
      setOrderDetails(x => ({ ...x, payment: upd.payment }));
      alert('Збережено');
    } catch(e) { alert('Не вдалося зберегти спосіб оплати'); }
  }
  async function saveOrderStatus() {
    if (!orderDetails) return;
    try {
      const r = await adminFetch(`/api/admin/orders/${orderDetails.id}`, {
        method:'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: orderStatus, admin_comment: orderComment })
      });
      if (!r.ok) throw new Error('http '+r.status);
      const upd = await r.json();
      setOrders(list => list.map(o => o.id===upd.id ? { ...o, status: upd.status } : o));
      setOrderDetails(x => ({ ...x, status: upd.status }));
      alert('Збережено');
    } catch(e) { alert('Не вдалося зберегти статус'); }
  }

  // Проверка токена при входе + периодический пинг
  useEffect(() => {
    let timer;
    async function check() {
      if (!token) {
        setApiOk(false);
        return;
      }
      if (localDemoAdmin) {
        setApiOk(true);
        return;
      }
      try {
        const r = await adminFetch(`/api/admin/export.json`, { method: "GET" });
        if (r && r.ok) setApiOk(true); else if (r && r.status === 401) setApiOk(false); else setApiOk(false);
      } catch {
        setApiOk(false);
      }
    }
    check();
    // обновлять индикатор раз в 30 сек
    timer = setInterval(check, 30000);
    return () => clearInterval(timer);
  }, [token, localDemoAdmin]);
  const [err, setErr] = useState("");

  /* --- список товаров --- */
  async function patchProduct(id, patch) {
    const r = await adminFetch(`/api/admin/product/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    return r.ok;
  }
  async function changeQty(id, delta) {
    const p = products.find(x=>x.id===id);
    const next = Math.max(0, (Number(p?.qty)||0) + delta);
    const ok = await patchProduct(id, { qty: next });
    if (ok) setProducts(prev=>prev.map(x=> x.id===id ? { ...x, qty: next, availability: availabilityForQty(next) } : x));
  }
  // --- порядок и закрепление ---
  async function changeOrder(id, delta) {
    const p = products.find((x) => x.id === id);
    const cur = Number(p && p.sort_order != null ? p.sort_order : 0) || 0;
    const next = cur + (Number(delta) || 0);
    const ok = await patchProduct(id, { sort_order: next });
    if (ok) setProducts((arr) => arr.map((x) => (x.id === id ? { ...x, sort_order: next } : x)));
  }
  async function togglePinned(id) {
    const p = products.find((x) => x.id === id);
    const next = !Boolean(p && p.pinned);
    const ok = await patchProduct(id, { pinned: next });
    if (ok) setProducts((arr) => arr.map((x) => (x.id === id ? { ...x, pinned: next } : x)));
  }

  const [products, setProducts] = useState([]);
  const [photoEdit, setPhotoEdit] = useState(null); 
  const [productEdit, setProductEdit] = useState(null); // продукт для модалки редагування

  function openProductEdit(p) {
    setProductEdit({
      ...p,
      _crossText: Array.isArray(p.cross) ? p.cross.join(", ") : (p.cross || ""),
      _compatText: Array.isArray(p.compat_for) ? p.compat_for.join(", ") : (p.compat_for || ""),
      _imagesText: Array.isArray(p.images) ? p.images.join("\n") : (p.images || ""),
    });
  }
  function closeProductEdit() { setProductEdit(null); }

  async function saveProductEdit() {
    if (!productEdit) return;
    const editQty = Number(productEdit.qty) || 0;
    const editEngineText = String(productEdit.engine ?? "").trim().replace(",", ".");
    const editEngine = editEngineText === "" ? null : Number(editEngineText);
    if (editEngine !== null && (!Number.isFinite(editEngine) || editEngine <= 0)) {
      alert("Вкажіть коректний обʼєм або залиште поле порожнім");
      return;
    }
    const patch = {
      number: productEdit.number || "",
      oem: productEdit.oem || "",
      cross: String(productEdit._crossText || "").split(",").map(s=>s.trim()).filter(Boolean),
      compat_for: String(productEdit._compatText || "").split(",").map(s=>s.trim()).filter(Boolean),
      manufacturer: productEdit.manufacturer || "",
      condition: productEdit.condition || "",
      type: productEdit.type || "",
      availability: availabilityForQty(editQty),
      qty: editQty,
      price: Number(productEdit.price) || 0,
      engine: editEngine,
      images: String(productEdit._imagesText || "").split(/\r?\n/).map(s=>s.trim()).filter(Boolean),
    };
    const ok = await patchProduct(productEdit.id, patch);
    if (!ok) { alert("Не вдалося зберегти товар"); return; }
    try { setProducts(await fetchProductsRaw()); } catch {}
    closeProductEdit();
  }

  // продукт для модалки фото
  const [search, setSearch] = useState("");

  // вкладка для товарів: 'list' | 'add'
  const [productsTab, setProductsTab] = useState('list');
  // режим масового редагування
  const [editAll, setEditAll] = useState(false);
  // чернетки змін по товарам: { [id]: {field: value, ...} }
  const [draft, setDraft] = useState({});
  function setDraftField(id, field, value) {
    setDraft(prev => ({ ...prev, [id]: { ...(prev[id]||{}), [field]: value } }));
  }
  function resetDraft() { setDraft({}); }

  // допоміжне: отримати товари масивом (без setState)
  async function fetchProductsRaw() {
    try {
      const r = await fetch(localDemoAdmin ? "/__demo/products.json" : `${API}/api/products`);
      const d = await r.json();
      return Array.isArray(d) ? d : [];
    } catch {
      return [];
    }
  }

  async function loadProducts() {
    try {
      const r = await fetch(localDemoAdmin ? "/__demo/products.json" : `${API}/api/products`);
      const d = await r.json();
      setProducts(Array.isArray(d) ? d : []);
    } catch {
      setProducts([]);
    }
  }

  // безопасный рефреш списка + поддержка открытых модалок
  async function reloadProductsAndKeepModals() {
    try {
      const list = await fetchProductsRaw();
      setProducts(list);
      if (photoEdit) {
        const latest = list.find(x => x.id === photoEdit.id);
        if (latest) setPhotoEdit(latest);
      }
      if (productEdit) {
        const latest = list.find(x => x.id === productEdit.id);
        if (latest) {
          openProductEdit(latest);
        }
      }
    } catch {
      // ignore
    }
  }

  useEffect(() => {
    loadProducts();
  }, [localDemoAdmin]);

  const filteredProducts = useMemo(() => {
    const q = (search || "").trim().toLowerCase();
    if (!q) return products;
    return products.filter((p) => {
      const hay = `${p.number || ""} ${p.oem || ""}`.toLowerCase();
      return hay.includes(q);
    });
  }, [products, search]);

  /* --- форма добавления --- */
  const [f, setF] = useState(createEmptyProductForm);
  const [addNotice, setAddNotice] = useState("");
  const [addingProduct, setAddingProduct] = useState(false);

  const parseListComma = (s) =>
    (s || "")
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean);

  const parseLines = (s) =>
    (s || "")
      .split(/\r?\n/)
      .map((x) => x.trim())
      .filter(Boolean);

  // SKU генератор <number>-N|R
  function makeSku(number, condition) {
    const base = String(number || "").trim();
    if (!base) return "";
    if (/-[NR]$/i.test(base)) return base.toUpperCase();
    const suffix = condition === "Нове" ? "N" : "R";
    return `${base}-${suffix}`;
  }

  async function addProduct() {
    setErr("");
    setAddNotice("");
    if (!token) return setErr("Введіть адмін-токен");
    if (!f.number.trim()) return setErr("Номер деталі обовʼязковий");
    const price = f.price === "" ? 0 : Number(f.price);
    const qty = f.qty === "" ? 0 : Number(f.qty);
    const engineText = String(f.engine || "").trim().replace(",", ".");
    const engine = engineText === "" ? null : Number(engineText);
    if (!Number.isFinite(price) || price < 0) return setErr("Вкажіть коректну ціну");
    if (!Number.isInteger(qty) || qty < 0) return setErr("Кількість має бути цілим числом від 0");
    if (engine !== null && (!Number.isFinite(engine) || engine <= 0)) return setErr("Вкажіть коректний обʼєм або залиште поле порожнім");

    const payload = {
      number: f.number.trim(),
      oem: f.oem.trim() || null,
      cross: parseListComma(f.cross),
      compat_for: parseListComma(f.compat_for),
      manufacturer: f.manufacturer,
      condition: f.condition,
      type: f.type,
      availability: availabilityForQty(qty),
      qty,
      price,
      engine,
      images: parseLines(f.images),
      sort_order: Number(f.sort_order) || 0,
      pinned: !!f.pinned,
    };
    payload.sku = makeSku(payload.number, payload.condition);

    if (localDemoAdmin) {
      setProducts((current) => [
        {
          ...payload,
          id: `local-preview-${Date.now()}`,
          sku: payload.sku,
        },
        ...current,
      ]);
      setF(createEmptyProductForm());
      setProductsTab("list");
      setAddNotice("Товар додано до локального перегляду. Дані в Supabase не змінено.");
      return;
    }

    setAddingProduct(true);
    try {
      const r = await adminFetch(`/api/admin/product`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!r.ok) {
        const e = await r.json().catch(() => ({}));
        setErr(e.error || "Не вдалося додати товар");
        return;
      }

      setF(createEmptyProductForm());
      await reloadProductsAndKeepModals();
      setProductsTab("list");
      setAddNotice("Товар додано та збережено в каталозі Supabase.");
    } catch {
      setErr("Не вдалося додати товар. Перевірте зʼєднання з API.");
    } finally {
      setAddingProduct(false);
    }
  }

  async function delProduct(id) {
    if (!confirm("Видалити товар?")) return;
    const r = await adminFetch(`/api/admin/product/${id}`, {
      method: "DELETE",
    });
    if (!r.ok) {
      const e = await r.json().catch(() => ({}));
      alert(e.error || "Помилка");
      return;
    }
    if (productEdit && productEdit.id === id) setProductEdit(null);
    if (photoEdit && photoEdit.id === id) setPhotoEdit(null);
    await reloadProductsAndKeepModals();
    alert("Товар видалено");
  }

  // Сохраняем ТОЛЬКО редактируемые поля (цена/кол-во/наличие)
  async function saveProduct(p) {
    const qty = Number(p.qty || 0);
    const patch = {
      price: Number(p.price || 0),
      qty,
      availability: availabilityForQty(qty),
    };

    const r = await adminFetch(`/api/admin/product/${p.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });

    if (!r.ok) {
      const e = await r.json().catch(() => ({}));
      alert(e.error || "Помилка");
      return;
    }
    await reloadProductsAndKeepModals();
  }

  /* ===== загрузка/удаление картинок ===== */
  async function refreshPhotoModal(productId) {
    try {
      const list = await fetchProductsRaw();
      setProducts(list);
      if (photoEdit && photoEdit.id === productId) {
        const latest = list.find(x => x.id === productId);
        if (latest) setPhotoEdit(latest);
      }
    } catch {
      // ignore
    }
  }

  async function uploadImages(productId, files) {
    if (!files || !files.length) return;
    const fd = new FormData();
    for (const f of files) fd.append("files", f);

    const r = await adminFetch(`/api/admin/product/${productId}/upload`, {
      method: "POST",
      headers: { "x-admin-token": token }, // без Content-Type
      body: fd,
    });

    if (!r.ok) {
      const e = await r.json().catch(() => ({}));
      alert(e.error || "Помилка завантаження");
      return;
    }
    await refreshPhotoModal(productId);
  }

  async function deleteOneImage(productId, url) {
    const r = await adminFetch(`/api/admin/product/${productId}/image`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
    });
    if (!r.ok) {
      const e = await r.json().catch(() => ({}));
      alert(e.error || "Не вдалось видалити фото");
      return;
    }
    await refreshPhotoModal(productId);
  }

  /* ===== экран логина ===== */
  if (apiOk !== true) {
    return (
      <div className="min-h-screen bg-neutral-950 text-neutral-100 grid place-items-center">
        <div className="w-full max-w-md rounded-2xl border border-neutral-800 p-6">
          <div className="mb-4">
            <div className="font-semibold">Вхід до адмін-панелі</div>
            {IS_LOCAL_DEV && <div className="mt-1 text-xs text-neutral-400">Локальний демо-режим · лише перегляд</div>}
          </div>
          <input
            type="password"
            value={tokenInput}
            onChange={(e) => setTokenInput(e.target.value.trim())}
            className="w-full rounded-lg bg-neutral-900 border border-neutral-800 px-3 py-2 text-sm outline-none focus:border-[#34B7B7] mb-4"
          />
          <button
            onClick={async () => {
              setErr("");
              const candidate = (tokenInput || "").trim();
              if (!candidate) return;
              if (IS_LOCAL_DEV && candidate === LOCAL_ADMIN_TOKEN) {
                localStorage.setItem("dh_admin_token", candidate);
                setLocalDemoAdmin(true);
                setToken(candidate);
                setApiOk(true);
                return;
              }
              try {
                const r = await fetch(`${API}/api/admin/export.json`, { headers: { "x-admin-token": candidate } });
                if (!r.ok) { setErr("Неправильний ADMIN_TOKEN"); return; }
                localStorage.setItem("dh_admin_token", candidate);
                setToken(candidate);
                setApiOk(true);
              } catch (e) {
                setErr("Помилка з'єднання");
              }
            }}
            className="mt-4 w-full rounded-xl bg-[#34B7B7] text-neutral-950 font-semibold py-3 hover:brightness-90"
          >
            Увійти
          </button>
          {err && <div className="mt-3 text-red-400 text-sm">{err}</div>}
        </div>
      </div>
    );
  }

  /* ===== експорт/імпорт ===== */
  async function downloadAdmin(url, filename) {
    try {
      const r = await fetch(`${API}${url}`, { headers: { "x-admin-token": token } });
      if (!r.ok) {
        const e = await r.json().catch(() => ({}));
        alert(e.error || "Помилка при завантаженні");
        return;
      }
      const blob = await r.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    } catch {
      alert("Не вдалося завантажити файл");
    }
  }
  const exportCSV = () => downloadAdmin("/api/admin/export.csv", "products.csv");
  const exportJSON = () => downloadAdmin("/api/admin/export.json", "products.json");

  async function handleImportFile(file) {
    if (!file) return;
    try {
      const fd = new FormData();
      fd.append("file", file);
      // dry-run спочатку
      let r = await adminFetch(`/api/admin/import?dryRun=1&mode=upsert`, {
        method: "POST",
        headers: { "x-admin-token": token },
        body: fd,
      });
      const preview = await r.json().catch(() => ({}));
      if (!r.ok) {
        alert("Помилка під час перевірки: " + (preview.error || "невідома"));
        return;
      }
      if (Array.isArray(preview.errors) && preview.errors.length) {
        const first = preview.errors.slice(0, 5).map(e => `рядок ${e.row}: ${e.error}`).join("\n");
        alert(`Знайдено помилки (${preview.errors.length}):\n${first}${preview.errors.length>5 ? "\n..." : ""}`);
        return;
      }
      const ok = confirm(`Імпортувати?\nУсього: ${preview.total}\nОновиться: ~${preview.updated}\nДодасться: ~${preview.created}`);
      if (!ok) return;
      // реальний імпорт
      r = await adminFetch(`/api/admin/import?dryRun=0&mode=upsert`, {
        method: "POST",
        headers: { "x-admin-token": token },
        body: fd,
      });
      const rep = await r.json().catch(() => ({}));
      if (!r.ok || rep.error) {
        alert("Помилка імпорту: " + (rep.error || "невідома"));
        return;
      }
      alert(`Готово. Оновлено: ${rep.updated || 0}, Додано: ${rep.created || 0}`);
      await reloadProductsAndKeepModals();
    } catch (e) {
      alert("Не вдалося імпортувати файл");
    } finally {
      const el = document.getElementById("admin-import-file");
      if (el) el.value = "";
    }
  }
    
  /* === КОПИРОВАНИЕ В GOOGLE SHEETS (TSV) И ВСТАВКА ИЗ SHEETS === */
  const COLS = ["id","number","oem","cross","manufacturer","condition","type","engine","availability","qty","price","images"];

  const normKey = (s) => String(s || "").toUpperCase().replace(/[\s\-_.]/g, "");

  function shapeForExportLocal(p) {
    return {
      id: p.id ?? "",
      number: p.number ?? "",
      oem: p.oem ?? "",
      cross: Array.isArray(p.cross) ? p.cross.join("|") : (p.cross ?? ""),
      manufacturer: p.manufacturer ?? "",
      condition: p.condition ?? "",
      type: p.type ?? "",
      engine: p.engine ?? "",
      availability: p.availability ?? "",
      qty: p.qty ?? 0,
      price: p.price ?? 0,
      images: Array.isArray(p.images) ? p.images.join("|") : (p.images ?? ""),
    };
  }

  function makeTSVFromProducts() {
    const rows = (products || []).map(shapeForExportLocal);
    if (!rows.length) return "";
    const head = COLS.join("\t");
    const esc = (v) => String(v == null ? "" : v).replace(/\t/g, " ").replace(/\r?\n/g, " ");
    const body = rows.map(r => COLS.map(k => esc(r[k])).join("\t")).join("\n");
    return head + "\n" + body;
  }

  async function exportCSVToClipboard() {
    const tsv = makeTSVFromProducts();
    if (!tsv) { alert("Список порожній"); return; }
    await navigator.clipboard.writeText(tsv);
    alert("Скопійовано — просто вставляйте у Google Sheets (Cmd/Ctrl+V).");
  }

  function parseClipboardTable(text) {
    const raw = String(text || "").replace(/\r\n?/g, "\n").trim();
    if (!raw) return [];
    const delim = raw.includes("\t") ? "\t" : (raw.includes(";") && !raw.includes(",") ? ";" : ",");
    const lines = raw.split("\n").filter(l => l.trim().length);
    const rows = lines.map(l => l.split(delim).map(s => s.replace(/^"|"$|^'|'$/g, "").trim()));
    if (!rows.length) return [];
    const header = rows[0].map(h => h.trim().toLowerCase());
    const idx = {}; COLS.forEach(c => idx[c] = header.indexOf(c));
    let start = 1;
    if (idx["number"] === -1 && idx["oem"] === -1) {
      start = 0;
      COLS.forEach((c, i) => idx[c] = i < rows[0].length ? i : -1);
    }
    const items = [];
    for (let r = start; r < rows.length; r++) {
      const row = rows[r]; const o = {};
      for (const k of COLS) { const j = idx[k]; o[k] = j >= 0 ? (row[j] ?? "") : ""; }
      if (o.number || o.oem) items.push(o);
    }
    return items;
  }

  async function importFromClipboard() {
    try {
      let text = "";
      if (navigator.clipboard?.readText) text = await navigator.clipboard.readText();
      if (!text) text = prompt("Вставте сюди дані з Google Sheets (CSV/TSV):", "");
      if (!text) return;

      const rows = parseClipboardTable(text);
      if (!rows.length) { alert("Немає даних для імпорту"); return; }

      const toPayload = (r) => ({
        number: r.number || "",
        oem: r.oem || "",
        cross: String(r.cross || "").split(/[|,]/).map(s => s.trim()).filter(Boolean),
        manufacturer: r.manufacturer || "",
        condition: r.condition || "",
        type: r.type || "",
        availability: r.availability || "",
        qty: Number(r.qty) || 0,
        price: Number(r.price) || 0,
        engine: (r.engine === "" || r.engine == null) ? null : Number(r.engine),
        images: String(r.images || "").split("|").map(s => s.trim()).filter(Boolean),
      });

      let updated = 0, created = 0, failed = 0;
      for (const r of rows) {
        const payload = toPayload(r);
        let targetId = r.id ? Number(r.id) : null;
        if (!targetId) {
          const rn = normKey(r.number), ro = normKey(r.oem);
          const found = (products || []).find(p => (rn && normKey(p.number) === rn) || (ro && normKey(p.oem) === ro));
          if (found) targetId = found.id;
        }
        try {
          if (targetId) {
            const ok = await patchProduct(targetId, payload);
            if (ok) updated++; else failed++;
          } else {
            // при создании — автогенерация SKU
            payload.sku = makeSku(payload.number, payload.condition);
            const resp = await adminFetch(`/api/admin/product`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(payload),
            });
            if (resp.ok) created++; else failed++;
          }
        } catch(e) { failed++; }
      }
      alert(`Готово. Оновлено: ${updated}, Додано: ${created}, Помилок: ${failed}`);
      await reloadProductsAndKeepModals();
    } catch (e) {
      alert("Не вдалося імпортувати з буфера");
    }
  }

  /* ===== основной UI ===== */
  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100">
      <header className="sticky top-0 z-40 border-b border-[#173536] bg-[#041011]/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <a href="/#/" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#245052] bg-[#34B7B7]/10 text-sm font-bold text-[#76DAD8]">DH</a>
            <div className="min-w-0">
              <div className="truncate font-semibold text-white">Адмін-панель Diesel Hub</div>
              <div className="mt-0.5 flex items-center gap-2 text-xs text-neutral-500">
                <span className={"h-1.5 w-1.5 rounded-full " + (apiOk===true ? "bg-emerald-400" : apiOk===false ? "bg-red-400" : "bg-neutral-500")} />
                <span>{localDemoAdmin ? "Локальне демо" : apiOk===true ? "Supabase підключено" : apiOk===false ? "Немає доступу до API" : "Перевірка зʼєднання"}</span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2">
            <button onClick={()=>{ setOrdersOpen(true); loadOrders(); }} className="rounded-xl border border-[#244445] px-3.5 py-2 text-sm font-medium text-neutral-200 transition hover:border-[#34B7B7] hover:text-white">Замовлення</button>
            <button onClick={()=>{ setAnalyticsOpen(true); loadAnalytics(); }} className="rounded-xl border border-[#244445] px-3.5 py-2 text-sm font-medium text-neutral-200 transition hover:border-[#34B7B7] hover:text-white">Попит і воронка</button>
            <details className="group relative">
              <summary className="cursor-pointer list-none rounded-xl border border-[#244445] px-3.5 py-2 text-sm font-medium text-neutral-200 transition hover:border-[#34B7B7] hover:text-white">Імпорт та експорт</summary>
              <div className="absolute right-0 top-[calc(100%+0.5rem)] z-50 grid w-56 gap-1 rounded-2xl border border-[#244445] bg-[#071516] p-2 shadow-2xl shadow-black/50">
                <button onClick={exportCSV} className="rounded-lg px-3 py-2 text-left text-sm text-neutral-300 hover:bg-white/5 hover:text-white">Експорт CSV</button>
                <button onClick={exportJSON} className="rounded-lg px-3 py-2 text-left text-sm text-neutral-300 hover:bg-white/5 hover:text-white">Експорт JSON</button>
                <button onClick={exportCSVToClipboard} className="rounded-lg px-3 py-2 text-left text-sm text-neutral-300 hover:bg-white/5 hover:text-white">Копіювати CSV</button>
                <button onClick={importFromClipboard} className="rounded-lg px-3 py-2 text-left text-sm text-neutral-300 hover:bg-white/5 hover:text-white">Вставити з таблиці</button>
                <input id="admin-import-file" type="file" accept=".csv,.json" className="hidden" onChange={(e)=>handleImportFile(e.target.files?.[0])} />
                <label htmlFor="admin-import-file" className="cursor-pointer rounded-lg px-3 py-2 text-sm text-neutral-300 hover:bg-white/5 hover:text-white">Імпортувати файл</label>
              </div>
            </details>
            <a href="/#/" className="rounded-xl px-3 py-2 text-sm text-neutral-400 transition hover:text-[#76DAD8]">До магазину</a>
            <button
              onClick={() => {
                localStorage.removeItem("dh_admin_token");
                setLocalDemoAdmin(false);
                setToken("");
              }}
              className="rounded-xl px-3 py-2 text-sm text-neutral-500 transition hover:bg-white/5 hover:text-white"
            >
              Вийти
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-7">
        <div className="mb-6 flex flex-col gap-4 rounded-2xl border border-[#173536] bg-[#071516]/80 p-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="grid grid-cols-2 gap-1 rounded-xl bg-black/20 p-1">
            <button
              onClick={() => setProductsTab('list')}
              className={"rounded-lg px-5 py-2.5 text-sm font-medium transition " + (productsTab==='list' ? "bg-[#34B7B7] text-[#031112] shadow-lg shadow-[#34B7B7]/10" : "text-neutral-400 hover:bg-white/5 hover:text-white")}
            >
              Каталог
            </button>
            <button
              onClick={() => { setProductsTab('add'); setAddNotice(""); }}
              className={"rounded-lg px-5 py-2.5 text-sm font-medium transition " + (productsTab==='add' ? "bg-[#34B7B7] text-[#031112] shadow-lg shadow-[#34B7B7]/10" : "text-neutral-400 hover:bg-white/5 hover:text-white")}
            >
              Додати товар
            </button>
          </div>
          <div className="px-3 pb-2 text-xs text-neutral-500 sm:pb-0">
            {localDemoAdmin ? "Локальний перегляд без змін у базі" : "Каталог синхронізовано через API із Supabase"}
          </div>
        </div>

        {addNotice && (
          <div className="mb-5 rounded-xl border border-[#34B7B7]/30 bg-[#34B7B7]/10 px-4 py-3 text-sm text-[#9CE7E4]">
            {addNotice}
          </div>
        )}

        {/* форма добавления */}
        {productsTab==='add' && (
          <section className="overflow-hidden rounded-3xl border border-[#173536] bg-[#061011] shadow-2xl shadow-black/20">
            <div className="border-b border-[#173536] bg-[linear-gradient(120deg,rgba(52,183,183,0.12),transparent_55%)] px-5 py-6 sm:px-8">
              <div className="max-w-2xl">
                <div className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-[#76DAD8]">Новий товар</div>
                <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">Додайте позицію до каталогу</h1>
                <p className="mt-2 text-sm leading-6 text-neutral-400">Заповніть номер деталі. Решту даних можна додати зараз або відредагувати пізніше.</p>
              </div>
            </div>

            <form onSubmit={(e) => { e.preventDefault(); addProduct(); }} className="grid xl:grid-cols-[minmax(0,1.65fr)_minmax(280px,0.65fr)]">
              <div className="space-y-8 px-5 py-6 sm:px-8 sm:py-8">
                <section>
                  <div className="mb-5">
                    <h2 className="font-semibold text-white">Основна інформація</h2>
                    <p className="mt-1 text-sm text-neutral-500">Номер деталі — єдине обовʼязкове поле.</p>
                  </div>
                  <div className="grid gap-5 md:grid-cols-2">
                    <Input
                      label="Номер деталі"
                      required
                      autoFocus
                      value={f.number}
                      onChange={(e) => setF((s) => ({ ...s, number: e.target.value }))}
                      placeholder="Наприклад, 0445115064"
                    />
                    <Input
                      label="OEM-номер"
                      hint="необовʼязково"
                      value={f.oem}
                      onChange={(e) => setF((s) => ({ ...s, oem: e.target.value }))}
                      placeholder="Оригінальний номер виробника"
                    />
                    <SelectField label="Виробник" value={f.manufacturer} onChange={(e) => setF((s) => ({ ...s, manufacturer: e.target.value }))}>
                      {MANUFACTURERS.map((m) => <option key={m}>{m}</option>)}
                    </SelectField>
                    <SelectField label="Тип деталі" value={f.type} onChange={(e) => setF((s) => ({ ...s, type: e.target.value }))}>
                      {TYPES.map((t) => <option key={t}>{t}</option>)}
                    </SelectField>
                    <SelectField label="Стан" value={f.condition} onChange={(e) => setF((s) => ({ ...s, condition: e.target.value }))}>
                      {CONDITIONS.map((c) => <option key={c}>{c}</option>)}
                    </SelectField>
                    <Input
                      label="Обʼєм двигуна"
                      hint="необовʼязково"
                      type="number"
                      inputMode="decimal"
                      min="0.1"
                      step="0.1"
                      value={f.engine}
                      onChange={(e) => setF((s) => ({ ...s, engine: e.target.value }))}
                      placeholder="Наприклад, 2.2"
                    />
                  </div>
                </section>

                <section className="rounded-2xl border border-[#173536] bg-[#08191a] p-5">
                  <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                      <h2 className="font-semibold text-white">Ціна та залишок</h2>
                      <p className="mt-1 text-sm text-neutral-500">При нульовому залишку товар автоматично буде «Під замовлення».</p>
                    </div>
                    <span className={"w-fit rounded-full border px-3 py-1 text-xs font-medium " + (Number(f.qty) > 0 ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300" : "border-amber-500/30 bg-amber-500/10 text-amber-200")}>
                      {availabilityForQty(f.qty)}
                    </span>
                  </div>
                  <div className="grid gap-5 sm:grid-cols-2">
                    <Input
                      label="Кількість"
                      hint="за замовчуванням 0"
                      type="number"
                      inputMode="numeric"
                      min="0"
                      step="1"
                      value={f.qty}
                      onChange={(e) => setF((s) => ({ ...s, qty: e.target.value, availability: availabilityForQty(e.target.value) }))}
                    />
                    <Input
                      label="Ціна, ₴"
                      type="number"
                      inputMode="decimal"
                      min="0"
                      step="1"
                      value={f.price}
                      onChange={(e) => setF((s) => ({ ...s, price: e.target.value }))}
                    />
                  </div>
                </section>

                <details className="group rounded-2xl border border-[#173536] bg-[#071516] open:bg-[#08191a]">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 text-sm font-medium text-neutral-200">
                    <span>
                      Додаткові дані
                      <span className="ml-2 font-normal text-neutral-500">крос-номери, сумісність і фото</span>
                    </span>
                    <span className="text-lg text-[#76DAD8] transition group-open:rotate-45">+</span>
                  </summary>
                  <div className="grid gap-5 border-t border-[#173536] px-5 py-5">
                    <Input
                      label="Крос-номери"
                      hint="через кому"
                      value={f.cross}
                      onChange={(e) => setF((s) => ({ ...s, cross: e.target.value }))}
                      placeholder="0445115005, 0445115017"
                    />
                    <Input
                      label="Комплектуючі для"
                      hint="через кому"
                      value={f.compat_for}
                      onChange={(e) => setF((s) => ({ ...s, compat_for: e.target.value }))}
                      placeholder="OEM або номер основного товару"
                    />
                    <Textarea
                      label="Посилання на фото"
                      hint="кожне з нового рядка"
                      value={f.images}
                      onChange={(e) => setF((s) => ({ ...s, images: e.target.value }))}
                      placeholder={'https://…/photo-1.jpg\nhttps://…/photo-2.jpg'}
                    />
                    <label className="flex cursor-pointer items-center justify-between gap-4 rounded-xl border border-[#173536] bg-black/10 px-4 py-3">
                      <span>
                        <span className="block text-sm font-medium text-neutral-200">Закріпити в каталозі</span>
                        <span className="mt-0.5 block text-xs text-neutral-500">Показувати товар вище за інші позиції</span>
                      </span>
                      <input type="checkbox" checked={f.pinned} onChange={(e) => setF((s) => ({ ...s, pinned: e.target.checked }))} className="h-5 w-5 accent-[#34B7B7]" />
                    </label>
                  </div>
                </details>

                {err && <div role="alert" className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">{err}</div>}

                <div className="flex flex-col-reverse gap-3 border-t border-[#173536] pt-6 sm:flex-row sm:justify-end">
                  <button
                    type="button"
                    onClick={() => { setF(createEmptyProductForm()); setErr(""); }}
                    className="rounded-xl border border-[#244445] px-5 py-3 text-sm font-medium text-neutral-300 transition hover:border-[#34B7B7] hover:text-white"
                  >
                    Очистити
                  </button>
                  <button
                    type="submit"
                    disabled={addingProduct}
                    className="rounded-xl bg-[#34B7B7] px-6 py-3 text-sm font-semibold text-[#031112] transition hover:bg-[#56cac8] disabled:cursor-wait disabled:opacity-60"
                  >
                    {addingProduct ? "Зберігаю…" : localDemoAdmin ? "Додати до локального перегляду" : "Зберегти товар"}
                  </button>
                </div>
              </div>

              <aside className="border-t border-[#173536] bg-[#071516] px-5 py-6 xl:border-l xl:border-t-0 xl:px-6 xl:py-8">
                <div className="xl:sticky xl:top-24">
                  <div className="mb-4 text-xs font-semibold uppercase tracking-[0.16em] text-neutral-500">Перед збереженням</div>
                  <div className="overflow-hidden rounded-2xl border border-[#204344] bg-[#0a1d1e]">
                    <div className="h-1 bg-[#34B7B7]" />
                    <div className="p-5">
                      <div className="text-xs uppercase tracking-[0.14em] text-[#76DAD8]">{f.manufacturer} · {f.condition}</div>
                      <div className="mt-2 break-all text-xl font-semibold text-white">{f.number.trim() || "Номер деталі"}</div>
                      <div className="mt-1 text-sm text-neutral-500">{f.type}</div>
                      <dl className="mt-6 space-y-3 border-t border-[#204344] pt-4 text-sm">
                        <div className="flex items-center justify-between gap-4"><dt className="text-neutral-500">Залишок</dt><dd className="font-medium text-neutral-200">{Number(f.qty) || 0} шт.</dd></div>
                        <div className="flex items-center justify-between gap-4"><dt className="text-neutral-500">Статус</dt><dd className="font-medium text-neutral-200">{availabilityForQty(f.qty)}</dd></div>
                        <div className="flex items-center justify-between gap-4"><dt className="text-neutral-500">Ціна</dt><dd className="font-medium text-neutral-200">{(Number(f.price) || 0).toLocaleString('uk-UA')} ₴</dd></div>
                        <div className="flex items-center justify-between gap-4"><dt className="text-neutral-500">Обʼєм</dt><dd className="font-medium text-neutral-200">{f.engine ? `${f.engine} л` : "не вказано"}</dd></div>
                      </dl>
                    </div>
                  </div>
                  <p className="mt-4 text-xs leading-5 text-neutral-500">
                    {localDemoAdmin ? "Локальна перевірка не змінює Supabase. У робочій адмін-панелі товар буде збережено через захищений API." : "Після збереження товар одразу потрапить до таблиці products у Supabase та зʼявиться в каталозі."}
                  </p>
                </div>
              </aside>
            </form>
          </section>
        )}

        {/* список товаров */}
        {productsTab==='list' && (<section className="overflow-hidden rounded-3xl border border-[#173536] bg-[#061011] shadow-2xl shadow-black/20">
          <div className="flex flex-col gap-4 border-b border-[#173536] bg-[linear-gradient(120deg,rgba(52,183,183,0.08),transparent_45%)] px-5 py-5 md:flex-row md:items-center md:justify-between sm:px-6">
            <div>
              <div className="text-xl font-semibold text-white">Каталог</div>
              <div className="mt-1 text-sm text-neutral-500">{products.length} позицій · {localDemoAdmin ? "локальні тестові дані" : "дані із Supabase"}</div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={loadProducts}
                className="rounded-xl border border-[#244445] px-3.5 py-2 text-sm text-neutral-300 transition hover:border-[#34B7B7] hover:text-white"
              >
                Оновити
              </button>
              <button
                onClick={() => { setEditAll(e => !e); if (!editAll) resetDraft(); }}
                className={"text-sm rounded-lg px-3 py-1.5 border " + (editAll ? "border-emerald-400 text-emerald-300" : "border-neutral-700 hover:border-[#34B7B7]")}
              >
                {editAll ? "Вийти з редагування" : "Редагувати всі"}
              </button>
              {editAll && (
                <>
                  <button
                    onClick={async () => {
                      const entries = Object.entries(draft || {});
                      let failed = [];
                      for (const [id, patch] of entries) {
                        if (!patch || !Object.keys(patch).length) continue;
                        const norm = {};
                        if (patch.number !== undefined) norm.number = String(patch.number || "").trim();
                        if (patch.oem !== undefined) norm.oem = String(patch.oem || "").trim();
                        if (patch.cross !== undefined) {
                          const list = String(patch.cross||"")
                            .split(",")
                            .map(x=>x.trim())
                            .filter(Boolean);
                          norm.cross = list;
                        }
                        if (patch.manufacturer !== undefined) norm.manufacturer = patch.manufacturer;
                        if (patch.condition !== undefined) norm.condition = patch.condition;
                        if (patch.type !== undefined) norm.type = patch.type;
                        if (patch.availability !== undefined) norm.availability = patch.availability;
                        if (patch.qty !== undefined) {
                          const n = Number(patch.qty);
                          norm.qty = isNaN(n) ? 0 : Math.max(0, n);
                        }
                        if (patch.price !== undefined) {
                          const n = Number(patch.price);
                          norm.price = isNaN(n) ? 0 : Math.max(0, n);
                        }
                        if (patch.engine !== undefined) {
                          const raw = String(patch.engine || "").trim().replace(",", ".");
                          norm.engine = raw === "" ? null : Number(raw);
                        }

                        const ok = await patchProduct(id, norm);
                        if (!ok) failed.push(id);
                      }
                      if (failed.length) alert("Не збережено: " + failed.join(", "));
                      await reloadProductsAndKeepModals();
                      resetDraft();
                      setEditAll(false);
                    }}
                    className="text-sm rounded-lg border border-emerald-500 text-emerald-300 px-3 py-1.5 hover:bg-emerald-600/10"
                  >
                    Зберегти всі
                  </button>
                  <button
                    onClick={() => { resetDraft(); setEditAll(false); }}
                    className="text-sm rounded-lg border border-neutral-700 px-3 py-1.5 hover:border-[#34B7B7]"
                  >
                    Скасувати
                  </button>
                </>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 px-5 py-4 sm:px-6">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Пошук: номер / OEM / виробник / тип"
              className="w-full rounded-xl border border-[#173536] bg-[#071516] px-4 py-3 text-sm outline-none transition placeholder:text-neutral-600 hover:border-[#245052] focus:border-[#34B7B7] focus:ring-2 focus:ring-[#34B7B7]/15"
            />
          </div>

          <div className="overflow-auto border-t border-[#173536]">
            <table className="min-w-[1200px] w-full text-sm">
              <thead className="bg-neutral-900/40 border-b border-neutral-800 sticky top-0">
                <tr>
                  <th className="text-center px-3 py-2 w-16 sticky left-0 z-20 bg-neutral-950">ID</th>
                  <th className="text-center px-3 py-2 w-40 sticky z-10 bg-neutral-950" style={{left:"4rem"}}>Номер</th>
                  <th className="text-center px-3 py-2 w-40">OEM</th>
                  <th className="text-center px-3 py-2 w-28">Крос-номери</th>
                  <th className="text-center px-3 py-2 w-40">Виробник</th>
                  <th className="text-center px-3 py-2 w-40">Стан</th>
                  <th className="text-center px-3 py-2 w-40">Тип</th>
                  <th className="text-center px-3 py-2 w-40">Наявність</th>
                  <th className="text-center px-3 py-2 w-28">К-сть</th>
                  <th className="text-center px-3 py-2 w-32">Ціна ₴</th>
                  <th className="text-center px-3 py-2 w-28">Обʼєм</th>
                  <th className="text-center px-3 py-2 w-28">Порядок</th>
                  <th className="text-center px-3 py-2 w-28">Закріп.</th>
                  <th className="text-center px-3 py-2 w-56">Дії</th>
                </tr>
              </thead>
              <tbody>
                {filteredProducts.map((p) => {
                  const d = draft[p.id] || {};
                  const v = (field, fallback) => d[field] !== undefined ? d[field] : fallback;
                  return (
                    <tr key={p.id} className="border-b border-neutral-900">
                      <td className="px-3 py-2 text-neutral-400 sticky left-0 bg-neutral-950 text-center">{String(p.id).slice(-6)}</td>
                      <td className="px-3 py-2 sticky bg-neutral-950 text-center" style={{left:"4rem"}}>
                        {editAll ? (
                          <input
                            value={v('number', p.number || '')}
                            onChange={(e)=>setDraftField(p.id, 'number', e.target.value)}
                            className="w-full bg-neutral-900 border border-neutral-800 rounded-lg px-2 py-1 outline-none focus:border-[#34B7B7]"
                          />
                        ) : (<div className="truncate max-w-[180px]">{p.number || '—'}</div>)}
                      </td>

                      <td className="px-3 py-2 text-center">
                        {editAll ? (
                          <input
                            value={v('oem', p.oem || '')}
                            onChange={(e)=>setDraftField(p.id, 'oem', e.target.value)}
                            className="w-full bg-neutral-900 border border-neutral-800 rounded-lg px-2 py-1 outline-none focus:border-[#34B7B7]"
                          />
                        ) : (<div className="truncate max-w-[180px]">{p.oem || '—'}</div>)}
                      </td>
                      <td className="px-3 py-2 text-center">{editAll ? (<input value={v('cross', (Array.isArray(p.cross)?p.cross.join(', '):''))} onChange={(e)=>setDraftField(p.id, 'cross', e.target.value)} className="w-full bg-neutral-900 border border-neutral-800 rounded-lg px-2 py-1 outline-none focus:border-[#34B7B7]" placeholder="comma, separated"/>) : (<div className="truncate max-w-[12ch] text-neutral-300">{truncateText(Array.isArray(p.cross)?p.cross.join(', '):'', 10) || '—'}</div>)}</td>
                      <td className="px-3 py-2 text-center">
                        {editAll ? (
                          <select
                            value={v('manufacturer', p.manufacturer || MANUFACTURERS[0])}
                            onChange={(e)=>setDraftField(p.id, 'manufacturer', e.target.value)}
                            className="w-full bg-neutral-900 border border-neutral-800 rounded-lg px-2 py-1 outline-none"
                          >
                            {MANUFACTURERS.map(m => <option key={m} value={m}>{m}</option>)}
                          </select>
                        ) : (p.manufacturer || '—')}
                      </td>
                      <td className="px-3 py-2 text-center">
                        {editAll ? (
                          <select
                            value={v('condition', p.condition || CONDITIONS[0])}
                            onChange={(e)=>setDraftField(p.id, 'condition', e.target.value)}
                            className="w-full bg-neutral-900 border border-neutral-800 rounded-lg px-2 py-1 outline-none"
                          >
                            {CONDITIONS.map(m => <option key={m} value={m}>{m}</option>)}
                          </select>
                        ) : (p.condition || '—')}
                      </td>
                      <td className="px-3 py-2 text-center">
                        {editAll ? (
                          <select
                            value={v('type', p.type || TYPES[0])}
                            onChange={(e)=>setDraftField(p.id, 'type', e.target.value)}
                            className="w-full bg-neutral-900 border border-neutral-800 rounded-lg px-2 py-1 outline-none"
                          >
                            {TYPES.map(m => <option key={m} value={m}>{m}</option>)}
                          </select>
                        ) : (p.type || '—')}
                      </td>
                      <td className="px-3 py-2 text-center">
                        {editAll ? (
                          <select
                            value={v('availability', p.availability || AVAILABILITIES[0])}
                            onChange={(e)=>setDraftField(p.id, 'availability', e.target.value)}
                            className="w-full bg-neutral-900 border border-neutral-800 rounded-lg px-2 py-1 outline-none"
                          >
                            {AVAILABILITIES.map(m => <option key={m} value={m}>{m}</option>)}
                          </select>
                        ) : (p.availability || '—')}
                      </td>
                      <td className="px-3 py-2 text-center">
                        {editAll ? (
                          <input
                            value={v('qty', p.qty ?? 0)}
                            onChange={(e)=>setDraftField(p.id, 'qty', e.target.value)}
                            className="w-24 bg-neutral-900 border border-neutral-800 rounded-lg px-2 py-1 outline-none focus:border-[#34B7B7]"
                          />
                        ) : (
                          <div className="inline-flex items-center gap-2">
                            <button onClick={()=>changeQty(p.id, -1)} className="rounded-lg border border-neutral-700 px-2 py-1 hover:border-[#34B7B7]">−</button>
                            <span>{p.qty ?? 0}</span>
                            <button onClick={()=>changeQty(p.id, +1)} className="rounded-lg border border-neutral-700 px-2 py-1 hover:border-[#34B7B7]">+</button>
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-2 text-center">
                        {editAll ? (
                          <input
                            value={v('price', p.price ?? 0)}
                            onChange={(e)=>setDraftField(p.id, 'price', e.target.value)}
                            className="w-28 bg-neutral-900 border border-neutral-800 rounded-lg px-2 py-1 outline-none focus:border-[#34B7B7]"
                          />
                        ) : (p.price ?? 0)}
                      </td>
                      <td className="px-3 py-2 text-center">
                        {editAll ? (
                          <input
                            value={v('engine', p.engine || '')}
                            onChange={(e)=>setDraftField(p.id, 'engine', e.target.value)}
                            className="w-24 bg-neutral-900 border border-neutral-800 rounded-lg px-2 py-1 outline-none focus:border-[#34B7B7]"
                          />
                        ) : (p.engine || '—')}
                      </td>
                      <td className="px-3 py-2 text-center">
                        {editAll ? (
                          <input
                            type="number"
                            value={v('sort_order', p.sort_order ?? 0)}
                            onChange={(e)=>setDraftField(p.id, 'sort_order', e.target.value)}
                            className="w-24 bg-neutral-900 border border-neutral-800 rounded-lg px-2 py-1 outline-none focus:border-[#34B7B7]"
                          />
                        ) : (
                          <div className="inline-flex items-center gap-2">
                            <button onClick={()=>changeOrder(p.id,-1)} className="rounded-lg border border-neutral-700 px-2 py-1 hover:border-[#34B7B7]">−</button>
                            <span>{p.sort_order ?? 0}</span>
                            <button onClick={()=>changeOrder(p.id,1)} className="rounded-lg border border-neutral-700 px-2 py-1 hover:border-[#34B7B7]">+</button>
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-2 text-center">
                        {editAll ? (
                          <input
                            type="checkbox"
                            checked={!!v('pinned', p.pinned || false)}
                            onChange={(e)=>setDraftField(p.id, 'pinned', e.target.checked)}
                          />
                        ) : (
                          <button onClick={()=>togglePinned(p.id)} className="rounded-lg border border-neutral-700 px-2 py-1 hover:border-[#34B7B7]">{p.pinned ? "Так" : "—"}</button>
                        )}
                      </td>
                      <td className="px-3 py-2 text-center">
                        <div className="flex items-center gap-2 justify-center">
                          <button onClick={()=>setPhotoEdit(p)} className="rounded-lg border border-neutral-700 px-3 py-1.5 hover:border-[#34B7B7] text-xs">Фото</button>
                          <button
                            onClick={()=>openProductEdit(p)}
                            className="text-xs rounded-lg border border-neutral-700 px-3 py-1.5 hover:border-[#34B7B7]"
                            title="Редагувати товар"
                          >
                            Редагувати
                          </button>
                          <button
                            onClick={()=>delProduct(p.id)}
                            className="text-xs rounded-lg border border-red-500/50 text-red-300 px-3 py-1.5 hover:bg-red-500/10"
                            title="Видалити товар"
                          >
                            Видалити
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {filteredProducts.length === 0 && (
                  <tr><td colSpan="12" className="py-10 text-center text-neutral-500">Поки що порожньо</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>)}

        {/* Photo Edit Modal */}
        {/* Product Edit Modal */}
        {productEdit && (
          <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/70 p-4">
            <div className="w-full max-w-4xl rounded-2xl border border-neutral-800 bg-neutral-950 shadow-2xl overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-800">
                <div className="text-lg font-semibold">Редагування товару — {productEdit.number || '—'}</div>
                <div className="flex items-center gap-2">
                  <button onClick={closeProductEdit} className="rounded-lg border border-neutral-700 px-3 py-1.5 hover:bg-neutral-900 text-sm">Закрити</button>
                  <button onClick={saveProductEdit} className="rounded-lg border border-emerald-500 text-emerald-300 px-3 py-1.5 hover:bg-emerald-600/10 text-sm">Зберегти</button>
                  <button onClick={()=>delProduct(productEdit.id)} className="rounded-lg border border-red-500/60 text-red-300 px-3 py-1.5 hover:bg-red-500/10 text-sm">Видалити</button>
                </div>
              </div>
              <div className="p-4 grid md:grid-cols-2 gap-4 max-h-[75vh] overflow-auto">
                <div className="space-y-3">
                  <Input label="Номер" value={productEdit.number || ''} onChange={(e)=>setProductEdit(s=>({ ...s, number:e.target.value }))}/>
                  <Input label="OEM" value={productEdit.oem || ''} onChange={(e)=>setProductEdit(s=>({ ...s, oem:e.target.value }))}/>
                  <Input label="Крос-номери (через кому)" value={productEdit._crossText || ''} onChange={(e)=>setProductEdit(s=>({ ...s, _crossText:e.target.value }))}/>
                  <Input label="Сумісний для (через кому)" value={productEdit._compatText || ''} onChange={(e)=>setProductEdit(s=>({ ...s, _compatText:e.target.value }))}/>
                  <div className="grid grid-cols-2 gap-3">
                    <label className="block">
                      <div className="text-sm mb-1">Виробник</div>
                      <select value={productEdit.manufacturer || ''} onChange={(e)=>setProductEdit(s=>({ ...s, manufacturer:e.target.value }))} className="w-full rounded-lg bg-neutral-900 border border-neutral-800 px-3 py-2 text-sm outline-none focus:border-[#34B7B7]">
                        {MANUFACTURERS.map(m => <option key={m} value={m}>{m}</option>)}
                      </select>
                    </label>
                    <label className="block">
                      <div className="text-sm mb-1">Тип</div>
                      <select value={productEdit.type || ''} onChange={(e)=>setProductEdit(s=>({ ...s, type:e.target.value }))} className="w-full rounded-lg bg-neutral-900 border border-neutral-800 px-3 py-2 text-sm outline-none focus:border-[#34B7B7]">
                        {TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </label>
                    <label className="block">
                      <div className="text-sm mb-1">Стан</div>
                      <select value={productEdit.condition || ''} onChange={(e)=>setProductEdit(s=>({ ...s, condition:e.target.value }))} className="w-full rounded-lg bg-neutral-900 border border-neutral-800 px-3 py-2 text-sm outline-none focus:border-[#34B7B7]">
                        {CONDITIONS.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </label>
                    <label className="block">
                      <div className="text-sm mb-1">Наявність</div>
                      <select value={productEdit.availability || ''} onChange={(e)=>setProductEdit(s=>({ ...s, availability:e.target.value }))} className="w-full rounded-lg bg-neutral-900 border border-neutral-800 px-3 py-2 text-sm outline-none focus:border-[#34B7B7]">
                        {AVAILABILITIES.map(a => <option key={a} value={a}>{a}</option>)}
                      </select>
                    </label>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <Input label="Кількість (шт)" value={productEdit.qty ?? ''} onChange={(e)=>setProductEdit(s=>({ ...s, qty:e.target.value }))}/>
                    <Input label="Ціна (₴)" value={productEdit.price ?? ''} onChange={(e)=>setProductEdit(s=>({ ...s, price:e.target.value }))}/>
                    <Input label="Обʼєм (л)" hint="необовʼязково" type="number" min="0.1" step="0.1" value={productEdit.engine ?? ''} onChange={(e)=>setProductEdit(s=>({ ...s, engine:e.target.value }))}/>
                  </div>
                </div>
                <div className="space-y-3">
                  <Textarea label="Фото (URL, по одному в рядку)" value={productEdit._imagesText || ''} onChange={(e)=>setProductEdit(s=>({ ...s, _imagesText:e.target.value }))}/>
                </div>
              </div>
            </div>
          </div>
        )}

        {photoEdit && (
          <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/70 p-4">
            <div className="w-full max-w-4xl rounded-2xl border border-neutral-800 bg-neutral-950 shadow-2xl overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-800">
                <div className="flex flex-col">
                  <div className="text-lg font-semibold">Фото · {photoEdit.number || '—'}</div>
                  <div className="text-xs text-neutral-400">ID: {String(photoEdit.id).slice(-6)} {photoEdit.oem ? ' · OEM: '+photoEdit.oem : ''}</div>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    id="photo-upload-input"
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={async (e)=>{
                      const fs = e.currentTarget.files;
                      if (fs && fs.length) await uploadImages(photoEdit.id, fs);
                      e.currentTarget.value = "";
                    }}
                  />
                  <label htmlFor="photo-upload-input" className="cursor-pointer rounded-lg border border-neutral-700 px-3 py-1.5 hover:border-[#34B7B7] text-sm">Додати фото</label>
                  <button onClick={()=>setPhotoEdit(null)} className="rounded-lg border border-neutral-700 px-3 py-1.5 hover:bg-neutral-900 text-sm">Закрити</button>
                </div>
              </div>
              <div className="p-4 max-h-[70vh] overflow-auto">
                {Array.isArray(photoEdit.images) && photoEdit.images.length ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                    {photoEdit.images.map((url, i)=> (
                      <div key={i} className="relative group rounded-xl border border-neutral-800 overflow-hidden">
                        <img src={url} alt="" className="w-full h-36 object-cover" />
                        <button
                          onClick={async ()=>{ await deleteOneImage(photoEdit.id, url); }}
                          className="absolute top-2 right-2 hidden group-hover:inline-flex items-center rounded-md border border-red-500/40 bg-red-500/10 px-2 py-1 text-xs text-red-300 hover:bg-red-500/20"
                          title="Видалити фото"
                        >
                          Видалити
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-neutral-400 text-sm">Немає фото. Додайте з кнопки «Додати фото».</div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Orders Overlay */}
        {analyticsOpen && (
          <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/70 p-4">
            <div className="w-full max-w-5xl max-h-[92vh] overflow-auto rounded-2xl border border-neutral-800 bg-neutral-950 p-5 shadow-2xl">
              <div className="mb-5 flex items-center justify-between"><div><h2 className="text-xl font-semibold">Попит і воронка</h2><p className="text-sm text-neutral-500">Останні 30 днів</p></div><button onClick={()=>setAnalyticsOpen(false)} className="rounded-xl border border-neutral-700 px-3 py-1.5">Закрити</button></div>
              {analyticsLoading && <div className="py-12 text-center text-neutral-500">Завантаження…</div>}
              {analytics && <>
                <div className="grid grid-cols-2 gap-3 md:grid-cols-4">{Object.entries({"Відвідувачі":analytics.funnel.visitors,"Пошуки":analytics.funnel.searches,"Знайшли товар":analytics.funnel.found,"Додали в кошик":analytics.funnel.add_to_cart,"Почали оформлення":analytics.funnel.checkout_start,"Замовлення":analytics.funnel.orders,"Нуль результатів":analytics.funnel.zero_results,"Заявки без товару":analytics.funnel.zero_result_leads}).map(([label,value])=><div key={label} className="rounded-xl border border-neutral-800 p-3"><div className="text-xs text-neutral-500">{label}</div><div className="mt-1 text-2xl font-semibold text-[#76DAD8]">{value}</div></div>)}</div>
                <div className="mt-6 grid gap-5 md:grid-cols-2"><section className="rounded-xl border border-neutral-800 p-4"><h3 className="font-semibold">Втрачений попит</h3><div className="mt-3 space-y-2">{analytics.lost_demand.length ? analytics.lost_demand.map((item,index)=><div key={item.query} className="flex justify-between border-b border-neutral-900 pb-2 text-sm"><span>{index+1}. {item.query}</span><b>{item.searches}</b></div>) : <p className="text-sm text-neutral-500">Даних поки немає</p>}</div></section><section className="rounded-xl border border-neutral-800 p-4"><h3 className="font-semibold">Джерела замовлень</h3><div className="mt-3 space-y-2">{analytics.sources.length ? analytics.sources.map(item=><div key={item.source} className="grid grid-cols-[1fr_auto_auto] gap-3 border-b border-neutral-900 pb-2 text-sm"><span>{item.source}</span><b>{item.orders}</b><span>{money(item.revenue)}</span></div>) : <p className="text-sm text-neutral-500">Даних поки немає</p>}</div></section></div>
              </>}
            </div>
          </div>
        )}
        {ordersOpen && (
          <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/70 p-4">
            <div className="w-full max-w-5xl max-h-[92vh] rounded-2xl border border-neutral-800 bg-neutral-950 shadow-2xl flex flex-col overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-800">
                <h2 className="text-lg font-semibold">Замовлення</h2>
                <div className="flex items-center gap-2">
                  <input value={ordersSearch} onChange={(e)=>setOrdersSearch(e.target.value)} placeholder="Пошук: №, імʼя, телефон, статус" className="rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-1.5 text-sm outline-none focus:border-[#34B7B7]" />
                  <button onClick={loadOrders} className="rounded-xl border border-neutral-700 px-3 py-1.5 hover:bg-neutral-900 disabled:opacity-50" disabled={ordersLoading}>Оновити</button>
                  <button onClick={()=>setOrdersOpen(false)} className="rounded-xl border border-neutral-700 px-3 py-1.5 hover:bg-neutral-900">Закрити</button>
                </div>
              </div>
              {ordersErr && <div className="px-4 py-3 text-rose-400">{ordersErr}</div>}
              <div className="px-4 py-3 overflow-auto max-h-[70vh]">
                <table className="w-full text-sm">
                  <thead className="text-neutral-400">
                    <tr className="text-left">
                      <th className="py-2 pr-3">№</th>
                      <th className="py-2 pr-3">Дата</th>
                      <th className="py-2 pr-3">Клієнт</th>
                      <th className="py-2 pr-3">Телефон</th>
                      <th className="py-2 pr-3">Доставка</th>
                      <th className="py-2 pr-3">Сума</th>
                      <th className="py-2 pr-3">Позицій</th>
                      <th className="py-2 pr-3">Статус</th>
                      <th className="py-2 pr-0 text-right">Дії</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.length === 0 && (
                      <tr><td colSpan="9" className="py-10 text-center text-neutral-500">Поки що порожньо</td></tr>
                    )}
                    {filteredOrders.map((o) => {
                      const itemsCount = Array.isArray(o.items) ? o.items.length : (o.items && typeof o.items==='object' ? Object.keys(o.items).length : 0);
                      return (
                        <tr key={o.id} className="border-t border-neutral-900 hover:bg-neutral-900/40">
                          <td className="py-2 pr-3">{getOrderNumber(o)}</td>
                          <td className="py-2 pr-3 whitespace-nowrap">{new Date(o.created_at).toLocaleString('uk-UA')}</td>
                          <td className="py-2 pr-3">{truncateText(o.name || '—', 15)}</td>
                          <td className="py-2 pr-3">{o.phone || '—'}</td>
                          <td className="py-2 pr-3 max-w-[18rem]">{truncateText(o.delivery || '—', 10)}</td>
                          <td className="py-2 pr-3 whitespace-nowrap">{money(o.total)}</td>
                          <td className="py-2 pr-3">{itemsCount}</td>
                          <td className="py-2 pr-3"><StatusBadge status={o.status} /></td>
                          <td className="py-2 pr-0 text-right">
                            <button onClick={()=>openOrder(o.id, getOrderNumber(o))} className="rounded-lg border border-neutral-700 px-2 py-1 hover:bg-neutral-900">Детальніше</button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Details card */}
            {orderDetails && (
              <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4">
                <div className="w-full max-w-3xl max-h-[92vh] rounded-2xl border border-neutral-800 bg-neutral-950 shadow-2xl flex flex-col overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-800">
                    <h3 className="text-lg font-semibold">Замовлення №{orderDetails.seq}</h3>
                    <div className="flex items-center gap-2">
                      <button onClick={()=>setOrderDetails(null)} className="rounded-xl border border-neutral-700 px-3 py-1.5 hover:bg-neutral-900">Закрити</button>
                    </div>
                  </div>

                  <div className="p-4 grid gap-4 overflow-y-auto max-h-[70vh] pr-2">
                    <div className="grid md:grid-cols-2 gap-4">
                      <div className="rounded-xl border border-neutral-800 p-3"><div className="text-neutral-400 text-xs">Клієнт</div><div className="text-sm">{orderDetails.name || '—'}</div></div>
                      <div className="rounded-xl border border-neutral-800 p-3"><div className="text-neutral-400 text-xs">Телефон</div><div className="text-sm">{orderDetails.phone || '—'}</div></div>
                      <div className="rounded-xl border border-neutral-800 p-3 md:col-span-2"><div className="text-neutral-400 text-xs">Доставка</div><div className="text-sm">{orderDetails.delivery || '—'}</div></div>
                      {/* Спосіб оплати */}
                      <div className="rounded-xl border border-neutral-800 p-3">
                        <div className="text-neutral-400 text-xs">Спосіб оплати</div>
                        <div className="mt-1 flex items-center gap-2">
                          <select
                            value={orderPayment}
                            onChange={(e)=>setOrderPayment(e.target.value)}
                            className="bg-neutral-900 border border-neutral-700 rounded-lg px-2 py-1 text-sm outline-none"
                          >
                            {(() => {
                              const d = String(orderDetails?.delivery || '');
                              const isNP = /Нова пошта/i.test(d);
                              const isPickup = /Самовивіз/i.test(d);
                              const opts = [];
                              const push = (v) => { if (!opts.includes(v)) opts.push(v); };
                              if (isNP) { push('Накладений платіж'); push('Передплата по реквізитам'); }
                              if (isPickup) { push('Готівковий розрахунок'); push('Передплата по реквізитам'); }
                              if (!isNP && !isPickup) {
                                ['Накладений платіж','Готівковий розрахунок','Передплата по реквізитам'].forEach(push);
                              }
                              return opts.map(o => <option key={o} value={o}>{o}</option>);
                            })()}
                          </select>
                          <button onClick={saveOrderPayment} className="rounded-lg border border-emerald-300 px-3 py-1.5 hover:bg-emerald-600/10">Зберегти</button>
                        </div>
                      </div>
                      <div className="rounded-xl border border-neutral-800 p-3">
                        <div className="text-neutral-400 text-xs">Статус</div>
                        <div className="mt-1 flex items-center gap-2">
                          <select value={orderStatus} onChange={(e)=>setOrderStatus(e.target.value)} className="bg-neutral-900 border border-neutral-700 rounded-lg px-2 py-1 text-sm outline-none">
                            {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                          </select>
                          <button onClick={saveOrderStatus} className="rounded-lg border border-emerald-600 text-emerald-300 px-3 py-1.5 hover:bg-emerald-600/10">Зберегти</button>
                        </div>
                        <div className="mt-3">
                          <Textarea label="Коментар адміністратора"
                            value={orderComment}
                            onChange={(e)=>setOrderComment(e.target.value)}
                          />
                        </div>
                      </div>
                      <div className="rounded-xl border border-neutral-800 p-3"><div className="text-neutral-400 text-xs">Сума</div><div className="text-sm">{money(orderDetails.total)}</div></div>
                      <div className="rounded-xl border border-neutral-800 p-3"><div className="text-neutral-400 text-xs">Створено</div><div className="text-sm">{new Date(orderDetails.created_at).toLocaleString('uk-UA')}</div></div>
                      <div className="rounded-xl border border-neutral-800 p-3 md:col-span-2"><div className="text-neutral-400 text-xs">Джерело / реклама</div><div className="text-sm">{[orderDetails.source || orderDetails.utm?.source || 'direct', orderDetails.medium || orderDetails.utm?.medium, orderDetails.campaign || orderDetails.utm?.campaign].filter(Boolean).join(' / ')}</div>{(orderDetails.gclid || orderDetails.utm?.gclid) && <div className="mt-1 break-all text-xs text-neutral-500">gclid: {orderDetails.gclid || orderDetails.utm?.gclid}</div>}</div>
                    </div>

                    <div className="rounded-xl border border-neutral-800">
                      <div className="px-3 py-2 border-b border-neutral-800 text-neutral-400 text-sm">Позиції</div>
                      <div className="p-3 overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead className="text-neutral-400">
                            <tr className="text-left">
                              <th className="py-2 pr-3">#</th>
                              <th className="py-2 pr-3">Номер / OEM</th>
                              <th className="py-2 pr-3">Наявність</th>
                              <th className="py-2 pr-3">К-сть</th>
                              <th className="py-2 pr-3">Ціна</th>
                              <th className="py-2 pr-3">Сума</th>
                            </tr>
                          </thead>
                          <tbody>
                            {Array.isArray(orderDetails.items) && orderDetails.items.length ? orderDetails.items.map((it, idx) => {
                              const qty = Number(it.qty || it.quantity || 1);
                              const price = Number(it.price || it.unitPrice || 0);
                              const sum = price*qty;
                              const number = it.number || it.code || it.sku || '';
                              const oem = it.oem || it.OEM || '';
                              return (
                                <tr key={idx} className="border-t border-neutral-900">
                                  <td className="py-2 pr-3">{idx+1}</td>
                                  <td className="py-2 pr-3 whitespace-nowrap">{number}{oem?` / ${oem}`:''}</td>
                                  <td className="py-2 pr-3">{(it.availability || it.avail || it.stockStatus || '—')}</td>
                                  <td className="py-2 pr-3">{qty}</td>
                                  <td className="py-2 pr-3 whitespace-nowrap">{money(price)}</td>
                                  <td className="py-2 pr-3 whitespace-nowrap">{money(sum)}</td>
                                </tr>
                              );
                            }) : (<tr><td className="py-4 text-neutral-500" colSpan="6">Немає позицій</td></tr>)}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
