// src/admin.jsx
import React, { useEffect, useMemo, useState } from "react";

// Базовый URL API для продакшна (например, https://diesel-api.onrender.com)
// ЛОКАЛЬНО можно оставить пустым (тогда будут ходить на /api через прокси Vite)
const API = import.meta.env.VITE_API_BASE || "";

/* ===== мини-компоненты ===== */
function Input({ label, ...props }) {
  return (
    <label className="block">
      <div className="text-sm mb-1">{label}</div>
      <input
        {...props}
        className={
          "w-full rounded-lg bg-neutral-900 border border-neutral-800 px-3 py-2 text-sm outline-none focus:border-yellow-400 " +
          (props.className || "")
        }
      />
    </label>
  );
}
function Textarea({ label, ...props }) {
  return (
    <label className="block">
      <div className="text-sm mb-1">{label}</div>
      <textarea
        {...props}
        className={
          "w-full min-h-[84px] rounded-lg bg-neutral-900 border border-neutral-800 px-3 py-2 text-sm outline-none focus:border-yellow-400 " +
          (props.className || "")
        }
      />
    </label>
  );
}

/* ===== константы ===== */
const MANUFACTURERS = ["Bosch", "Denso", "Delphi", "Siemens VDO", "Continental"];
const CONDITIONS = ["Нове", "Відновлене"];
const TYPES = ["Форсунка", "ПНВТ", "Клапан"];
const AVAILABILITIES = ["В наявності", "Під замовлення"];

