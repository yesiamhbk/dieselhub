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
const TYPES = ["Форсунка", "ТНВД", "Клапан"];
const AVAILABILITIES = ["В наявності", "Під замовлення"];

/* ===== страница ===== */
export default function AdminPanel() {
  /* --- токен --- */
  const [token, setToken] = useState(localStorage.getItem("dh_admin_token") || "");
  const [tokenInput, setTokenInput] = useState("");
  const [err, setErr] = useState("");

  /* --- список товаров --- */
  async function patchProduct(id, patch) {
    const r = await fetch(`${API}/api/admin/product/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", "x-admin-token": token },
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
  const [search, setSearch] = useState("");

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
    models: "",
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
      models: parseListComma(f.models),
      images: parseLines(f.images),
    };

    const r = await fetch(`${API}/api/admin/product`, {
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
      models: "",
      images: "",
    });
    await loadProducts();
    alert("Товар додано");
  }

  async function delProduct(id) {
    if (!confirm("Видалити товар?")) return;
    const r = await fetch(`${API}/api/admin/product/${id}`, {
      method: "DELETE",
      headers: { "x-admin-token": token },
    });
    if (!r.ok) {
      const e = await r.json().catch(() => ({}));
      alert(e.error || "Помилка");
      return;
    }
    await loadProducts();
  }

  // Сохраняем ТОЛЬКО редактируемые поля (цена/кол-во/наличие)
  async function saveProduct(p) {
    const patch = {
      price: Number(p.price || 0),
      qty: Number(p.qty || 0),
      availability: p.availability,
    };

    const r = await fetch(`${API}/api/admin/product/${p.id}`, {
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
    await loadProducts();
  }

  /* ===== загрузка/удаление картинок ===== */
  async function uploadImages(productId, files) {
    if (!files || !files.length) return;
    const fd = new FormData();
    for (const f of files) fd.append("files", f);

    const r = await fetch(`${API}/api/admin/product/${productId}/upload`, {
      method: "POST",
      headers: { "x-admin-token": token }, // ВАЖНО: без Content-Type
      body: fd,
    });

    if (!r.ok) {
      const e = await r.json().catch(() => ({}));
      alert(e.error || "Помилка завантаження");
      return;
    }
    await loadProducts();
  }

  async function deleteOneImage(productId, url) {
    const r = await fetch(`${API}/api/admin/product/${productId}/image`, {
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
    await loadProducts();
  }

  /* ===== экран логина ===== */
  if (!token) {
    return (
      <div className="min-h-screen bg-neutral-950 text-neutral-100 grid place-items-center">
        <div className="w-full max-w-md rounded-2xl border border-neutral-800 p-6">
          <h1 className="text-xl font-bold mb-3">Вхід в адмін-панель</h1>
          <p className="text-sm text-neutral-400 mb-4">
            Введіть <span className="text-neutral-200 font-semibold">ADMIN_TOKEN</span> (з
            <span className="font-mono"> .env.local</span>).
          </p>
          <Input
            label="ADMIN_TOKEN"
            value={tokenInput}
            onChange={(e) => setTokenInput(e.target.value.trim())}
          />
          <button
            onClick={() => {
              if (!tokenInput) return;
              localStorage.setItem("dh_admin_token", tokenInput);
              setToken(tokenInput);
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

  /* ===== основной UI ===== */
  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100">
      <header className="sticky top-0 z-10 bg-neutral-950/60 backdrop-blur-md border-b border-neutral-800">
        <div className="mx-auto max-w-7xl px-4 py-3 flex items-center justify-between">
          <div className="font-bold">Адмін-панель · Diesel Hub</div>
          <div className="flex items-center gap-2">
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
        {/* форма добавления */}
        <section className="rounded-2xl border border-neutral-800 p-4 space-y-3">
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
          <Input
            label="Моделі авто (через кому)"
            value={f.models}
            onChange={(e) => setF((s) => ({ ...s, models: e.target.value }))}
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
                  models: "",
                  images: "",
                })
              }
              className="mt-2 rounded-xl border border-neutral-700 px-4 py-2 hover:border-yellow-400"
            >
              Очистити форму
            </button>
          </div>
        </section>

        {/* список товаров */}
        <section className="rounded-2xl border border-neutral-800 p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="text-lg font-semibold">Товари ({products.length})</div>
            <button
              onClick={loadProducts}
              className="text-sm rounded-lg border border-neutral-700 px-3 py-1.5 hover:border-yellow-400"
            >
              Оновити
            </button>
          </div>



          <div className="mb-3 flex items-center gap-2">
            <input
              placeholder="Пошук за номером / OEM"
              value={search}
              onChange={(e)=>setSearch(e.target.value)}
              className="w-full rounded-lg bg-neutral-900 border border-neutral-800 px-3 py-2 text-sm outline-none focus:border-yellow-400"
            />
          </div>
          <div className="space-y-3 max-h-[70vh] overflow-y-auto pr-1">
            {filteredProducts.map((p) => (














              <div key={p.id} className="rounded-xl border border-neutral-800 p-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-semibold truncate">
                      {p.number} · {p.manufacturer} · {p.type}
                    </div>
                    <div className="text-sm text-neutral-400">
                      OEM: {p.oem || "—"} · Ціна: {p.price} ₴ · К-сть: {p.qty} ·{" "}
                      {p.availability}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => delProduct(p.id)}
                      className="text-sm text-red-400 hover:text-red-300"
                    >
                      Видалити
                    </button>
                  </div>
                </div>

                {/* редактируемые поля */}
                <div className="mt-3 grid grid-cols-3 gap-2">
                  <Input
                    label="Ціна (₴)"
                    value={p.price}
                    onChange={(e) =>
                      setProducts((arr) =>
                        arr.map((x) =>
                          x.id === p.id ? { ...x, price: Number(e.target.value || 0) } : x
                        )
                      )
                    }
                  />
                  <Input
                    label="Кількість"
                    value={p.qty}
                    onChange={(e) =>
                      setProducts((arr) =>
                        arr.map((x) =>
                          x.id === p.id ? { ...x, qty: Number(e.target.value || 0) } : x
                        )
                      )
                    }
                  />
                  <div className="flex items-center gap-2 mt-1">
                    <button onClick={()=>changeQty(p.id, -1)} className="px-2 py-1 rounded-lg border border-neutral-700 hover:border-yellow-400">-1</button>
                    <button onClick={()=>changeQty(p.id, +1)} className="px-2 py-1 rounded-lg border border-neutral-700 hover:border-yellow-400">+1</button>
                  </div>
                  <label className="block">
                    <div className="text-sm mb-1">Наявність</div>
                    <select
                      value={p.availability}
                      onChange={(e) =>
                        setProducts((arr) =>
                          arr.map((x) =>
                            x.id === p.id ? { ...x, availability: e.target.value } : x
                          )
                        )
                      }
                      className="w-full rounded-lg bg-neutral-900 border border-neutral-800 px-3 py-2 text-sm outline-none focus:border-yellow-400"
                    >
                      {AVAILABILITIES.map((a) => (
                        <option key={a}>{a}</option>
                      ))}
                    </select>
                  </label>
                </div>

                <div className="mt-2">
                  <button
                    onClick={() => saveProduct(p)}
                    className="text-sm rounded-lg border border-neutral-700 px-3 py-1.5 hover:border-yellow-400"
                  >
                    Зберегти зміни
                  </button>
                </div>

                {/* фото */}
                <div className="mt-4 border-t border-neutral-800 pt-3">
                  <div className="text-sm mb-2">Фото ({p.images?.length || 0})</div>
                  {p.images?.length ? (
                    <div className="grid grid-cols-4 gap-2">
                      {p.images.map((url) => (
                        <div key={url} className="relative">
                          <img
                            src={url}
                            alt=""
                            className="w-full h-24 object-cover rounded-lg border border-neutral-800"
                          />
                          <button
                            onClick={() => deleteOneImage(p.id, url)}
                            className="absolute top-1 right-1 text-[11px] px-2 py-0.5 rounded bg-neutral-900/90 border border-neutral-700 hover:border-red-400"
                            title="Видалити фото"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-neutral-500 text-sm">Поки що немає фото</div>
                  )}

                  <div className="mt-3 flex items-center gap-3">
                    <input
                      id={`files-${p.id}`}
                      type="file"
                      accept="image/*"
                      multiple
                      className="hidden"
                      onChange={(e) => {
                        const fs = e.currentTarget.files;
                        if (fs && fs.length) uploadImages(p.id, fs);
                        e.currentTarget.value = "";
                      }}
                    />
                    <label
                      htmlFor={`files-${p.id}`}
                      className="cursor-pointer text-sm rounded-lg border border-neutral-700 px-3 py-1.5 hover:border-yellow-400"
                    >
                      Завантажити фото
                    </label>
                  </div>
                </div>
              </div>
            ))}
            {products.length === 0 && <div className="text-neutral-400">Поки що порожньо</div>}
          </div>
        </section>
      </main>
    </div>
  );
}