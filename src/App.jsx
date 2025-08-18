// src/App.jsx
import React, { useEffect, useMemo, useState } from "react";

/** БАЗОВЫЙ URL API (пусто в dev, на проде через VITE_API_BASE) */
const API = import.meta.env.VITE_API_BASE || "";

/* ===================== Утиліти ===================== */

function classNames(...c) {
  return c.filter(Boolean).join(" ");
}
const hasImages = (arr) => Array.isArray(arr) && arr.length > 0;

// Список типів — обовʼязково є "Клапан"
const TYPES = ["Форсунка", "ТНВД", "Клапан"];
const CONDITIONS = ["Нове", "Відновлене"];
const AVAILABILITIES = ["В наявності", "Під замовлення"];

function ExpandableList({ items = [], max = 3 }) {
  const [open, setOpen] = useState(false);
  if (!items || items.length === 0) return <span className="text-neutral-400">—</span>;
  const shown = open ? items : items.slice(0, max);
  const hidden = Math.max(0, items.length - max);
  return (
    <span>
      <span className="text-neutral-100">{shown.join(", ")}</span>
      {hidden > 0 && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            setOpen(!open);
          }}
          className="ml-1 text-xs text-yellow-400 hover:underline align-baseline"
          aria-label={open ? "Згорнути" : `Показати ще ${hidden}`}
        >
          {open ? "▴ згорнути" : `▾ ще ${hidden}`}
        </button>
      )}
    </span>
  );
}

function getWarranty() {
  return "6 місяців";
}
function formatEngine(v) {
  const n = Number(v);
  return Number.isFinite(n) ? `${n.toFixed(1)} л` : "—";
}

/* ====== Телефон UA: маска + акуратне редагування ====== */
/** Забираємо все, лишаємо цифри; обрізаємо 380/0 на початку; рівно 9 цифр */
function normalizeUAPhoneInput(input) {
  let d = String(input || "").replace(/\D+/g, "");
  if (d.startsWith("380")) d = d.slice(3);
  if (d.startsWith("0")) d = d.slice(1);
  return d.slice(0, 9);
}
/** Рендер +380 XX XXX XX XX (тільки пробіли, без дужок) */
function formatUAPhone(d) {
  const s = (d || "").padEnd(9, "");
  const a = s.slice(0, 2);
  const b = s.slice(2, 5);
  const c = s.slice(5, 7);
  const e = s.slice(7, 9);
  let out = `+380`;
  if (a.trim()) out += ` ${a}`;
  if (b.trim()) out += ` ${b}`;
  if (c.trim()) out += ` ${c}`;
  if (e.trim()) out += ` ${e}`;
  return out.trim();
}

/* ===================== Додаток ===================== */

