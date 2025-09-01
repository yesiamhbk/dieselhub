
// src/App.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";

/** БАЗОВЫЙ URL API (пусто в dev, на проде через VITE_API_BASE) */
const API = import.meta.env.VITE_API_BASE || "";

/* ===================== Утиліти ===================== */

function classNames(...c) {
  return c.filter(Boolean).join(" ");
}
const hasImages = (arr) => Array.isArray(arr) && arr.length > 0;

function getProductStockById(products, id) {
  const p = products.find((pp) => pp.id === id);
  const n = Number(p?.qty);
  return Number.isFinite(n) ? Math.max(0, n) : 0;
}

// Список типів — обовʼязково є "Клапан"
const TYPES = ["Форсунка", "ПНВТ", "Клапан"];
const CONDITIONS = ["Нове", "Відновлене"];
const AVAILABILITIES = ["В наявності", "Під замовлення"];

function ExpandableList({ items = [], max = 3 }) {
  const [open, setOpen] = useState(false);
  if (!items || items.length === 0) return <span className="text-neutral-400 text-left">—</span>;
  const shown = open ? items : items.slice(0, max);
  const hidden = Math.max(0, items.length - max);
  return (
    <span>
      <span className="text-neutral-100 text-left">{shown.join(", ")}</span>
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
/** Нормалізація вводу телефону:
 *  - лишає тільки цифри
 *  - якщо користувач видаляє все до межі '+380', не повертаємо '38'
 *  - відкидаємо префікс 380 лише якщо цифр >3 (це точно не межа)
 *  - рівно 9 «національних» цифр
 */
function normalizeUAPhoneInput(input) {
  let d = String(input || "").replace(/\D+/g, ""); // усі цифри з поля
  // якщо людина видаляє до межі і залишається '3', '38' або '380' — це порожньо
  if (/^3(8(0)?)?$/.test(d)) return "";
  // якщо довший за префікс і починається з 380 — прибираємо префікс
  if (d.length > 3 && d.startsWith("380")) d = d.slice(3);
  // тільки 9 цифр
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

// Header height compensation (black band under fixed header)
const headerRef = useRef(null);
const [headerHeight, setHeaderHeight] = useState(0);
useEffect(() => {
  const update = () => setHeaderHeight(headerRef.current ? headerRef.current.offsetHeight : 0);
  update();
  window.addEventListener('resize', update);
  return () => window.removeEventListener('resize', update);
}, []);


// Cleanup accidental stray text nodes like ")}" that could appear at the very bottom
useEffect(() => {
  try {
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    const toFix = [];
    let node;
    while ((node = walker.nextNode())) {
      if (node.nodeValue && node.nodeValue.trim() === ") }".replace(" ", "")) toFix.push(node);
    }
    toFix.forEach(n => (n.nodeValue = ""));
  } catch {}
}, []);

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
    // Raw query (for legacy contains checks) and normalized query (for "real-life" part numbers)
    const q = query.trim().toLowerCase();
    const normalize = (s) => String(s || "").toUpperCase().replace(/[\s\-_.]/g, "");
    const qn = normalize(query);

    const has = (str, q) => String(str || "").toLowerCase().includes(q);
    const hasN = (str, nq) => normalize(str).includes(nq);

    return products.filter((p) => {
      // Keep existing filter buckets as-is
      if (filters.brand.size && !filters.brand.has(p.manufacturer)) return false;
      if (filters.condition.size && !filters.condition.has(p.condition)) return false;
      if (filters.type.size && !filters.type.has(p.type)) return false;
      if (filters.availability.size && !filters.availability.has(p.availability)) return false;
      if (filters.engine.size && !filters.engine.has(p.engine)) return false;

      // Number filter (exact input field "Номер")
      if (filters.number) {
        const n = normalize(filters.number);
        const match =
          hasN(p.number, n) ||
          hasN(p.oem, n) ||
          (p.cross || []).some((c) => hasN(c, n));
        if (!match) return false;
      }

      // OEM and Cross filters (side filters) — support normalized includes too
      if (filters.oem && !(has(p.oem, filters.oem) || hasN(p.oem, normalize(filters.oem)))) return false;
      if (
        filters.cross &&
        !(p.cross || []).some((c) => has(c, filters.cross) || hasN(c, normalize(filters.cross)))
      ) return false;

      // Free text search — if empty, pass
      if (!q && !qn) return true;

      // Match either legacy (human-readable) or normalized (ignoring separators)
      const textMatch =
        has(p.number, q) || hasN(p.number, qn) ||
        has(p.oem, q) || hasN(p.oem, qn) ||
        (p.cross || []).some((c) => has(c, q) || hasN(c, qn)) ||
        has(p.manufacturer, q) ||
        has(p.condition, q) ||
        has(p.type, q) ||
        has(String(p.engine), q) ||
        (p.models || []).some((m) => has(m, q)) ||
        has(p.availability, q);

      return textMatch;
    });
  }, [query, filters, products]);/* ----------- Пагінація / Показати ще ----------- */
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

  // Load cart from localStorage on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem("cart");
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) setCart(parsed);
      }
    } catch {}
  }, []);

  // Save cart to localStorage on every change
  useEffect(() => {
    try { localStorage.setItem("cart", JSON.stringify(cart)); } catch {}
  }, [cart]);

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

  function addToCartN(p, n) {
    setCart((prev) => {
      const ex = prev.find((i) => i.id === p.id);
      const stock = Math.max(0, Number(p.qty) || 0);
      const already = ex ? Math.max(0, Number(ex.qty) || 0) : 0;
      const maxAdd = Math.max(0, stock - already);
      const add = Math.min(Math.max(1, Number(n) || 0), maxAdd || 0);
      if (!add) return prev;
      if (ex) return prev.map((i) => (i.id === p.id ? { ...i, qty: (i.qty || 0) + add } : i));
      return [...prev, { id: p.id, qty: add }];
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
    const stock = getProductStockById(products, id);
    if (stock && n > stock) n = stock;
    setCart((prev) => prev.map((i) => (i.id === id ? { ...i, qty: n } : i)));
  }
  function removeFromCart(id) {
    setCart((prev) => prev.filter((i) => i.id !== id));
  }

  /* ----------- Товар / Модалка ----------- */
  const [productOpen, setProductOpen] = useState(null);
  // URL sharing flag
  const startedWithParamRef = useRef(false);
  const [modalQtyStr, setModalQtyStr] = useState("1");
  const [activeImg, setActiveImg] = useState(0);
  /* ----------- Нещодавно переглянуті ----------- */
  const [recent, setRecent] = useState([]); // array of product ids (most recent first)
  // Init from localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem("recentlyViewed");
      if (raw) {
        const arr = JSON.parse(raw);
        if (Array.isArray(arr)) setRecent(arr.filter((x) => x != null));
      }
    } catch {}
  }, []);
  function pushRecent(id) {
    setRecent((prev) => {
      const arr = [id, ...prev.filter((x) => x !== id)];
      const limited = arr.slice(0, 8);
      try { localStorage.setItem("recentlyViewed", JSON.stringify(limited)); } catch {}
      return limited;
    });
  }
  function clearRecents() {
    setRecent([]);
    try { localStorage.removeItem("recentlyViewed"); } catch {}
  }
  const recentProducts = useMemo(
    () => recent.map((id) => products.find((pp) => pp.id === id)).filter(Boolean),
    [recent, products]
  );

  function openProduct(p) {
    pushRecent(p.id);
    setProductOpen(p);
    setActiveImg(0);
    setModalQtyStr("1");
    // Добавляем ?p=<id> в адресную строку для шеринга
    try {
      const url = new URL(window.location.href);
      if (url.searchParams.get("p") !== String(p.id)) {
        url.searchParams.set("p", String(p.id));
        window.history.pushState({ p: String(p.id) }, "", url.toString());
      }
    } catch {}
  }

  
  // Закрытие модалки + синхронизация URL
  function closeProduct() {
    try {
      const url = new URL(window.location.href);
      const hadParam = url.searchParams.has("p");
      setProductOpen(null);
      if (hadParam) {
        if (startedWithParamRef.current) {
          url.searchParams.delete("p");
          const qs = url.searchParams.toString();
          const clean = url.pathname + (qs ? "?" + qs : "") + url.hash;
          window.history.replaceState({}, "", clean);
          startedWithParamRef.current = false;
        } else {
          window.history.back();
        }
      }
    } catch {}
  }

  // Автооткрытие по ?p=<id> при загрузке
  useEffect(() => {
    try {
      const url = new URL(window.location.href);
      startedWithParamRef.current = url.searchParams.has("p");
      const pid = url.searchParams.get("p");
      if (pid && Array.isArray(products) && products.length) {
        const found = products.find((pp) => String(pp.id) === String(pid));
        if (found) {
          setProductOpen(found);
          setActiveImg(0);
          setModalQtyStr("1");
        }
      }
    } catch {}
  }, [products]);

  // Поддержка кнопок «Назад/Вперед»
  useEffect(() => {
    const onPop = () => {
      try {
        const url = new URL(window.location.href);
        const pid = url.searchParams.get("p");
        if (pid) {
          const found = products.find((pp) => String(pp.id) === String(pid));
          if (found) {
            setProductOpen(found);
            pushRecent(found.id);
            setActiveImg(0);
            setModalQtyStr("1");
            return;
          }
        }
        setProductOpen(null);
      } catch {}
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [products]);
/* ----------- Оформлення/замовлення ----------- */
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [orderPlaced, setOrderPlaced] = useState(false);
  const [order, setOrder] = useState({
    name: "",
    phone: "", // лише 9 «національних» цифр
    delivery: "Нова пошта",
    agree: false,
  });

  // ============ Нова пошта: стани для підказок ============
  const [npCityInput, setNpCityInput] = useState(""); // текст у полі "населений пункт"
  const [npCityList, setNpCityList] = useState([]);  // масив міст
  const [npCityOpen, setNpCityOpen] = useState(false);
  const [npCity, setNpCity] = useState(null);        // {name, ref}

  const [npType, setNpType] = useState("branch");    // 'branch' | 'postomat'

  const [npWhInput, setNpWhInput] = useState("");    // текст у полі відділення/поштомат
  const [npWhAll, setNpWhAll] = useState([]);        // всі відділення міста
  const [npWhList, setNpWhList] = useState([]);      // відфільтровані
  const [npWhOpen, setNpWhOpen] = useState(false);
  const npWhBoxRef = useRef(null);

  // автопошук міст
  useEffect(() => {
    if (!checkoutOpen) return;
    const q = npCityInput.trim();
    if (q.length < 2) {
      setNpCityList([]);
      setNpCityOpen(false);
      return;
    }
    const t = setTimeout(async () => {
      try {
        const r = await fetch(`${API}/api/np/settlements?q=${encodeURIComponent(q)}`);
        const data = await r.json();
        setNpCityList(Array.isArray(data) ? data : []);
        setNpCityOpen(true);
      } catch {
        setNpCityList([]);
        setNpCityOpen(false);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [npCityInput, checkoutOpen]);

  // завантажити відділення/поштомати при виборі міста або зміні типу
  useEffect(() => {
    let ignore = false;
    async function loadWh() {
      if (!npCity?.ref) {
        setNpWhAll([]);
        setNpWhList([]);
        return;
      }
      try {
        const r = await fetch(
          `${API}/api/np/warehouses?cityRef=${encodeURIComponent(npCity.ref)}&type=${npType}`
        );
        const data = await r.json();
        if (!ignore) {
          const arr = (Array.isArray(data) ? data : []).map((w) => ({
            ref: w.ref || w.Ref,
            number: String(w.number ?? w.Number ?? ""),
            title: w.title || w.ShortAddress || w.Description || "",
            type: w.type || w.TypeOfWarehouse || "",
          }));
          setNpWhAll(arr);
          // початково показуємо все
          setNpWhList(arr);
          setNpWhOpen(false);
        }
      } catch {
        if (!ignore) {
          setNpWhAll([]);
          setNpWhList([]);
          setNpWhOpen(false);
        }
      }
    }
    loadWh();
    return () => {
      ignore = true;
    };
  }, [npCity?.ref, npType]);

  // фільтр по номеру/адресі при вводі
  useEffect(() => {
    const term = npWhInput.trim().toLowerCase();
    if (!term) {
      setNpWhList(npWhAll);
      return;
    }
    setNpWhList(
      npWhAll.filter((w) => {
        const s = `${w.number} ${w.title}`.toLowerCase();
        return s.includes(term);
      })
    );
  }, [npWhInput, npWhAll]);

  // Закривати список відділень при кліку поза ним
  useEffect(() => {
    function onClick(e) {
      if (!npWhBoxRef.current) return;
      if (!npWhBoxRef.current.contains(e.target)) setNpWhOpen(false);
    }
    if (npWhOpen) document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [npWhOpen]);

  // Валідація
  const nameValid = /^[A-Za-zА-Яа-яЁёІіЇїЄєҐґ'’ -]{1,30}$/.test(order.name || "");
  const phoneValid = (order.phone || "").length === 9;
  const agreeValid = !!order.agree;

  async function placeOrder() {
    if (!nameValid || !phoneValid || !agreeValid) return;
    if (cartItems.length === 0 || cartItems.some((i) => i.qty <= 0)) return;

    // Формуємо зручний рядок доставки
    let delivery = order.delivery;
    if (delivery === "Нова пошта") {
      const city = npCity?.name || npCityInput || "";
      const wh =
        npWhInput ||
        (npWhList && npWhList.length
          ? `${npType === "postomat" ? "Поштомат" : "Відділення"} №${
              npWhList[0].number
            } — ${npWhList[0].title}`
          : "");
      if (city || wh) delivery = `Нова пошта: ${city}${wh ? `, ${wh}` : ""}`;
    }

    const payload = {
      name: order.name.trim(),
      phone: `+380${order.phone}`,
      delivery,
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
    setNpCityInput("");
    setNpCity(null);
    setNpType("branch");
    setNpWhInput("");
    setNpWhAll([]);
    setNpWhList([]);
    setOrderPlaced(false);
    setCheckoutOpen(true);
  }

  /* ===================== UI ===================== */
  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100">
      {/* Header */}
      <header ref={headerRef} className="fixed top-0 inset-x-0 z-50 bg-neutral-950/60 backdrop-blur-md border-b border-neutral-800">
        <div className="mx-auto max-w-7xl px-4 py-3 flex items-center gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <img src="/dh-logo.png" alt="Diesel Hub" className="h-8 w-8 object-contain" />
            <div className="font-bold tracking-tight">Diesel Hub</div>
          </div>

          <div className="flex-1 max-w-xl">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Пошук за номером, OEM, кросс-номерами, брендом..."
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
            Усі форсунки й ПНВТ —{" "}
            <span className="text-yellow-400 font-semibold">гарантія 6 місяців</span> · перевірені
          </div>
        </div>
      
</header>
      {/* Spacer under header so it doesn't overlap content */}
      <div aria-hidden className="bg-neutral-950" style={{height: headerHeight}} />


      
        <div className="h-16 sm:h-20"></div>
{/* Hero / Плашка */}
      <section className="border-b border-neutral-800">
        <div className="mx-auto max-w-7xl px-4 py-8 md:py-10 grid md:grid-cols-2 gap-6 items-center relative">
          <div>
            <div className="absolute right-4 -top-8 md:-top-12 flex flex-col items-end gap-2">
  <a
    href="#/trade-in"
    className="rounded-2xl border border-yellow-500/60 bg-yellow-400 text-neutral-900 px-4 py-2 text-base font-semibold hover:brightness-95 whitespace-nowrap"
  >
    Обмін
  </a>
  <a
    href="https://kropdieselhub.com"
    target="_blank"
    rel="noopener noreferrer"
    className="rounded-2xl border border-neutral-700 px-4 py-2.5 text-base font-semibold hover:brightness-95 whitespace-nowrap"
  >
    Наше СТО
  </a>
</div>
            <h1 className="text-3xl md:text-4xl font-extrabold leading-tight">
              Форсунки та ПНВТ Common Rail
              <span className="block text-yellow-400">в наявності та з гарантією</span>
            </h1>
            <p className="mt-3 text-neutral-300">
              Швидкий пошук за OEM і кросс-номерами. Чесний стан: нове / відновлене. Відправка по
              Україні.
            </p>
          </div>
          <div className="md:justify-self-end">
            <div className="rounded-2xl border border-neutral-800 bg-gradient-to-br from-neutral-900 to-neutral-950 p-4 mt-3">
              <ul className="text-sm text-neutral-300 space-y-2 list-disc pl-5">
                <li>
                  Фільтр за типом, виробником, станом, <span className="text-neutral-100 text-left">наявністю</span>
                </li>
                <li>
                  Картка з номером, OEM, кросс-номерами,{" "}
                  <span className="text-neutral-100 text-left">моделями авто</span> та гарантією
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
        <aside className="md:col-span-3"><div className="space-y-6 md:sticky md:top-0 md:min-h-screen md:flex md:flex-col md:justify-end">
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
              <div className="text-sm mb-1">Кросс-номери</div>
              <input
                value={filters.cross}
                onChange={(e) => setFilters((f) => ({ ...f, cross: e.target.value }))}
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
        </div></aside>

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
                    OEM Номер: <span className="text-neutral-100 text-left">{p.oem || "—"}</span>
                  </div>
                  <div className="text-sm text-neutral-300">
                    Кросс: <ExpandableList items={p.cross || []} max={2} />
                  </div>
                  <div className="text-sm text-neutral-300">
                    Тип деталі: <span className="text-neutral-100 text-left">{p.type}</span>
                  </div>
                  <div className="text-sm text-neutral-300">
                    Об'єм: <span className="text-neutral-100 text-left">{formatEngine(p.engine)}</span>
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
          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
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
          <div className="absolute inset-0 bg-black/60" onClick={closeProduct} />
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
                  <h2 className="text-xl font-bold flex items-baseline gap-3">{productOpen.number}<span className="text-sm text-neutral-400 font-normal">{productOpen.manufacturer} · {productOpen.condition}</span></h2>
                  <button
                    onClick={closeProduct}
                    className="text-neutral-400 hover:text-neutral-200"
                  >
                    Закрити
                  </button>
                </div>
                <div className="mt-3 border border-neutral-800 rounded-xl overflow-hidden">
  <div className="divide-y divide-neutral-800 text-sm">
    <div className="flex flex-wrap items-baseline gap-2 px-3 py-2">
      <span className="text-neutral-400 text-left">OEM Номер:</span>
      <span className="text-neutral-100 text-left">{productOpen.oem || "—"}</span>
    </div>
    <div className="flex flex-wrap items-baseline gap-2 px-3 py-2">
      <span className="text-neutral-400 text-left">Кросс номери:</span>
      <span className="text-neutral-100 text-left"><ExpandableList items={productOpen.cross || []} max={2} /></span>
    </div>
    <div className="flex flex-wrap items-baseline gap-2 px-3 py-2">
      <span className="text-neutral-400 text-left">Тип деталі:</span>
      <span className="text-neutral-100 text-left">{productOpen.type}</span>
    </div>
    <div className="flex flex-wrap items-baseline gap-2 px-3 py-2">
      <span className="text-neutral-400 text-left">Обʼєм двигуна</span>
      <span className="text-neutral-100 text-left">{formatEngine(productOpen.engine)}</span>
    </div>
    <div className="flex flex-wrap items-baseline gap-2 px-3 py-2">
      <span className="text-neutral-400 text-left">Гарантія</span>
      <span className="text-neutral-100 text-left">{getWarranty()} <a href="/#/warranty" onClick={(e)=>e.stopPropagation()} className="ml-1 underline decoration-dotted hover:text-yellow-400">детальніше</a></span>
    </div>
  </div>
</div>
<div className="flex items-center justify-between mt-4">
                  <div className="flex items-center gap-2"><span className="text-white font-semibold text-2xl"><span className="text-white font-semibold text-2xl">Ціна</span></span> <div className="text-2xl font-extrabold text-yellow-400">
                    {(productOpen.price || 0).toLocaleString("uk-UA")} ₴
                  </div></div>
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
                  <div className="flex items-center gap-3 mt-5">
  <label className="text-white text-sm">Кількість:</label>
  <input type="number"
         min={1}
         value={modalQtyStr}
         onChange={(e)=>{
           const raw = e.target.value; if (raw === "") { setModalQtyStr(""); return; }
           let n = parseInt(raw,10); if (!Number.isFinite(n)) n = 0; n = Math.max(0,n);
           const inCart = (cart.find(c=>c.id===productOpen?.id)?.qty || 0);
           const stock = Math.max(0, Number(productOpen?.qty)||0);
           const maxAdd = Math.max(0, stock - inCart);
           if (maxAdd && n > maxAdd) n = maxAdd;
           setModalQtyStr(String(n));
         }}
         className="w-20 bg-neutral-900 border border-neutral-800 rounded-lg px-2 py-1 text-sm" />
  <button
    onClick={() => {
      const parsed = parseInt(modalQtyStr || "0", 10) || 0;
      const inCart = (cart.find(c=>c.id===productOpen?.id)?.qty || 0);
      const stock = Math.max(0, Number(productOpen?.qty)||0);
      const maxAdd = Math.max(0, stock - inCart);
      const addN = Math.min(Math.max(1, parsed), maxAdd || 0);
      if (!addN) return;
      addToCartN(productOpen, addN);
    }}
    disabled={(parseInt(modalQtyStr || "0", 10) || 0) < 1 || Math.max(0, (Number(productOpen?.qty)||0) - (cart.find(c=>c.id===productOpen?.id)?.qty || 0)) === 0}
    className="rounded-xl border border-yellow-500/60 bg-yellow-400 text-neutral-950 hover:bg-yellow-300 hover:text-neutral-900 px-4 py-2 disabled:opacity-50 disabled:cursor-not-allowed"
  >
    Додати до кошика
  </button>
</div>
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
              <div className="text-neutral-400 text-left">Кошик порожній</div>
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
                            max={getProductStockById(products, item.id) || undefined}
                            value={String(item.qty)}
                            onChange={(e) => {
                              const stock = getProductStockById(products, item.id);
                              let n = parseInt(e.target.value || "0", 10);
                              if (!Number.isFinite(n)) n = 0;
                              if (stock && n > stock) n = stock;
                              updateQty(item.id, String(n));
                              if (String(n) !== e.target.value) e.target.value = String(n);
                            }}
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
                  <div className="text-neutral-400 text-left">Разом</div>
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

                {/* Доставка: Нова пошта */}
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

                {order.delivery === "Нова пошта" && (
                  <>
                    {/* Населений пункт */}
                    <div className="relative">
                      <div className="text-sm mb-1">Населений пункт</div>
                      <input
                        value={npCityInput}
                        onChange={(e) => {
                          setNpCityInput(e.target.value);
                          setNpCity(null);
                          setNpWhAll([]);
                          setNpWhList([]);
                          setNpWhInput("");
                        }}
                        onFocus={() => npCityList.length && setNpCityOpen(true)}
                        placeholder="Почніть вводити..."
                        className="w-full rounded-lg bg-neutral-900 border border-neutral-800 px-3 py-2 text-sm outline-none focus:border-yellow-400"
                      />
                      {npCity && (
                        <div className="mt-1 text-xs text-neutral-400">Обране місто: {npCity.name}</div>
                      )}

                      {npCityOpen && npCityList.length > 0 && (
                        <div className="absolute left-0 right-0 top-[68px] z-[95] max-h-60 overflow-auto rounded-xl border border-neutral-800 bg-neutral-950 shadow-lg">
                          {npCityList.map((c, idx) => (
                            <button
                              key={idx}
                              onMouseDown={(e) => {
                                e.preventDefault();
                                setNpCity({ name: c.Present || c.name || "", ref: c.Ref || c.settlementRef || c.DeliveryCity || "" });
                                setNpCityInput(c.Present || c.name || "");
                                setNpCityOpen(false);
                              }}
                              className="w-full text-left px-3 py-2 hover:bg-neutral-800"
                            >
                              {c.Present || c.name}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Тип отримання */}
                    <div className="flex items-center gap-4">
                      <label className="flex items-center gap-2">
                        <input
                          type="radio"
                          name="np-type"
                          checked={npType === "branch"}
                          onChange={() => setNpType("branch")}
                        />
                        <span>Відділення</span>
                      </label>
                      <label className="flex items-center gap-2">
                        <input
                          type="radio"
                          name="np-type"
                          checked={npType === "postomat"}
                          onChange={() => setNpType("postomat")}
                        />
                        <span>Поштомат</span>
                      </label>
                    </div>

                    {/* Відділення / Поштомат */}
                    <div className="relative" ref={npWhBoxRef}>
                      <div className="text-sm mb-1">Відділення / Поштомат</div>
                      <input
                        value={npWhInput}
                        onChange={(e) => {
                          setNpWhInput(e.target.value);
                          setNpWhOpen(true);
                        }}
                        onFocus={() => setNpWhOpen(true)}
                        placeholder="№ відділення / поштомату або адреса"
                        className="w-full rounded-lg bg-neutral-900 border border-neutral-800 px-3 py-2 text-sm outline-none focus:border-yellow-400"
                      />
                      {npWhOpen && npWhList.length > 0 && (
                        <div className="absolute left-0 right-0 top-[68px] z-[96] max-h-64 overflow-auto rounded-xl border border-neutral-800 bg-neutral-950 shadow-lg">
                          {npWhList.map((w, idx) => (
                            <button
                              key={w.ref || idx}
                              onMouseDown={(e) => {
                                e.preventDefault();
                                const label = `${npType === "postomat" ? "Поштомат" : "Відділення"} №${w.number} — ${w.title}`;
                                setNpWhInput(label);
                                setNpWhOpen(false);
                              }}
                              className="w-full text-left px-3 py-2 hover:bg-neutral-800"
                            >
                              <div className="font-medium">
                                {npType === "postomat" ? "Поштомат" : "Відділення"} №{w.number}
                              </div>
                              <div className="text-xs text-neutral-400">{w.title}</div>
                            </button>
                          ))}
                        </div>
                      )}
                      {npWhOpen && npWhList.length === 0 && (
                        <div className="absolute left-0 right-0 top-[68px] z-[96] rounded-xl border border-neutral-800 bg-neutral-950 p-3 text-sm text-neutral-400">
                          Немає підказок — введіть номер або адресу.
                        </div>
                      )}
                    </div>
                  </>
                )}

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

      
      
      {/* Нещодавно переглянуті */}
      {recentProducts.length > 0 && (
        <section className="mt-10 mb-6">
          <div className="mx-auto max-w-7xl px-4">
            <div className="grid grid-cols-1 md:grid-cols-12">
              <div className="hidden md:block md:col-span-3"></div>
              <div className="md:col-span-9">
                <div className="flex items-center justify-between mb-2 px-1">
                  <h2 className="text-[13px] uppercase tracking-wider text-neutral-400">Нещодавно переглянуті</h2>
                  <button
                    onClick={clearRecents}
                    className="text-[12px] text-neutral-500 hover:text-neutral-300 transition-colors"
                  >
                    Очистити
                  </button>
                </div>
                <div className="rv-strip flex gap-3 overflow-x-auto pb-2 -mx-1 px-1">
                  {recentProducts.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => openProduct(p)}
                      className="rv-card shrink-0 w-[160px] md:w-[180px] bg-neutral-950/60 border border-neutral-800 rounded-2xl hover:border-yellow-500/60 transition-colors transform hover:-translate-y-0.5 active:translate-y-0 text-left"
                    >
                      <div className="rv-thumb w-full aspect-[4/3] overflow-hidden rounded-t-2xl bg-neutral-900">
                        {Array.isArray(p.images) && p.images.length > 0 ? (
                          <img src={p.images[0]} alt={p.number ? `${p.number} — ${p.manufacturer || ''}` : ''} className="w-full h-full object-cover" loading="lazy" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-sm text-neutral-500">Фото</div>
                        )}
                      </div>
                      <div className="rv-meta p-3 space-y-1">
                        <div className="rv-name text-sm font-medium leading-tight truncate" title={p.number}>{p.number}</div>
                        <div className="rv-oem text-[12px] text-neutral-400 truncate" title={p.oem ? `OEM: ${p.oem}` : ''}>
                          OEM: <span className="text-neutral-300">{p.oem || "—"}</span>
                        </div>
                        <div className="rv-row flex items-center justify-between pt-1">
                          <span className="rv-cond text-[11px] px-2 py-0.5 rounded-full border border-neutral-700 text-neutral-300">
                            {p.condition || "—"}
                          </span>
                          <span className="rv-price text-[13px] font-semibold text-yellow-400">
                            {(p.price || 0).toLocaleString("uk-UA")} ₴
                          </span>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
                {/* Скрыть полосы прокрутки у блока "Нещодавно переглянуті" */}
                <style>
                  {`
                    .rv-strip::-webkit-scrollbar { display: none; }
                    .rv-strip { scrollbar-width: none; -ms-overflow-style: none; }
                  `}
                </style>
              </div>
            </div>
          </div>
        </section>
      )}

      )}

      {/* Footer */}
      <footer className="mt-16 border-t border-neutral-800">
        <div className="mx-auto max-w-7xl px-4 py-8 text-sm text-neutral-400 flex items-center justify-between">
          <div>© {new Date().getFullYear()} Diesel Hub</div>
          <div>Ремонт і продаж дизельних форсунок і ПНВТ</div>
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