/* ===== страница ===== */
export default function AdminPanel() {
  /* --- токен --- */
  const [token, setToken] = useState(localStorage.getItem("dh_admin_token") || "");
  const [tokenInput, setTokenInput] = useState("");
  

  // --- статус API/токена ---
  const [apiOk, setApiOk] = useState(null); // null=неизвестно, true=OK, false=нет доступа

  // Унифицированный fetch для админ-эндпоинтов: подставляет токен и авто-логаут при 401
  async function adminFetch(path, opts = {}) {
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
const [ordersLoading, setOrdersLoading] = useState(false);
  const [orders, setOrders] = useState([]);
  const [ordersErr, setOrdersErr] = useState("");
  const [orderDetails, setOrderDetails] = useState(null);
  
  useEffect(() => {
    const lock = ordersOpen || !!orderDetails;
    const prev = document.body.style.overflow;
    if (lock) document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [ordersOpen, orderDetails]);
const [orderStatus, setOrderStatus] = useState("");
  const [orderPayment, setOrderPayment] = useState("");

  const [orderComment, setOrderComment] = useState("");
  // Пошук по замовленнях
  const [ordersSearch, setOrdersSearch] = useState("");
  // Мапа реальних номерів (№) для кожного id по початковому списку (нові зверху)
  const seqMap = useMemo(() => new Map(orders.map((o, idx) => [o.id, orders.length - idx])), [orders]);
  const filteredOrders = useMemo(() => {
    const q = (ordersSearch || "").trim().toLowerCase();
    if (!q) return orders;
    const qDigits = q.replace(/\D/g, "");
    return orders.filter((o) => {
      const seq = String(seqMap.get(o.id) || "");
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
      'Новий': 'bg-yellow-500/10 text-yellow-300 border-yellow-500/30',
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
  }, [token]);
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
    if (ok) setProducts(prev=>prev.map(x=> x.id===id ? { ...x, qty: next } : x));
  }

  const [products, setProducts] = useState([]);
  const [photoEdit, setPhotoEdit] = useState(null); // продукт для модалки фото
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
      const r = await fetch(`${API}/api/products`);
      const d = await r.json();
      return Array.isArray(d) ? d : [];
    } catch {
      return [];
    }
  }



  async function loadProducts() {
    try {
      const r = await fetch(`${API}/api/products`);
      const d = await r.json();
      setProducts(Array.isArray(d) ? d : []);
    } catch {
      setProducts([]);
    }
  }
  useEffect(() => {
    loadProducts();
  }, []);
  const filteredProducts = useMemo(() => {
    const q = (search || "").trim().toLowerCase();
    if (!q) return products;
    return products.filter((p) => {
      const hay = `${p.number || ""} ${p.oem || ""}`.toLowerCase();
      return hay.includes(q);
    });
  }, [products, search]);

  /* --- форма добавления --- */
  const [f, setF] = useState({
    number: "",
    oem: "",
    cross: "",
    manufacturer: MANUFACTURERS[0],
    condition: CONDITIONS[0],
    type: TYPES[0],
    availability: AVAILABILITIES[0],
    qty: "1",
    price: "0",
    engine: "",
    images: "", // по строке на URL
  });

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

  async function addProduct() {
    setErr("");
    if (!token) return setErr("Введіть адмін-токен");
    if (!f.number.trim()) return setErr("Номер деталі обовʼязковий");
    if (!f.price || isNaN(Number(f.price))) return setErr("Ціна має бути числом");
    if (!f.qty || isNaN(Number(f.qty))) return setErr("Кількість має бути числом");

    const payload = {
      number: f.number.trim(),
      oem: f.oem.trim() || null,
      cross: parseListComma(f.cross),
      manufacturer: f.manufacturer,
      condition: f.condition,
      type: f.type,
      availability: f.availability,
      qty: Number(f.qty),
      price: Number(f.price),
      engine: f.engine ? Number(f.engine) : null,
      images: parseLines(f.images),
    };

    const r = await adminFetch(`/api/admin/product`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-admin-token": token,
      },
      body: JSON.stringify(payload),
    });

    if (!r.ok) {
      const e = await r.json().catch(() => ({}));
      setErr(e.error || "Помилка");
      return;
    }

    setF({
      number: "",
      oem: "",
      cross: "",
      manufacturer: MANUFACTURERS[0],
      condition: CONDITIONS[0],
      type: TYPES[0],
      availability: AVAILABILITIES[0],
      qty: "1",
      price: "0",
      engine: "",
      images: "",
    });
    await refreshPhotoModal(productId);
    alert("Товар додано");
  }

  async function delProduct(id) {
    if (!confirm("Видалити товар?")) return;
    const r = await adminFetch(`/api/admin/product/${id}`, {
      method: "DELETE",
      headers: { "x-admin-token": token },
    });
    if (!r.ok) {
      const e = await r.json().catch(() => ({}));
      alert(e.error || "Помилка");
      return;
    }
    await refreshPhotoModal(productId);
  }

  // Сохраняем ТОЛЬКО редактируемые поля (цена/кол-во/наличие)
  async function saveProduct(p) {
    const patch = {
      price: Number(p.price || 0),
      qty: Number(p.qty || 0),
      availability: p.availability,
    };

    const r = await adminFetch(`/api/admin/product/${p.id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "x-admin-token": token,
      },
      body: JSON.stringify(patch),
    });

    if (!r.ok) {
      const e = await r.json().catch(() => ({}));
      alert(e.error || "Помилка");
      return;
    }
    await refreshPhotoModal(productId);
  }

  /* ===== загрузка/удаление картинок ===== */
  async function refreshPhotoModal(productId) {
    try {
      if (photoEdit && photoEdit.id === productId) {
        const list = await fetchProductsRaw();
        setProducts(list);
        const latest = list.find(x => x.id === productId);
        if (latest) setPhotoEdit(latest);
      } else {
        await refreshPhotoModal(productId);
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
      headers: { "x-admin-token": token }, // ВАЖНО: без Content-Type
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
      headers: {
        "Content-Type": "application/json",
        "x-admin-token": token,
      },
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
  // Показываем форму входа, пока токен не подтверждён сервером
  if (apiOk !== true) {
    return (
      <div className="min-h-screen bg-neutral-950 text-neutral-100 grid place-items-center">
        <div className="w-full max-w-md rounded-2xl border border-neutral-800 p-6">          <input
            type="password"
            value={tokenInput}
            onChange={(e) => setTokenInput(e.target.value.trim())}
            className="w-full rounded-lg bg-neutral-900 border border-neutral-800 px-3 py-2 text-sm outline-none focus:border-yellow-400 mb-4"
          />
          <button
            onClick={async () => {
              setErr("");
              const candidate = (tokenInput || "").trim();
              if (!candidate) return;
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
            className="mt-4 w-full rounded-xl bg-yellow-400 text-neutral-950 font-semibold py-3 hover:brightness-90"
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
      await refreshPhotoModal(productId);
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
      await refreshPhotoModal(productId);
    } catch (e) {
      alert("Не вдалося імпортувати з буфера");
    }
  }

  /* ===== основной UI ===== */
  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100">
      <header className="sticky top-0 z-10 bg-neutral-950/60 backdrop-blur-md border-b border-neutral-800">
        <div className="mx-auto max-w-7xl px-4 py-3 flex items-center justify-between">
          <div className="font-bold">Адмін-панель · Diesel Hub</div>
          <div className="ml-3 text-xs px-2 py-1 rounded-md border"
               style={{borderColor: apiOk===true? "#14532d": apiOk===false? "#7f1d1d":"#525252", background: apiOk===true? "rgba(34,197,94,0.1)": apiOk===false? "rgba(239,68,68,0.08)":"rgba(64,64,64,0.3)", color: apiOk===true? "#22c55e": apiOk===false? "#ef4444":"#d4d4d4"}}>
            {apiOk===true? "Статус API: ОК": apiOk===false? "Немає доступу": "Перевірка…"}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={()=>{ setOrdersOpen(true); loadOrders(); }} className="rounded-lg border border-neutral-700 px-3 py-1.5 text-sm hover:border-yellow-400">Замовлення</button>
            <button onClick={exportCSV} className="rounded-lg border border-neutral-700 px-3 py-1.5 text-sm hover:border-yellow-400">Експорт CSV</button>
            <button onClick={exportJSON} className="rounded-lg border border-neutral-700 px-3 py-1.5 text-sm hover:border-yellow-400">Експорт JSON</button>
            <button onClick={exportCSVToClipboard} className="rounded-lg border border-neutral-700 px-3 py-1.5 text-sm hover:border-yellow-400">Копіювати CSV</button>
            <button onClick={importFromClipboard} className="rounded-lg border border-neutral-700 px-3 py-1.5 text-sm hover:border-yellow-400">Вставити з таблиці</button>
            <input id="admin-import-file" type="file" accept=".csv,.json" className="hidden" onChange={(e)=>handleImportFile(e.target.files?.[0])} />
            <label htmlFor="admin-import-file" className="cursor-pointer rounded-lg border border-neutral-700 px-3 py-1.5 text-sm hover:border-yellow-400">Імпорт</label>
            <a href="/#/" className="text-sm text-neutral-300 hover:text-yellow-400">
              ← до магазину
            </a>
            <button
              onClick={() => {
                localStorage.removeItem("dh_admin_token");
                setToken("");
              }}
              className="rounded-lg border border-neutral-700 px-3 py-1.5 text-sm hover:border-yellow-400"
            >
              Вийти
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* вкладки управління товарами */}
        <div className="mb-4 flex items-center gap-2">
          <button
            onClick={() => setProductsTab('list')}
            className={"rounded-lg px-3 py-1.5 border text-sm " + (productsTab==='list' ? "border-yellow-400 text-yellow-300" : "border-neutral-700 hover:border-yellow-400")}
          >
            Список товарів
          </button>
          <button
            onClick={() => setProductsTab('add')}
            className={"rounded-lg px-3 py-1.5 border text-sm " + (productsTab==='add' ? "border-yellow-400 text-yellow-300" : "border-neutral-700 hover:border-yellow-400")}
          >
            Додати товар
          </button>
        </div>

        {/* форма добавления */}
        {productsTab==='add' && (<section className="rounded-2xl border border-neutral-800 p-4 space-y-3">
          <div className="text-lg font-semibold mb-2">Додати товар</div>

          <Input
            label="Номер деталі"
            value={f.number}
            onChange={(e) => setF((s) => ({ ...s, number: e.target.value }))}
          />
          <Input
            label="OEM номер"
            value={f.oem}
            onChange={(e) => setF((s) => ({ ...s, oem: e.target.value }))}
          />
          <Input
            label="Крос-номери (через кому)"
            value={f.cross}
            onChange={(e) => setF((s) => ({ ...s, cross: e.target.value }))}
          />

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <div className="text-sm mb-1">Виробник</div>
              <select
                value={f.manufacturer}
                onChange={(e) => setF((s) => ({ ...s, manufacturer: e.target.value }))}
                className="w-full rounded-lg bg-neutral-900 border border-neutral-800 px-3 py-2 text-sm outline-none focus:border-yellow-400"
              >
                {MANUFACTURERS.map((m) => (
                  <option key={m}>{m}</option>
                ))}
              </select>
            </label>

            <label className="block">
              <div className="text-sm mb-1">Тип</div>
              <select
                value={f.type}
                onChange={(e) => setF((s) => ({ ...s, type: e.target.value }))}
                className="w-full rounded-lg bg-neutral-900 border border-neutral-800 px-3 py-2 text-sm outline-none focus:border-yellow-400"
              >
                {TYPES.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </label>

            <label className="block">
              <div className="text-sm mb-1">Стан</div>
              <select
                value={f.condition}
                onChange={(e) => setF((s) => ({ ...s, condition: e.target.value }))}
                className="w-full rounded-lg bg-neutral-900 border border-neutral-800 px-3 py-2 text-sm outline-none focus:border-yellow-400"
              >
                {CONDITIONS.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </label>

            <label className="block">
              <div className="text-sm mb-1">Наявність</div>
              <select
                value={f.availability}
                onChange={(e) => setF((s) => ({ ...s, availability: e.target.value }))}
                className="w-full rounded-lg bg-neutral-900 border border-neutral-800 px-3 py-2 text-sm outline-none focus:border-yellow-400"
              >
                {AVAILABILITIES.map((a) => (
                  <option key={a}>{a}</option>
                ))}
              </select>
            </label>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <Input
              label="Кількість (шт)"
              value={f.qty}
              onChange={(e) => setF((s) => ({ ...s, qty: e.target.value }))}
            />
            <Input
              label="Ціна (₴)"
              value={f.price}
              onChange={(e) => setF((s) => ({ ...s, price: e.target.value }))}
            />
            <Input
              label="Обʼєм (л)"
              value={f.engine}
              onChange={(e) => setF((s) => ({ ...s, engine: e.target.value }))}
              placeholder="напр. 2.2"
            />
          </div>

          <Textarea
            label="Фото (кожне з нового рядка, повні URL)"
            value={f.images}
            onChange={(e) => setF((s) => ({ ...s, images: e.target.value }))}
          />

          {err && <div className="text-red-400 text-sm">{err}</div>}
          <div className="flex gap-3">
            <button
              onClick={addProduct}
              className="mt-2 rounded-xl bg-yellow-400 text-neutral-950 font-semibold px-4 py-2 hover:brightness-95"
            >
              Додати товар
            </button>
            <button
              onClick={() =>
                setF({
                  number: "",
                  oem: "",
                  cross: "",
                  manufacturer: MANUFACTURERS[0],
                  condition: CONDITIONS[0],
                  type: TYPES[0],
                  availability: AVAILABILITIES[0],
                  qty: "1",
                  price: "0",
                  engine: "",
                  images: "",
                })
              }
              className="mt-2 rounded-xl border border-neutral-700 px-4 py-2 hover:border-yellow-400"
            >
              Очистити форму
            </button>
          </div>
        </section>)}

        {/* список товаров */}
        
{productsTab==='list' && (<section className="rounded-2xl border border-neutral-800 p-4 md:col-span-2">
  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-3">
    <div className="text-lg font-semibold">Товари ({products.length})</div>
    <div className="flex items-center gap-2">
      <button
        onClick={loadProducts}
        className="text-sm rounded-lg border border-neutral-700 px-3 py-1.5 hover:border-yellow-400"
      >
        Оновити
      </button>
      <button
        onClick={() => { setEditAll(e => !e); if (!editAll) resetDraft(); }}
        className={"text-sm rounded-lg px-3 py-1.5 border " + (editAll ? "border-emerald-400 text-emerald-300" : "border-neutral-700 hover:border-yellow-400")}
      >
        {editAll ? "Вийти з редагування" : "Редагувати всі"}
      </button>
      {editAll && (
        <>
          <button
            onClick={async () => {
              // нормалізуємо патчі і відправляємо
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
                if (patch.engine !== undefined) norm.engine = String(patch.engine||"").trim();

                const ok = await patchProduct(id, norm);
                if (!ok) failed.push(id);
              }
              if (failed.length) alert("Не збережено: " + failed.join(", "));
              await refreshPhotoModal(productId);
              resetDraft();
              setEditAll(false);
            }}
            className="text-sm rounded-lg border border-emerald-500 text-emerald-300 px-3 py-1.5 hover:bg-emerald-600/10"
          >
            Зберегти всі
          </button>
          <button
            onClick={() => { resetDraft(); setEditAll(false); }}
            className="text-sm rounded-lg border border-neutral-700 px-3 py-1.5 hover:border-yellow-400"
          >
            Скасувати
          </button>
        </>
      )}
    </div>
  </div>

  <div className="mb-3 flex items-center gap-2">
    <input
      value={search}
      onChange={(e) => setSearch(e.target.value)}
      placeholder="Пошук: номер / OEM / виробник / тип"
      className="w-full rounded-lg bg-neutral-900 border border-neutral-800 px-3 py-2 text-sm outline-none focus:border-yellow-400"
    />
  </div>

  <div className="overflow-auto rounded-xl border border-neutral-900">
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
              <td className="px-3 py-2 text-center">
                {editAll ? (
                  <input
                    value={v('oem', p.oem || '')}
                    onChange={(e)=>setDraftField(p.id, 'oem', e.target.value)}
                    className="w-full bg-neutral-900 border border-neutral-800 rounded-lg px-2 py-1 outline-none focus:border-yellow-400"
                  />
                ) : (<div className="truncate max-w-[180px]">{p.oem || '—'}</div>)}
              </td>

              <td className="px-3 py-2 sticky bg-neutral-950 text-center" style={{left:"4rem"}}>
                {editAll ? (
                  <input
                    value={v('number', p.number || '')}
                    onChange={(e)=>setDraftField(p.id, 'number', e.target.value)}
                    className="w-full bg-neutral-900 border border-neutral-800 rounded-lg px-2 py-1 outline-none focus:border-yellow-400"
                  />
                ) : (<div className="truncate max-w-[180px]">{p.number || '—'}</div>)}
              </td>
              <td className="px-3 py-2 text-center">{editAll ? (<input value={v('cross', (Array.isArray(p.cross)?p.cross.join(', '):''))} onChange={(e)=>setDraftField(p.id, 'cross', e.target.value)} className="w-full bg-neutral-900 border border-neutral-800 rounded-lg px-2 py-1 outline-none focus:border-yellow-400" placeholder="comma, separated"/>) : (<div className="truncate max-w-[12ch] text-neutral-300">{truncateText(Array.isArray(p.cross)?p.cross.join(', '):'', 10) || '—'}</div>)}</td>
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
                    className="w-24 bg-neutral-900 border border-neutral-800 rounded-lg px-2 py-1 outline-none focus:border-yellow-400"
                  />
                ) : (
                  <div className="inline-flex items-center gap-2">
                    <button onClick={()=>changeQty(p.id, -1)} className="rounded-lg border border-neutral-700 px-2 py-1 hover:border-yellow-400">−</button>
                    <span>{p.qty ?? 0}</span>
                    <button onClick={()=>changeQty(p.id, +1)} className="rounded-lg border border-neutral-700 px-2 py-1 hover:border-yellow-400">+</button>
                  </div>
                )}
              </td>
              <td className="px-3 py-2 text-center">
                {editAll ? (
                  <input
                    value={v('price', p.price ?? 0)}
                    onChange={(e)=>setDraftField(p.id, 'price', e.target.value)}
                    className="w-28 bg-neutral-900 border border-neutral-800 rounded-lg px-2 py-1 outline-none focus:border-yellow-400"
                  />
                ) : (p.price ?? 0)}
              </td>
              <td className="px-3 py-2 text-center">
                {editAll ? (
                  <input
                    value={v('engine', p.engine || '')}
                    onChange={(e)=>setDraftField(p.id, 'engine', e.target.value)}
                    className="w-24 bg-neutral-900 border border-neutral-800 rounded-lg px-2 py-1 outline-none focus:border-yellow-400"
                  />
                ) : (p.engine || '—')}
              </td>
              <td className="px-3 py-2 text-center">
                <div className="flex items-center gap-2 justify-center">
                  <button onClick={()=>setPhotoEdit(p)} className="rounded-lg border border-neutral-700 px-3 py-1.5 hover:border-yellow-400 text-xs">Фото</button>
                  <button
                    onClick={() => delProduct(p.id)}
                    className="text-xs text-red-400 hover:text-red-300"
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
                <label htmlFor="photo-upload-input" className="cursor-pointer rounded-lg border border-neutral-700 px-3 py-1.5 hover:border-yellow-400 text-sm">Додати фото</label>
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
      {ordersOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/70 p-4">
          <div className="w-full max-w-5xl max-h-[92vh] rounded-2xl border border-neutral-800 bg-neutral-950 shadow-2xl flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-800">
              <h2 className="text-lg font-semibold">Замовлення</h2>
              <div className="flex items-center gap-2"><input value={ordersSearch} onChange={(e)=>setOrdersSearch(e.target.value)} placeholder="Пошук: №, імʼя, телефон, статус" className="rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-1.5 text-sm outline-none focus:border-yellow-400" />
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
                  {filteredOrders.map((o, i) => {
                    const itemsCount = Array.isArray(o.items) ? o.items.length : (o.items && typeof o.items==='object' ? Object.keys(o.items).length : 0);
                    return (
                      <tr key={o.id} className="border-t border-neutral-900 hover:bg-neutral-900/40">
                        <td className="py-2 pr-3">{seqMap.get(o.id)}</td>
                        <td className="py-2 pr-3 whitespace-nowrap">{new Date(o.created_at).toLocaleString('uk-UA')}</td>
                        <td className="py-2 pr-3">{truncateText(o.name || '—', 15)}</td>
                        <td className="py-2 pr-3">{o.phone || '—'}</td>
                        <td className="py-2 pr-3 max-w-[18rem]">{truncateText(o.delivery || '—', 10)}</td>
                        <td className="py-2 pr-3 whitespace-nowrap">{money(o.total)}</td>
                        <td className="py-2 pr-3">{itemsCount}</td>
                        <td className="py-2 pr-3"><StatusBadge status={o.status} /></td>
                        <td className="py-2 pr-0 text-right">
                          <button onClick={()=>openOrder(o.id, seqMap.get(o.id))} className="rounded-lg border border-neutral-700 px-2 py-1 hover:bg-neutral-900">Детальніше</button>
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
                  <div className="flex items-center gap-2"> <button onClick={()=>setOrderDetails(null)} className="rounded-xl border border-neutral-700 px-3 py-1.5 hover:bg-neutral-900">Закрити</button></div>
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
                            const name = it.title || it.name || it.manufacturer || '';
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