export default function App() {
  /* ----------- Пошук/фільтри ----------- */
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState({
    brand: new Set(),
    condition: new Set(),
    type: new Set(),
    availability: new Set(),
    engine: new Set(),
    number: "",
    oem: "",
    cross: "",
    carModel: "",
  });

  /* ----------- Дані товарів ----------- */
  const [products, setProducts] = useState([]);
  useEffect(() => {
    let cancelled = false;
    fetch(`${API}/api/products`)
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => {
        if (!cancelled) setProducts(Array.isArray(d) ? d : []);
      })
      .catch(() => {
        if (!cancelled) setProducts([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const brands = useMemo(
    () => Array.from(new Set(products.map((p) => p.manufacturer))).filter(Boolean),
    [products]
  );
  const liters = useMemo(
    () =>
      Array.from(new Set(products.map((p) => p.engine).filter((x) => x != null))).sort(
        (a, b) => a - b
      ),
    [products]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const has = (str, q) => String(str || "").toLowerCase().includes(q);
    return products.filter((p) => {
      if (filters.brand.size && !filters.brand.has(p.manufacturer)) return false;
      if (filters.condition.size && !filters.condition.has(p.condition)) return false;
      if (filters.type.size && !filters.type.has(p.type)) return false;
      if (filters.availability.size && !filters.availability.has(p.availability)) return false;
      if (filters.engine.size && !filters.engine.has(p.engine)) return false;

      if (filters.number) {
        const n = filters.number.toLowerCase();
        const match = has(p.number, n) || (p.cross || []).some((c) => has(c, n));
        if (!match) return false;
      }
      if (filters.oem && !has(p.oem, filters.oem)) return false;
      if (filters.cross && !(p.cross || []).some((c) => has(c, filters.cross))) return false;
      if (filters.carModel && !(p.models || []).some((m) => has(m, filters.carModel)))
        return false;

      if (!q) return true;
      return (
        has(p.number, q) ||
        has(p.oem, q) ||
        (p.cross || []).some((c) => has(c, q)) ||
        has(p.manufacturer, q) ||
        has(p.condition, q) ||
        has(p.type, q) ||
        has(String(p.engine), q) ||
        (p.models || []).some((m) => has(m, q)) ||
        has(p.availability, q)
      );
    });
  }, [query, filters, products]);

  /* ----------- Пагінація / Показати ще ----------- */
  const PAGE_SIZE = 9;
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [page, setPage] = useState(1);
  const [mode, setMode] = useState("page");
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
    setPage(1);
    setMode("page");
  }, [query, filters, products]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = mode === "page" ? Math.min(page, totalPages) : 1;
  const shown =
    mode === "more"
      ? filtered.slice(0, visibleCount)
      : filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const maxButtons = 6;
  const pagesToShow =
    totalPages <= maxButtons
      ? Array.from({ length: totalPages }, (_, i) => i + 1)
      : [1, 2, 3, 4, "…", totalPages - 1, totalPages];

  /* ----------- Кошик ----------- */
  const [cart, setCart] = useState([]); // [{id, qty}]
  const [cartOpen, setCartOpen] = useState(false);
  const cartCount = cart.reduce((s, i) => s + Math.max(0, i.qty), 0);

  const cartItems = cart.map((ci) => {
    const p = products.find((pp) => pp.id === ci.id);
    if (!p) return { id: ci.id, number: "Товар", oem: "", price: 0, qty: ci.qty, images: [] };
    return { ...p, qty: ci.qty };
  });
  const cartTotal = cartItems.reduce((s, i) => s + (i.price || 0) * Math.max(0, i.qty), 0);

  function addToCart(p) {
    setCart((prev) => {
      const ex = prev.find((i) => i.id === p.id);
      if (ex)
        return prev.map((i) =>
          i.id === p.id ? { ...i, qty: Math.min((i.qty || 0) + 1, p.qty || 99) } : i
        );
      return [...prev, { id: p.id, qty: 1 }];
    });
    setCartOpen(true);
  }

  // Дозволяємо тимчасово 0; при вводі «05» стане «5»
  function updateQty(id, val) {
    let v = String(val);
    if (v === "") {
      setCart((prev) => prev.map((i) => (i.id === id ? { ...i, qty: 0 } : i)));
      return;
    }
    let n = parseInt(v, 10);
    if (Number.isNaN(n)) n = 0;
    if (v.length > 1 && v.startsWith("0")) n = parseInt(v.replace(/^0+/, ""), 10) || 0;
    n = Math.max(0, n);
    setCart((prev) => prev.map((i) => (i.id === id ? { ...i, qty: n } : i)));
  }
  function removeFromCart(id) {
    setCart((prev) => prev.filter((i) => i.id !== id));
  }

  /* ----------- Товар / Модалка ----------- */
  const [productOpen, setProductOpen] = useState(null);
  const [activeImg, setActiveImg] = useState(0);
  function openProduct(p) {
    setProductOpen(p);
    setActiveImg(0);
  }

  /* ----------- Оформлення/замовлення ----------- */
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [orderPlaced, setOrderPlaced] = useState(false);
  const [order, setOrder] = useState({
    name: "",
    phone: "", // лише 9 «національних» цифр
    delivery: "Нова пошта",
    agree: false,
  });

  // Валідація
  const nameValid = /^[A-Za-zА-Яа-яЁёІіЇїЄєҐґ'’ -]{1,30}$/.test(order.name || "");
  const phoneValid = (order.phone || "").length === 9;
  const agreeValid = !!order.agree;

  async function placeOrder() {
    if (!nameValid || !phoneValid || !agreeValid) return;
    if (cartItems.length === 0 || cartItems.some((i) => i.qty <= 0)) return;

    const payload = {
      name: order.name.trim(),
      phone: `+380${order.phone}`,
      delivery: order.delivery,
      items: cartItems
        .filter((i) => i.qty > 0)
        .map((i) => ({
          id: i.id,
          number: i.number,
          oem: i.oem,
          qty: i.qty,
          price: i.price,
        })),
      total: cartTotal,
    };

    try {
      const r = await fetch(`${API}/api/order`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!r.ok) throw new Error("Помилка запиту");
      setOrderPlaced(true);
      setCart([]);
    } catch {
      alert("Не вдалося відправити замовлення. Спробуйте ще раз.");
    }
  }

  function openCheckout() {
    setOrder({ name: "", phone: "", delivery: "Нова пошта", agree: false });
    setOrderPlaced(false);
    setCheckoutOpen(true);
  }

  /* ===================== UI ===================== */
  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-neutral-950/60 backdrop-blur-md border-b border-neutral-800">
        <div className="mx-auto max-w-7xl px-4 py-3 flex items-center gap-4">
          <div className="flex items-center gap-2">
            <img src="/dh-logo.png" alt="Diesel Hub" className="h-8 w-8 object-contain" />
            <div className="font-bold tracking-tight">Diesel Hub</div>
          </div>

          <div className="flex-1 max-w-xl">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Пошук за номером, OEM, крос-номерами, брендом..."
              className="w-full rounded-xl bg-neutral-900 border border-neutral-800 px-4 py-2 outline-none focus:border-yellow-400"
            />
          </div>

          <div className="ml-auto">
            <button
              onClick={() => setCartOpen((v) => !v)}
              className="relative rounded-xl border border-neutral-700 px-3 py-2 hover:border-yellow-400"
            >
              Кошик
              {cartCount > 0 && (
                <span className="absolute -top-2 -right-2 text-xs bg-yellow-400 text-neutral-900 rounded-full px-2 py-0.5 font-semibold">
                  {cartCount}
                </span>
              )}
            </button>
          </div>
        </div>

        <div className="border-t border-neutral-800 bg-neutral-900 text-neutral-200">
          <div className="mx-auto max-w-7xl px-4 py-2 text-center text-sm">
            Усі форсунки й ТНВД —{" "}
            <span className="text-yellow-400 font-semibold">гарантія 6 місяців</span> · перевірені
          </div>
        </div>
      </header>

      {/* Hero / Плашка */}
      <section className="border-b border-neutral-800">
        <div className="mx-auto max-w-7xl px-4 py-8 md:py-10 grid md:grid-cols-2 gap-6 items-center relative">
          <div>
            <a
              href="https://kropdieselhub.com"
              target="_blank"
              rel="noopener noreferrer"
              className="absolute right-4 top-2 md:top-4 rounded-xl border border-yellow-500/60 bg-yellow-400 text-neutral-950 px-3 py-2 text-sm font-semibold hover:brightness-95 whitespace-nowrap"
            >
              Наше СТО
            </a>
            <h1 className="text-3xl md:text-4xl font-extrabold leading-tight">
              Форсунки та ТНВД Common Rail
              <span className="block text-yellow-400">в наявності та з гарантією</span>
            </h1>
            <p className="mt-3 text-neutral-300">
              Швидкий пошук за OEM і крос-номерами. Чесний стан: нове / відновлене. Відправка по
              Україні.
            </p>
          </div>
          <div className="md:justify-self-end">
            <div className="rounded-2xl border border-neutral-800 bg-gradient-to-br from-neutral-900 to-neutral-950 p-4 mt-3">
              <ul className="text-sm text-neutral-300 space-y-2 list-disc pl-5">
                <li>
                  Фільтр за типом, виробником, станом, <span className="text-neutral-100">наявністю</span>
                </li>
                <li>
                  Картка з номером, OEM, кросами,{" "}
                  <span className="text-neutral-100">моделями авто</span> та гарантією
                </li>
                <li>Оформлення замовлення без реєстрації</li>
                <li>Партнерським СТО — знижка 10%</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Main */}
      <main className="mx-auto max-w-7xl px-4 py-8 grid grid-cols-1 md:grid-cols-12 gap-8">
        {/* Sidebar Filters */}
        <aside className="md:col-span-3 space-y-6">
          <div className="text-xs uppercase tracking-wide text-neutral-400">Фільтр</div>

          {/* Поля пошуку */}
          <div className="rounded-2xl border border-neutral-800 p-4 space-y-3">
            <label className="block">
              <div className="text-sm mb-1">Номер деталі</div>
              <input
                value={filters.number}
                onChange={(e) => setFilters((f) => ({ ...f, number: e.target.value }))}
                className="w-full rounded-lg bg-neutral-900 border border-neutral-800 px-3 py-2 text-sm outline-none focus:border-yellow-400"
              />
            </label>
            <label className="block">
              <div className="text-sm mb-1">OEM номер</div>
              <input
                value={filters.oem}
                onChange={(e) => setFilters((f) => ({ ...f, oem: e.target.value }))}
                className="w-full rounded-lg bg-neutral-900 border border-neutral-800 px-3 py-2 text-sm outline-none focus:border-yellow-400"
              />
            </label>
            <label className="block">
              <div className="text-sm mb-1">Крос-номери</div>
              <input
                value={filters.cross}
                onChange={(e) => setFilters((f) => ({ ...f, cross: e.target.value }))}
                className="w-full rounded-lg bg-neutral-900 border border-neutral-800 px-3 py-2 text-sm outline-none focus:border-yellow-400"
              />
            </label>
            <label className="block">
              <div className="text-sm mb-1">Модель авто</div>
              <input
                value={filters.carModel}
                onChange={(e) => setFilters((f) => ({ ...f, carModel: e.target.value }))}
                placeholder="Напр.: Sprinter W906, Passat B7"
                className="w-full rounded-lg bg-neutral-900 border border-neutral-800 px-3 py-2 text-sm outline-none focus:border-yellow-400"
              />
            </label>
          </div>

          {/* Тип */}
          <div className="rounded-2xl border border-neutral-800 p-4">
            <div className="font-semibold mb-2">Тип</div>
            <div className="flex flex-wrap gap-2">
              {TYPES.map((t) => (
                <button
                  key={t}
                  onClick={() =>
                    setFilters((f) => ({
                      ...f,
                      type: toggleSet(f.type, t),
                    }))
                  }
                  className={classNames(
                    "px-3 py-1 rounded-full border text-sm",
                    filters.type.has(t)
                      ? "border-yellow-400 text-yellow-400"
                      : "border-neutral-800 text-neutral-300 hover:border-neutral-600"
                  )}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* Наявність */}
          <div className="rounded-2xl border border-neutral-800 p-4">
            <div className="font-semibold mb-2">Наявність</div>
            <div className="flex flex-wrap gap-2">
              {AVAILABILITIES.map((a) => (
                <button
                  key={a}
                  onClick={() =>
                    setFilters((f) => ({
                      ...f,
                      availability: toggleSet(f.availability, a),
                    }))
                  }
                  className={classNames(
                    "px-3 py-1 rounded-full border text-sm",
                    filters.availability.has(a)
                      ? "border-yellow-400 text-yellow-400"
                      : "border-neutral-800 text-neutral-300 hover:border-neutral-600"
                  )}
                >
                  {a}
                </button>
              ))}
            </div>
          </div>

          {/* Виробник */}
          <div className="rounded-2xl border border-neutral-800 p-4">
            <div className="font-semibold mb-2">Виробник</div>
            <div className="flex flex-wrap gap-2">
              {brands.map((b) => (
                <button
                  key={b}
                  onClick={() => setFilters((f) => ({ ...f, brand: toggleSet(f.brand, b) }))}
                  className={classNames(
                    "px-3 py-1 rounded-full border text-sm",
                    filters.brand.has(b)
                      ? "border-yellow-400 text-yellow-400"
                      : "border-neutral-800 text-neutral-300 hover:border-neutral-600"
                  )}
                >
                  {b}
                </button>
              ))}
            </div>
          </div>

          {/* Стан */}
          <div className="rounded-2xl border border-neutral-800 p-4">
            <div className="font-semibold mb-2">Стан</div>
            <div className="flex flex-wrap gap-2">
              {CONDITIONS.map((c) => (
                <button
                  key={c}
                  onClick={() =>
                    setFilters((f) => ({
                      ...f,
                      condition: toggleSet(f.condition, c),
                    }))
                  }
                  className={classNames(
                    "px-3 py-1 rounded-full border text-sm",
                    filters.condition.has(c)
                      ? "border-yellow-400 text-yellow-400"
                      : "border-neutral-800 text-neutral-300 hover:border-neutral-600"
                  )}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>

          {/* Обʼєм двигуна */}
          <div className="rounded-2xl border border-neutral-800 p-4">
            <div className="font-semibold mb-2">Об'єм двигуна (л)</div>
            <div className="flex flex-wrap gap-2">
              {liters.map((l) => (
                <button
                  key={l}
                  onClick={() => setFilters((f) => ({ ...f, engine: toggleSet(f.engine, l) }))}
                  className={classNames(
                    "px-3 py-1 rounded-full border text-sm",
                    filters.engine.has(l)
                      ? "border-yellow-400 text-yellow-400"
                      : "border-neutral-800 text-neutral-300 hover:border-neutral-600"
                  )}
                >
                  {Number(l).toFixed(1)}
                </button>
              ))}
            </div>
          </div>
        </aside>

        {/* Products */}
        <section className="md:col-span-9">
          <div className="flex items-center justify-between mb-4">
            <div className="text-sm text-neutral-400">
              Знайдено: <span className="text-neutral-200 font-semibold">{filtered.length}</span>
            </div>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {shown.map((p) => (
              <article
                key={p.id}
                onClick={() => openProduct(p)}
                className="group rounded-2xl border border-neutral-800 overflow-hidden bg-neutral-900 cursor-pointer hover:border-yellow-400/70 transition-colors"
              >
                <div className="aspect-video bg-neutral-800 grid place-items-center text-neutral-400 overflow-hidden">
                  {hasImages(p.images) ? (
                    <img src={p.images[0]} alt="" className="w-full h-full object-cover" loading="lazy" />
                  ) : (
                    "Фото"
                  )}
                </div>
                <div className="p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold tracking-tight">{p.number}</h3>
                    {p.availability === "В наявності" ? (
                      <span className="text-xs px-2 py-1 rounded-full border border-emerald-400 text-emerald-400">
                        В наявності · {p.qty} шт
                      </span>
                    ) : (
                      <span className="text-xs px-2 py-1 rounded-full border border-yellow-400 text-yellow-400">
                        Під замовлення
                      </span>
                    )}
                  </div>
                  <div className="text-sm text-neutral-300">
                    OEM: <span className="text-neutral-100">{p.oem || "—"}</span>
                  </div>
                  <div className="text-sm text-neutral-300">
                    Крос: <ExpandableList items={p.cross || []} max={3} />
                  </div>
                  <div className="text-sm text-neutral-300">
                    Тип: <span className="text-neutral-100">{p.type}</span>
                  </div>
                  <div className="text-sm text-neutral-300">
                    Об'єм: <span className="text-neutral-100">{formatEngine(p.engine)}</span>
                  </div>
                  <div className="text-xs text-neutral-400">
                    {p.manufacturer} · {p.condition}
                  </div>
                  <div className="flex items-center justify-between pt-2">
                    <div className="text-lg font-bold text-yellow-400">
                      {(p.price || 0).toLocaleString("uk-UA")} ₴
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        addToCart(p);
                      }}
                      className="rounded-xl border border-yellow-500/60 text-yellow-300 hover:text-neutral-900 hover:bg-yellow-400 px-3 py-1.5 text-sm"
                    >
                      Додати
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>

          {/* Пагінація + Показати ще */}
          <div className="mt-6 flex items-center justify-between">
            {/* Пагінація */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  setMode("page");
                  setPage((p) => Math.max(1, p - 1));
                }}
                disabled={currentPage <= 1}
                className={classNames(
                  "px-3 py-1.5 rounded-lg border text-sm",
                  currentPage <= 1
                    ? "border-neutral-800 text-neutral-600 cursor-not-allowed"
                    : "border-neutral-800 text-neutral-300 hover:border-yellow-400"
                )}
              >
                ‹ Попередня
              </button>

              {pagesToShow.map((p, idx) =>
                typeof p === "number" ? (
                  <button
                    key={idx}
                    onClick={() => {
                      setMode("page");
                      setPage(p);
                    }}
                    className={classNames(
                      "min-w-9 px-3 py-1.5 rounded-lg border text-sm",
                      currentPage === p
                        ? "border-yellow-400 text-yellow-400"
                        : "border-neutral-800 text-neutral-300 hover:border-yellow-400"
                    )}
                  >
                    {p}
                  </button>
                ) : (
                  <span key={idx} className="px-2 text-neutral-600">
                    {p}
                  </span>
                )
              )}

              <button
                onClick={() => {
                  setMode("page");
                  setPage((p) => Math.min(totalPages, p + 1));
                }}
                disabled={currentPage >= totalPages}
                className={classNames(
                  "px-3 py-1.5 rounded-lg border text-sm",
                  currentPage >= totalPages
                    ? "border-neutral-800 text-neutral-600 cursor-not-allowed"
                    : "border-neutral-800 text-neutral-300 hover:border-yellow-400"
                )}
              >
                Наступна ›
              </button>
            </div>

            {/* Показати ще */}
            <div>
              <button
                onClick={() => {
                  setMode("more");
                  setVisibleCount((v) => Math.min(v + PAGE_SIZE, filtered.length));
                }}
                disabled={visibleCount >= filtered.length}
                className={classNames(
                  "rounded-xl border px-4 py-2 text-sm font-semibold",
                  visibleCount >= filtered.length
                    ? "border-neutral-800 text-neutral-600 cursor-not-allowed"
                    : "border-yellow-500/60 bg-yellow-400 text-neutral-950 hover:brightness-95"
                )}
              >
                Показати ще
              </button>
            </div>
          </div>
        </section>
      </main>

      {/* Product Modal */}
      {productOpen && (
        <div className="fixed inset-0 z-[60]">
          <div className="absolute inset-0 bg-black/60" onClick={() => setProductOpen(null)} />
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-4xl rounded-2xl border border-neutral-800 bg-neutral-950 p-5">
            <div className="flex items-start gap-6 flex-col md:flex-row">
              {/* Gallery */}
              <div className="md:w-1/2 w-full">
                <div className="aspect-video rounded-xl bg-neutral-900 grid place-items-center text-neutral-400 mb-3 overflow-hidden">
                  {hasImages(productOpen.images) ? (
                    <img
                      src={productOpen.images[activeImg]}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <>Фото {activeImg + 1}</>
                  )}
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {(productOpen.images && productOpen.images.length
                    ? productOpen.images
                    : ["1", "2", "3"]
                  ).map((img, idx) => (
                    <button
                      key={idx}
                      onClick={() => setActiveImg(idx)}
                      className={classNames(
                        "h-16 rounded-lg grid place-items-center text-xs overflow-hidden",
                        idx === activeImg
                          ? "bg-yellow-500/20 border border-yellow-500/50"
                          : "bg-neutral-900 border border-neutral-800 hover:border-neutral-700"
                      )}
                    >
                      {hasImages(productOpen.images) ? (
                        <img src={img} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <>Фото {idx + 1}</>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Info */}
              <div className="md:w-1/2 w-full">
                <div className="flex items-start justify-between gap-3">
                  <h2 className="text-xl font-bold">{productOpen.number}</h2>
                  <button
                    onClick={() => setProductOpen(null)}
                    className="text-neutral-400 hover:text-neutral-200"
                  >
                    Закрити
                  </button>
                </div>
                <div className="text-sm text-neutral-300 mt-1">
                  OEM: <span className="text-neutral-100">{productOpen.oem || "—"}</span>
                </div>
                <div className="text-sm text-neutral-300">
                  Крос: <ExpandableList items={productOpen.cross || []} max={3} />
                </div>
                <div className="text-sm text-neutral-300">
                  Тип: <span className="text-neutral-100">{productOpen.type}</span>
                </div>
                <div className="text-sm text-neutral-300">
                  Об'єм двигуна: <span className="text-neutral-100">{formatEngine(productOpen.engine)}</span>
                </div>
                <div className="text-sm text-neutral-300">
                  Моделі авто: <ExpandableList items={productOpen.models || []} max={3} />
                </div>
                <div className="text-sm text-neutral-400 mt-1">
                  {productOpen.manufacturer} · {productOpen.condition}
                </div>
                <div className="text-sm text-neutral-300 mt-1">
                  Гарантія: <span className="text-neutral-100">{getWarranty()}</span>
                  <a
                    href="/#/warranty"
                    className="ml-1 inline-flex items-center justify-center w-3 h-3 rounded-full border border-neutral-600 text-[8px] leading-none text-neutral-400 align-super hover:text-neutral-900 hover:bg-yellow-400 hover:border-yellow-400"
                    title="Детальніше про гарантію"
                    onClick={(e) => e.stopPropagation()}
                  >
                    i
                  </a>
                </div>

                <div className="flex items-center justify-between mt-4">
                  <div className="text-2xl font-extrabold text-yellow-400">
                    {(productOpen.price || 0).toLocaleString("uk-UA")} ₴
                  </div>
                  {productOpen.availability === "В наявності" ? (
                    <span className="text-xs px-2 py-1 rounded-full border border-emerald-400 text-emerald-400">
                      В наявності · {productOpen.qty} шт
                    </span>
                  ) : (
                    <span className="text-xs px-2 py-1 rounded-full border border-yellow-400 text-yellow-400">
                      Під замовлення
                    </span>
                  )}
                </div>

                <div className="flex gap-3 mt-5">
                  <button
                    onClick={() => addToCart(productOpen)}
                    className="rounded-xl border border-yellow-500/60 text-yellow-300 hover:text-neutral-900 hover:bg-yellow-400 px-4 py-2"
                  >
                    Додати до кошика
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Cart Drawer */}
      {cartOpen && (
        <div className="fixed inset-0 z-[70]">
          <div className="absolute inset-0 bg-black/60" onClick={() => setCartOpen(false)} />
          <div className="absolute right-0 top-0 h-full w-full max-w-md bg-neutral-950 border-l border-neutral-800 p-4 overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold">Кошик</h2>
              <button onClick={() => setCartOpen(false)} className="text-neutral-400 hover:text-neutral-200">
                Закрити
              </button>
            </div>

            {cartItems.length === 0 ? (
              <div className="text-neutral-400">Кошик порожній</div>
            ) : (
              <div className="space-y-4">
                {cartItems.map((item) => (
                  <div key={item.id} className="rounded-xl border border-neutral-800 p-3">
                    <div className="flex items-start gap-3">
                      <div className="h-16 w-24 rounded-lg bg-neutral-800 grid place-items-center text-neutral-400 text-xs overflow-hidden">
                        {hasImages(item.images) ? (
                          <img src={item.images[0]} alt="" className="w-full h-full object-cover" />
                        ) : (
                          "Фото"
                        )}
                      </div>
                      <div className="flex-1">
                        <div className="font-semibold">{item.number}</div>
                        <div className="text-sm text-neutral-400">OEM: {item.oem || "—"}</div>
                        <div className="flex items-center gap-2 mt-2">
                          <input
                            type="number"
                            min={0}
                            value={String(item.qty)}
                            onChange={(e) => updateQty(item.id, e.target.value)}
                            className="w-24 bg-neutral-900 border border-neutral-800 rounded-lg px-2 py-1 text-sm"
                          />
                          <button onClick={() => removeFromCart(item.id)} className="text-sm text-red-400 hover:text-red-300">
                            Видалити
                          </button>
                        </div>
                      </div>
                      <div className="font-semibold text-yellow-400">
                        {((item.price || 0) * Math.max(0, item.qty)).toLocaleString("uk-UA")} ₴
                      </div>
                    </div>
                  </div>
                ))}

                <div className="flex items-center justify-between border-t border-neutral-800 pt-3">
                  <div className="text-neutral-400">Разом</div>
                  <div className="text-lg font-bold text-yellow-400">{cartTotal.toLocaleString("uk-UA")} ₴</div>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={openCheckout}
                    disabled={cartItems.length === 0 || cartItems.some((i) => i.qty <= 0)}
                    className={classNames(
                      "flex-1 rounded-xl font-semibold py-3",
                      cartItems.length === 0 || cartItems.some((i) => i.qty <= 0)
                        ? "bg-neutral-800 text-neutral-500 cursor-not-allowed"
                        : "bg-yellow-400 text-neutral-950 hover:brightness-90"
                    )}
                  >
                    Оформити замовлення
                  </button>
                  <button
                    onClick={() => setCartOpen(false)}
                    className="rounded-xl border border-neutral-700 px-4 py-3 font-semibold hover:border-yellow-400"
                  >
                    Продовжити покупки
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Checkout Modal */}
      {checkoutOpen && (
        <div className="fixed inset-0 z-[80]">
          <div className="absolute inset-0 bg-black/60" onClick={() => setCheckoutOpen(false)} />
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-lg rounded-2xl border border-neutral-800 bg-neutral-950 p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold">Швидке замовлення</h2>
              <button onClick={() => setCheckoutOpen(false)} className="text-neutral-400 hover:text-neutral-200">
                Закрити
              </button>
            </div>

            {orderPlaced ? (
              <div className="space-y-3 text-center">
                <div className="text-2xl font-extrabold text-yellow-400">Замовлення прийнято</div>
                <div className="text-neutral-300">Менеджер зв'яжеться з вами для уточнення деталей.</div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <label className="block">
                    <div className="text-sm mb-1">Ім'я та прізвище</div>
                    <input
                      value={order.name}
                      onChange={(e) =>
                        setOrder((o) => ({
                          ...o,
                          name: e.target.value.replace(/[^A-Za-zА-Яа-яЁёІіЇїЄєҐґ'’ -]/g, "").slice(0, 30),
                        }))
                      }
                      placeholder="До 30 символів"
                      className="w-full rounded-lg bg-neutral-900 border border-neutral-800 px-3 py-2 text-sm outline-none focus:border-yellow-400 text-neutral-100"
                    />
                  </label>
                  <label className="block">
                    <div className="text-sm mb-1">Телефон</div>
                    <input
                      value={formatUAPhone(order.phone)}
                      onChange={(e) => setOrder((o) => ({ ...o, phone: normalizeUAPhoneInput(e.target.value) }))}
                      inputMode="numeric"
                      placeholder="+380 93 777 93 03"
                      className="w-full rounded-lg bg-neutral-900 border border-neutral-800 px-3 py-2 text-sm outline-none focus:border-yellow-400 text-neutral-100"
                    />
                  </label>
                </div>

                <label className="block">
                  <div className="text-sm mb-1">Спосіб доставки</div>
                  <select
                    value={order.delivery}
                    onChange={(e) => setOrder((o) => ({ ...o, delivery: e.target.value }))}
                    className="w-full rounded-lg bg-neutral-900 border border-neutral-800 px-3 py-2 text-sm outline-none focus:border-yellow-400"
                  >
                    <option>Нова пошта</option>
                    <option>Самовивіз</option>
                  </select>
                </label>

                <label className="flex items-start gap-2 text-sm text-neutral-300">
                  <input
                    type="checkbox"
                    checked={order.agree}
                    onChange={(e) => setOrder((o) => ({ ...o, agree: e.target.checked }))}
                    className="mt-1"
                  />
                  <span>
                    Я ознайомився з{" "}
                    <a href="/#/warranty" target="_blank" className="text-yellow-400 hover:underline">
                      умовами гарантії Diesel Hub
                    </a>{" "}
                    і погоджуюсь із ними.
                  </span>
                </label>

                <button
                  onClick={placeOrder}
                  disabled={
                    !nameValid || !phoneValid || !agreeValid || cartItems.length === 0 || cartItems.some((i) => i.qty <= 0)
                  }
                  className={classNames(
                    "w-full rounded-xl font-semibold py-3",
                    !nameValid ||
                      !phoneValid ||
                      !agreeValid ||
                      cartItems.length === 0 ||
                      cartItems.some((i) => i.qty <= 0)
                      ? "bg-neutral-800 text-neutral-500 cursor-not-allowed"
                      : "bg-yellow-400 text-neutral-950 hover:brightness-90"
                  )}
                >
                  Підтвердити замовлення
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="mt-16 border-t border-neutral-800">
        <div className="mx-auto max-w-7xl px-4 py-8 text-sm text-neutral-400 flex items-center justify-between">
          <div>© {new Date().getFullYear()} Diesel Hub</div>
          <div>Ремонт і продаж дизельних форсунок і ТНВД</div>
        </div>
      </footer>
    </div>
  );
}

/* helpers */
function toggleSet(set, value) {
  const s = new Set(set);
  s.has(value) ? s.delete(value) : s.add(value);
  return s;
}
