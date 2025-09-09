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
function normalizeUAPhoneInput(input) {
  const raw = String(input || "");
  const all = raw.replace(/\D+/g, "");
  const idx = all.indexOf("380");
  let d = idx !== -1 ? all.slice(idx + 3) : all;
  d = d.replace(/^0+/, "");
  return d.slice(0, 9);
}
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
  const formatPhoneMask = (digits) => {
    const s = String(digits || "").replace(/\D/g, "").slice(0, 9);
    const a = s.slice(0,2);
    const b = s.slice(2,5);
    const c = s.slice(5,7);
    const d = s.slice(7,9);
    let out = "";
    if (a) out = "(" + a + ")";
    if (b) out += (out? " " : "") + b;
    if (c) out += "-" + c;
    if (d) out += "-" + d;
    return out;
  };

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
    const q = query.trim().toLowerCase();
    const normalize = (s) => String(s || "").toUpperCase().replace(/[\s\-_.]/g, "");
    const qn = normalize(query);

    const has = (str, q) => String(str || "").toLowerCase().includes(q);
    const hasN = (str, nq) => normalize(str).includes(nq);

    return products.filter((p) => {
      if (filters.brand.size && !filters.brand.has(p.manufacturer)) return false;
      if (filters.condition.size && !filters.condition.has(p.condition)) return false;
      if (filters.type.size && !filters.type.has(p.type)) return false;
      if (filters.availability.size && !filters.availability.has(p.availability)) return false;
      if (filters.engine.size && !filters.engine.has(p.engine)) return false;

      if (filters.number) {
        const n = normalize(filters.number);
        const match =
          hasN(p.number, n) ||
          hasN(p.oem, n) ||
          (p.cross || []).some((c) => hasN(c, n));
        if (!match) return false;
      }

      if (filters.oem && !(has(p.oem, filters.oem) || hasN(p.oem, normalize(filters.oem)))) return false;
      if (
        filters.cross &&
        !(p.cross || []).some((c) => has(c, filters.cross) || hasN(c, normalize(filters.cross)))
      ) return false;

      if (!q && !qn) return true;

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

  useEffect(() => {
    try {
      const raw = localStorage.getItem("cart");
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) setCart(parsed);
      }
    } catch {}
  }, []);
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
      const isPreorder = stock === 0;
      const maxAdd = isPreorder ? 99 : Math.max(0, stock - already);
      const add = Math.min(Math.max(1, Number(n) || 0), maxAdd);
      if (!add) return prev;
      if (ex) return prev.map((i) => (i.id === p.id ? { ...i, qty: (i.qty || 0) + add } : i));
      return [...prev, { id: p.id, qty: add }];
    });
    setCartOpen(true);
  }

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
  const startedWithParamRef = useRef(false);
  const [modalQtyStr, setModalQtyStr] = useState("1");
  const [activeImg, setActiveImg] = useState(0);
  /* ----------- Нещодавно переглянуті ----------- */
  const [recent, setRecent] = useState([]);
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
    try {
      const url = new URL(window.location.href);
      if (url.searchParams.get("p") !== String(p.id)) {
        url.searchParams.set("p", String(p.id));
        window.history.pushState({ p: String(p.id) }, "", url.toString());
      }
    } catch {}
  }

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
    phone: "",
    delivery: "Нова пошта",
    agree: false,
  });

  // ============ Нова пошта: стани для підказок ============
  const [npCityInput, setNpCityInput] = useState("");
  const [npCityList, setNpCityList] = useState([]);
  const [npCityOpen, setNpCityOpen] = useState(false);
  const [npCity, setNpCity] = useState(null);
  const npCitySelectRef = useRef(false);
  const [npType, setNpType] = useState("branch");
  const [npWhInput, setNpWhInput] = useState("");
  const [npWhAll, setNpWhAll] = useState([]);
  const [npWhList, setNpWhList] = useState([]);
  const [npWhOpen, setNpWhOpen] = useState(false);
  const npWhBoxRef = useRef(null);

  useEffect(() => {
    if (!checkoutOpen) return;
    if (npCitySelectRef.current) { npCitySelectRef.current = false; setNpCityOpen(false); setNpCityList([]); return; }
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

  useEffect(() => {
    function onClick(e) {
      if (!npWhBoxRef.current) return;
      if (!npWhBoxRef.current.contains(e.target)) setNpWhOpen(false);
    }
    if (npWhOpen) document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [npWhOpen]);

  const nameValid = /^[A-Za-zА-Яа-яЁёІіЇїЄєҐґ'’ -]{1,30}$/.test(order.name || "");
  const phoneValid = (order.phone || "").length === 9;
  const agreeValid = !!order.agree;

  async function placeOrder() {
    if (!nameValid || !phoneValid || !agreeValid) return;
    if (cartItems.length === 0 || cartItems.some((i) => i.qty <= 0)) return;

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
          availability: i.availability,
          condition: i.condition,
          type: i.type,
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

          {/* Кнопки в шапке — фирменный жёлтый */}
          


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
      </header>

      {/* Spacer under header so it doesn't overlap content */}
      <div aria-hidden style={{height: headerHeight}} />

      {/* Hero / Плашка */}
      <section className="border-b border-neutral-800">
        <div className="mx-auto max-w-7xl px-4 py-8 md:py-10 grid md:grid-cols-2 gap-6 items-center relative">
          <div>
            {/* Мобильные CTA — обе жёлтые */}
            <div className="absolute right-4 -top-8 md:-top-12 flex flex-col items-end gap-2 md:hidden">
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
                className="rounded-2xl border border-yellow-500/60 bg-yellow-400 text-neutral-900 px-4 py-2 text-base font-semibold hover:brightness-95 whitespace-nowrap"
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
              <ul className="text-base text-white leading-tight space-y-1 list-disc pl-5">
  <li>
    <a href="#/warranty" className="text-white hover:underline">Ознайомитися з умовами гарантії</a>
  </li>
  <li>
    <a href="#/trade-in" className="text-white hover:underline">Обміняти свої деталі</a>
  </li>
  <li>
    <a href="#/partners-sto" className="text-white hover:underline">Партнерство для СТО</a>
  </li>
  <li>
    <a href="https://kropdieselhub.com" target="_blank" rel="noopener noreferrer" className="text-white hover:underline">Наше СТО</a>
  </li>
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
                className="group rounded-2xl border border-neutral-800 overflow-hidden bg-neutral-900 cursor-pointer flex flex-col hover:border-yellow-400/70 transition-colors"
              >
                <div className="aspect-video bg-neutral-800 grid place-items-center text-neutral-400 overflow-hidden">
                  {hasImages(p.images) ? (
                    <img src={p.images[0]} alt="" className="w-full h-full object-cover" loading="lazy" />
                  ) : (
                    "Фото"
                  )}
                </div>
                <div className="p-4 space-y-2 flex-1 flex flex-col">
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
                  <div className="flex items-center justify-between mt-auto pt-2">
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
                        const isPreorder = stock === 0;
                        const maxAdd = isPreorder ? 99 : Math.max(0, stock - inCart);
                        const addN = Math.min(Math.max(1, parsed), maxAdd);
                        if (!addN) return;
                        addToCartN(productOpen, addN);
                      }}
                      disabled={(parseInt(modalQtyStr || "0", 10) || 0) < 1 || ((Math.max(0, Number(productOpen?.qty)||0) > 0) && ((Math.max(0, Number(productOpen?.qty)||0) - (cart.find(c=>c.id===productOpen?.id)?.qty || 0)) <= 0))}
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
                      <div className="w-24">
                        <div className="h-16 w-24 rounded-lg bg-neutral-800 grid place-items-center text-neutral-400 text-xs overflow-hidden">
                          {hasImages(item.images) ? (
                            <img src={item.images[0]} alt="" className="w-full h-full object-cover" />
                          ) : (
                            "Фото"
                          )}
                        </div>
                        <div className="mt-1 w-24">
                          {((getProductStockById(products, item.id) || 0) > 0) ? (
                            <span className="block w-full text-center text-[11px] py-[3px] rounded-full border border-green-400 text-green-400">В наявності</span>
                          ) : (
                            <span className="block w-full text-center text-[11px] py-[3px] rounded-full border border-yellow-400 text-yellow-400">1–3 дні</span>
                          )}
                        </div>
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

                <div className="flex items-center justify-between gap-2">
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
      
{/* Checkout Modal (safe) */}
{checkoutOpen && (
  <div className="fixed inset-0 z-[80]">
    <div className="absolute inset-0 bg-black/60" onClick={() => setCheckoutOpen(false)} />
    <div className="absolute inset-x-0 top-10 mx-auto max-w-4xl bg-neutral-950 border border-neutral-800 rounded-2xl overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-800">
        <div className="text-lg font-semibold">Оформлення</div>
        <button onClick={() => setCheckoutOpen(false)} className="text-neutral-400 hover:text-neutral-200">Закрити</button>
      </div>

      {/* Контент: скролл внутрь, чтобы окно было ниже */}
      <div className="p-3 max-h-[78vh] overflow-y-auto">
        {orderPlaced && (
          <div className="py-10 flex flex-col items-center text-center gap-4">
            <div className="h-16 w-16 rounded-full border border-emerald-400 bg-emerald-500/10 grid place-items-center">
              <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" className="text-emerald-400">
                <path d="M20 6L9 17l-5-5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"></path>
              </svg>
            </div>
            <h3 className="text-2xl font-extrabold text-white">Дякуємо! Замовлення прийнято</h3>
            <p className="text-neutral-300 max-w-md">Ми зв’яжемося з вами найближчим часом для підтвердження та відправлення.</p>
            <div className="text-sm text-neutral-400 space-y-1">
              <div>Телефон: <span className="text-neutral-100">{formatUAPhone(order.phone || "")}</span></div>
              {order.delivery === "Нова пошта" && (
                <div>Доставка: <span className="text-neutral-100">Нова пошта{npCityInput ? `: ${npCityInput}` : ""}{npWhInput ? `, ${npWhInput}` : ""}</span></div>
              )}
              {order.delivery === "Самовивіз" && (
                <div>Спосіб доставки: <span className="text-neutral-100">Самовивіз</span></div>
              )}
              <div>Оплата: <span className="text-neutral-100">{order.payment || (order.delivery === "Нова пошта" ? "Передплата по реквізитам" : "Готівковий розрахунок")}</span></div>
            </div>
            <div className="flex gap-2 pt-2">
              <button
                onClick={() => { setCheckoutOpen(false); setCartOpen(false); }}
                className="rounded-xl border border-yellow-500/60 bg-yellow-400 text-neutral-950 px-4 py-2 font-semibold hover:brightness-95"
              >
                Повернутися до каталогу
              </button>
              <button
                onClick={() => { setCheckoutOpen(false); }}
                className="rounded-xl border border-neutral-700 px-4 py-2 font-semibold hover:border-yellow-400"
              >
                Закрити
              </button>
            </div>
          </div>
        )}
        <div className={classNames("grid md:grid-cols-2 gap-4", orderPlaced && "hidden")}>
          {/* Left: Form */}
          <div className="space-y-3">
            <label className="block">
              <div className="text-sm mb-1">ПІБ</div>
              <input
                maxLength={50}
                value={order.name || ""}
                onChange={(e)=>{ const v=(e.target.value||"").replace(/[0-9]/g,""); setOrder(o=>({...o, name: v})); }}
                className="w-full rounded-lg bg-neutral-900 border border-neutral-800 px-3 py-2 text-sm outline-none focus:border-yellow-400"
                placeholder="Введіть ПІБ"
              />
            </label>

            <label className="block">
              <div className="text-sm mb-1">Телефон</div>
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center justify-center rounded-lg bg-neutral-900 border border-neutral-800 px-3 py-2 text-sm select-none">+380</span>
                <input
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={18}
                  value={formatPhoneMask(order.phone || "")}
                  onChange={(e)=>{ const d=(e.target.value||"").replace(/\D/g,"").slice(0,9); setOrder(o=>({...o, phone:d})); }}
                  onKeyDown={(e) => { if (e.key === "Backspace") { const input = e.target; const before = (input.value || "").slice(0, input.selectionStart || 0); const digitsBefore = (before.match(/\d/g) || []).length; const prev = (order.phone || ""); if (digitsBefore > 0) { const next = prev.slice(0, digitsBefore - 1) + prev.slice(digitsBefore); setOrder(o => ({ ...o, phone: next })); e.preventDefault(); } } }}
                        className="flex-1 rounded-lg bg-neutral-900 border border-neutral-800 px-3 py-2 text-sm outline-none focus:border-yellow-400"
                  placeholder="(XX) XXX-XX-XX"
                />
              </div>
            </label>

            <div>
              <div className="text-sm mb-1">Спосіб доставки</div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={()=>{
                    setOrder(o=>({
                      ...o,
                      delivery: "Нова пошта",
                      payment: o.payment || "Передплата по реквізитам",
                    }));
                  }}
                  className={classNames("px-3 py-1.5 rounded-lg border text-sm", order.delivery==="Нова пошта" ? "border-yellow-400 text-yellow-400" : "border-neutral-700")}
                >
                  Нова пошта
                </button>
                <button
                  type="button"
                  onClick={()=>{
                    setOrder(o=>({
                      ...o,
                      delivery: "Самовивіз",
                      payment: o.payment === "Накладений платіж" ? "Готівковий розрахунок" : (o.payment || "Готівковий розрахунок"),
                    }));
                    setNpCity(null); setNpCityInput(""); setNpCityList([]); setNpCityOpen(false);
                    setNpWhInput(""); setNpWhList([]); setNpWhOpen(false);
                  }}
                  className={classNames("px-3 py-1.5 rounded-lg border text-sm", order.delivery==="Самовивіз" ? "border-yellow-400 text-yellow-400" : "border-neutral-700")}
                >
                  Самовивіз
                </button>
              </div>
            </div>

            {order.delivery === "Нова пошта" && (
              <div className="space-y-3">
                {/* City */}
                <div className="relative">
                  <div className="text-sm mb-1">Місто</div>
                  <input
                    value={npCityInput}
                    onChange={(e)=>setNpCityInput(e.target.value)}
                    onFocus={()=>{ if (npCitySelectRef.current) { npCitySelectRef.current = false; return; } if (npCityList.length) setNpCityOpen(true); }}
                    className="w-full rounded-lg bg-neutral-900 border border-neutral-800 px-3 py-2 text-sm outline-none focus:border-yellow-400"
                    placeholder="Почніть вводити..."
                  />
                  {npCityOpen && npCityList && npCityList.length > 0 && (
                    <div className="absolute z-[160] mt-1 w-full max-h-56 overflow-auto rounded-lg border border-neutral-800 bg-neutral-900">
                      {npCityList.map((c, idx) => {
                        const label = c.Present || c.name || c.Description || c.MainDescription || "";
                        const ref = c.SettlementRef || c.ref || c.Ref || "";
                        return (
                          <button
                            key={ref || idx}
                            onMouseDown={(e)=>e.preventDefault()}
                            onClick={()=>{
                              const text = label;
                              npCitySelectRef.current = true;
                              setNpCity({ name: text, ref });
                              setNpCityInput(text);
                              setNpCityOpen(false);
                              setNpCityList([]);
                              setNpWhInput(""); setNpWhList([]); setNpWhOpen(false);
                            }}
                            className="block w-full text-left px-3 py-2 hover:bg-neutral-800 text-white"
                          >
                            {label || "—"}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* NP type */}
                <div className="flex gap-2">
                  <button type="button" onClick={()=>setNpType("branch")} className={classNames("px-3 py-1.5 rounded-lg border text-sm", npType==="branch"?"border-yellow-400 text-yellow-400":"border-neutral-700")}>Відділення</button>
                  <button type="button" onClick={()=>setNpType("postomat")} className={classNames("px-3 py-1.5 rounded-lg border text-sm", npType==="postomat"?"border-yellow-400 text-yellow-400":"border-neutral-700")}>Поштомат</button>
                </div>

                {/* Warehouse */}
                <div className="relative">
                  <div className="text-sm mb-1">Відділення / Поштомат</div>
                  <input
                    value={npWhInput}
                    onChange={(e)=>{ setNpWhInput(e.target.value); setNpWhOpen(true); }}
                    onFocus={()=>{ if (npWhList.length) setNpWhOpen(true); }}
                    className="w-full rounded-lg bg-neutral-900 border border-neutral-800 px-3 py-2 text-sm outline-none focus:border-yellow-400"
                    placeholder="Почніть вводити..."
                  />
                  {npWhOpen && npWhList && npWhList.length > 0 && (
                    <div className="absolute z-[160] mt-1 w-full max-h-56 overflow-auto rounded-lg border border-neutral-800 bg-neutral-900">
                      {npWhList.map((w, idx) => (
                        <button
                          key={(w.ref || idx) + "-" + (w.number || "")}
                          onMouseDown={(e)=>e.preventDefault()}
                          onClick={()=>{
                            const txt = `${npType === "postomat" ? "Поштомат" : "Відділення"} №${w.number} — ${w.title}`;
                            setNpWhInput(txt);
                            setNpWhOpen(false);
                            setNpWhList([]);
                          }}
                          className="block w-full text-left px-3 py-2 hover:bg-neutral-800 text-white"
                        >
                          {(npType === "postomat" ? "Поштомат" : "Відділення")} №{w.number} — {w.title}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Payment select for NP */}
                <label className="block">
                  <div className="text-sm mb-1">Спосіб оплати</div>
                  <select
                    value={order.payment || "Передплата по реквізитам"}
                    onChange={(e)=>setOrder(o=>({...o, payment: e.target.value}))}
                    className="w-full rounded-lg bg-neutral-900 border border-neutral-800 px-3 py-2 text-sm outline-none focus:border-yellow-400"
                  >
                    <option value="Передплата по реквізитам">Передплата по реквізитам</option>
                    <option value="Накладений платіж">Накладений платіж</option>
                  </select>

{order.payment === "Накладений платіж" && (
  <div className="mt-1 text-xs text-neutral-400">
    Комісія Нової пошти ~2% + 20 грн (оплачує покупець).
  </div>
)}

                </label>
              </div>
            )}

            {/* Payment for Pickup */}
            {order.delivery === "Самовивіз" && (
              <label className="block">
                <div className="text-sm mb-1">Спосіб оплати</div>
                <select
                  value={order.payment || "Готівковий розрахунок"}
                  onChange={(e)=>setOrder(o=>({...o, payment: e.target.value}))}
                  className="w-full rounded-lg bg-neutral-900 border border-neutral-800 px-3 py-2 text-sm outline-none focus:border-yellow-400"
                >
                  <option value="Передплата по реквізитам">Передплата по реквізитам</option>
                  <option value="Готівковий розрахунок">Готівковий розрахунок</option>
                </select>
              </label>
            )}

            {/* Checkboxes */}
            <label className="flex items-center gap-2 mt-2">
              <input type="checkbox" checked={!!order.agree} onChange={(e)=>setOrder(o=>({...o, agree:e.target.checked}))} />
              <span className="text-sm text-white">Підтверджую, що ознайомився з <a href="/#/warranty" className="text-yellow-400 underline hover:text-yellow-300">гарантією</a> та умовами повернення</span>
            </label>

            <label className="flex items-center gap-2">
              <input type="checkbox" checked={!!order.agreePD} onChange={(e)=>setOrder(o=>({...o, agreePD:e.target.checked}))} />
              <span className="text-sm text-white">Надаю згоду на обробку моїх персональних даних</span>
            </label>
          </div>

          {/* Right: Summary + Submit full width */}
          <div className="rounded-xl border border-neutral-800 p-3 flex flex-col">
            <div className="text-white text-lg mb-2">Ваше замовлення</div>
            <div className="space-y-3 max-h-80 overflow-auto pr-2">
  {cartItems.map((it, idx) => {
    const name = (it.name || it.title || it.model || it.number || it.id || "").toString();
    const primary = (name ? name : `${it.number || ""}${it.oem ? ' / ' + it.oem : ''}`);
    const rawState = (it.state || it.condition || it.cond || it.status || "");
    let state = "";
    if (typeof rawState === "string") {
      const s = rawState.toLowerCase();
      state = s.includes("віднов") || s.includes("reman") || s.includes("refurb") ? "Відновлене"
            : (s.includes("нов") || s.includes("new") ? "Нове" : rawState);
    }
    const stockNum = (typeof it.stock === "number" ? it.stock : (typeof it.available === "number" ? it.available : null));
    const avail = it.availability || it.availabilityText || it.avail || (stockNum !== null ? (stockNum > 0 ? "В наявності" : "Під замовлення") : "");
    const partTypeRaw = (it.type || it.partType || it.category || it.group || "").toString();
    const partType = partTypeRaw ? partTypeRaw.charAt(0).toUpperCase() + partTypeRaw.slice(1).toLowerCase() : "";
    const qty = Math.max(1, it.qty || 1);
    const sum = ((it.price || 0) * qty).toLocaleString("uk-UA");
    return (
      <div key={it.id || idx} className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="truncate font-semibold uppercase">{primary}</div>
          <div className="text-xs text-neutral-400">{[partType, state, avail].filter(Boolean).join(" · ")}</div>
          <div className="text-xs text-neutral-400 mt-0.5">{qty} шт.</div>
        </div>
        <div className="text-sm whitespace-nowrap">{sum} ₴</div>
      </div>
    );
  })}
</div>
            <div className="flex items-center justify-between border-t border-neutral-800 mt-2 pt-2">
              <div className="text-white text-lg">Разом</div>
              <div className="font-semibold text-yellow-400">{cartTotal.toLocaleString("uk-UA")} ₴</div>
            </div>
            {/* Submit full width under total */}
            <div className="pt-3">
              {(() => {
                const nameValid = /^[A-Za-zА-Яа-яЁёІіЇїЄєҐґ'’ -]{1,50}$/.test(order.name || "");
                const phoneValid = /^[0-9]{9}$/.test(order.phone || "");
                const paymentValue = order.payment || (order.delivery === "Нова пошта" ? "Передплата по реквізитам" : "Готівковий розрахунок");
                const agreeValid = !!order.agree && !!order.agreePD;
                const cityOk = order.delivery === "Нова пошта" ? !!(npCityInput && npWhInput) : true;
                const okToSubmit = nameValid && phoneValid && agreeValid && !!paymentValue && cityOk && cartItems.length>0 && !cartItems.some(i=>i.qty<=0);
                return (
                  <button
                    onClick={placeOrder}
                    disabled={!okToSubmit}
                    className={classNames(
                      "w-full rounded-xl font-semibold py-3",
                      !okToSubmit ? "bg-neutral-800 text-neutral-500 cursor-not-allowed" : "bg-yellow-400 text-neutral-950 hover:brightness-90"
                    )}
                  >
                    Підтвердити замовлення
                  </button>
                );
              })()}
            </div>
          </div>
        </div>
      </div>
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
