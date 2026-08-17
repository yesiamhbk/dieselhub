// src/App.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { captureAttribution, trackEvent, trackSearch } from "./analytics.js";
import { applyProductSeo, productPath, resetSeo } from "./seo.js";

/** БАЗОВЫЙ URL API (пусто в dev, на проде через VITE_API_BASE) */
const API = import.meta.env.VITE_API_BASE || "";
const KROP_SITE_URL = "https://www.kropdieselhub.com/";
const LEGACY_COPPER_WASHER_ID = "cart-addon-copper-washer";
const COPPER_WASHER_PREFIX = "cart-addon-copper-washer:";
const COPPER_WASHER_PRODUCT = Object.freeze({
  oem: "",
  manufacturer: "Diesel Hub",
  condition: "Нове",
  type: "Комплектуючі",
  availability: "В наявності",
  price: 100,
  images: [],
  qty: 9999,
  isCartAddon: true,
});

function copperWasherIdFor(productId) {
  return `${COPPER_WASHER_PREFIX}${productId}`;
}

function isCopperWasherId(id) {
  return String(id || "").startsWith(COPPER_WASHER_PREFIX);
}

function copperWasherParentId(id) {
  return isCopperWasherId(id) ? String(id).slice(COPPER_WASHER_PREFIX.length) : "";
}

/* ===================== Утиліти ===================== */

function classNames(...c) {
  return c.filter(Boolean).join(" ");
}
const hasImages = (arr) => Array.isArray(arr) && arr.length > 0;

function getProductStockById(products, id) {
  if (isCopperWasherId(id)) return COPPER_WASHER_PRODUCT.qty;
  const p = products.find((pp) => pp.id === id);
  const n = Number(p?.qty);
  return Number.isFinite(n) ? Math.max(0, n) : 0;
}

// Список типів — обовʼязково є "Клапан"
const TYPES = ["Форсунка", "ПНВТ", "Клапан", "Ремкомплект", "Коннектор", "Гайка", "Пружина розпилювача"];

// === Групи типів для фільтра «Тип» (рівно 3 кнопки) ===
const TYPE_GROUPS = [
  { id: 'inj',   label: 'Форсунки' },
  { id: 'pnbt',  label: 'ПНВТ' },
  { id: 'parts', label: 'Комплектуючі' },
];
function getTypeGroup(type) {
  if (type === 'Форсунка') return 'inj';
  if (type === 'ПНВТ') return 'pnbt';
  return 'parts';
}

const CONDITIONS = ["Нове", "Відновлене"];
const AVAILABILITIES = ["В наявності", "Під замовлення"];

function normalizePartNumber(value) {
  return String(value || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

// Ефективна наявність з урахуванням кількості
function effectiveAvailability(p) {
  const raw = (p && typeof p.availability === "string") ? p.availability : "";
  const qty = Number(p && p.qty) || 0;
  // Якщо заявлено "В наявності" і є штучний залишок >0 — показуємо "В наявності"
  // В усіх інших випадках — "Під замовлення"
  return (raw === "В наявності" && qty > 0) ? "В наявності" : "Під замовлення";
}

function ProductCrosses({ items = [], highlight = "" }) {
  const [open, setOpen] = useState(false);
  const values = Array.isArray(items) ? items.filter(Boolean) : [];
  const normalizedHighlight = normalizePartNumber(highlight);
  const matched = normalizedHighlight
    ? values.find((value) => normalizePartNumber(value) === normalizedHighlight)
    : null;
  const ordered = matched ? [matched, ...values.filter((value) => value !== matched)] : values;
  const visible = open ? ordered : ordered.slice(0, 1);
  const hidden = Math.max(0, values.length - 1);

  return (
    <div className={classNames("product-crosses", open && "expanded")}>
      <dt>Крос-номери</dt>
      <dd>
        <span className="product-cross-values" title={values.join(", ")}>
          {visible.length > 0 ? visible.map((value) => (
            <span key={value} className={value === matched ? "matched" : ""}>{value}</span>
          )) : <span>—</span>}
        </span>
        {hidden > 0 && (
          <button
            type="button"
            className="product-cross-more"
            aria-expanded={open}
            aria-label={open ? "Згорнути крос-номери" : `Показати ще ${hidden} крос-номерів`}
            onClick={(event) => {
              event.stopPropagation();
              setOpen((value) => !value);
            }}
          >{open ? "↑" : `↓ +${hidden}`}</button>
        )}
      </dd>
    </div>
  );
}

function getWarranty() {
  return "6 місяців";
}
function formatEngine(v) {
  const n = Number(v);
  return Number.isFinite(n) ? `${n.toFixed(1)} л` : "—";
}

export function getPaginationItems(totalPages, currentPage) {
  if (totalPages <= 9) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  if (currentPage <= 4) {
    return [1, 2, 3, 4, "…", totalPages - 2, totalPages - 1, totalPages];
  }

  if (currentPage >= totalPages - 3) {
    return [1, 2, 3, "…", totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
  }

  return [1, 2, "…", currentPage - 1, currentPage, currentPage + 1, "…", totalPages - 1, totalPages];
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
  const heroSearchRef = useRef(null);
  const [persistentSearchVisible, setPersistentSearchVisible] = useState(false);
  useEffect(() => {
    const update = () => setHeaderHeight(headerRef.current ? headerRef.current.offsetHeight : 0);
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  useEffect(() => {
    const search = heroSearchRef.current;
    if (!search || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      ([entry]) => setPersistentSearchVisible(!entry.isIntersecting),
      { threshold: 0.15, rootMargin: `-${headerHeight}px 0px 0px 0px` }
    );
    observer.observe(search);
    return () => observer.disconnect();
  }, [headerHeight]);

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
  useEffect(() => { captureAttribution(); trackEvent("visit"); }, []);
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

  
  // Мобільний тумблер для додаткових фільтрів
  const [moreFiltersOpen, setMoreFiltersOpen] = useState(false);
  const catalogRef = useRef(null);
/* ----------- Дані товарів ----------- */
  const [products, setProducts] = useState([]);
  const [productsLoading, setProductsLoading] = useState(true);
  const [usingDemoCatalog, setUsingDemoCatalog] = useState(false);
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const response = await fetch(`${API}/api/products`);
        const data = response.ok ? await response.json() : [];
        if (Array.isArray(data) && data.length) {
          if (!cancelled) setProducts(data);
          return;
        }
      } catch {}

      if (import.meta.env.DEV) {
        try {
          const demoResponse = await fetch('/__demo/products.json');
          const demo = demoResponse.ok ? await demoResponse.json() : [];
          if (!cancelled && Array.isArray(demo)) {
            setProducts(demo);
            setUsingDemoCatalog(true);
          }
        } catch {}
      }
    };

    load().finally(() => {
      if (!cancelled) setProductsLoading(false);
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

  const activeFilterCount = useMemo(
    () =>
      filters.brand.size +
      filters.condition.size +
      filters.type.size +
      filters.availability.size +
      filters.engine.size +
      [filters.number, filters.oem, filters.cross, filters.carModel].filter(Boolean).length,
    [filters]
  );

  function resetFilters() {
    setFilters({
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
    setQuery("");
  }

  function focusCatalog() {
    catalogRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const normalize = normalizePartNumber;
    const qn = normalize(query);

    const has = (str, q) => String(str || "").toLowerCase().includes(q);
    const hasN = (str, nq) => normalize(str).includes(nq);

    return products.filter((p) => {
      if (filters.brand.size && !filters.brand.has(p.manufacturer)) return false;
      if (filters.condition.size && !filters.condition.has(p.condition)) return false;
      if (filters.type.size && !filters.type.has(getTypeGroup(p.type))) return false;
      if (filters.availability.size && !filters.availability.has(effectiveAvailability(p))) return false;
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

  const queryLooksLikePartNumber = useMemo(() => {
    const normalized = normalizePartNumber(query);
    return normalized.length >= 5 && /\d/.test(normalized);
  }, [query]);

  
  // Сортування каталогу (закріплені вгорі, потім за порядком, далі за id)
  const filteredSorted = useMemo(() => {
    const arr = Array.isArray(filtered) ? [...filtered] : [];
    return arr.sort((a, b) => {
      const ap = a && (a.pinned ? 1 : 0);
      const bp = b && (b.pinned ? 1 : 0);
      if (bp !== ap) return bp - ap;
      const ao = Number(a && a.sort_order != null ? a.sort_order : 0) || 0;
      const bo = Number(b && b.sort_order != null ? b.sort_order : 0) || 0;
      if (bo !== ao) return bo - ao;
      return Number(b && b.id || 0) - Number(a && a.id || 0);
    });
  }, [filtered]);
/* ----------- Пагінація / Показати ще ----------- */
  const PAGE_SIZE = 12;
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [page, setPage] = useState(1);
  const [mode, setMode] = useState("page");
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
    setPage(1);
    setMode("page");
  }, [query, filters, products]);

  const totalPages = Math.max(1, Math.ceil(filteredSorted.length / PAGE_SIZE));
  const currentPage = mode === "page" ? Math.min(page, totalPages) : 1;
  const shown =
    mode === "more"
      ? filteredSorted.slice(0, visibleCount)
      : filteredSorted.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const paginationPage = mode === "more"
    ? Math.min(totalPages, Math.max(1, Math.ceil(visibleCount / PAGE_SIZE)))
    : currentPage;
  
  const pagesToShow = getPaginationItems(totalPages, paginationPage);

  const goToCatalogPage = (nextPage) => {
    const safePage = Math.min(totalPages, Math.max(1, nextPage));
    setMode("page");
    setPage(safePage);
    window.requestAnimationFrame(() => catalogRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };

  const showMoreProducts = () => {
    const nextCount = mode === "more"
      ? visibleCount + PAGE_SIZE
      : Math.max(visibleCount, currentPage * PAGE_SIZE) + PAGE_SIZE;
    setMode("more");
    setVisibleCount(Math.min(nextCount, filteredSorted.length));
  };

  /* ----------- Кошик ----------- */
  const [cart, setCart] = useState([]); // [{id, qty}]
  const [cartOpen, setCartOpen] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("cart");
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) setCart(parsed.filter((item) => item?.id !== LEGACY_COPPER_WASHER_ID));
      }
    } catch {}
  }, []);
  useEffect(() => {
    if (usingDemoCatalog) setCart([]);
  }, [usingDemoCatalog]);
  useEffect(() => {
    try { localStorage.setItem("cart", JSON.stringify(cart)); } catch {}
  }, [cart]);

  const cartCount = cart.reduce((s, i) => s + Math.max(0, i.qty), 0);

  const cartItems = cart.map((ci) => {
    if (isCopperWasherId(ci.id)) {
      const parentProductId = ci.parentProductId || copperWasherParentId(ci.id);
      const parentProduct = products.find((product) => String(product.id) === String(parentProductId));
      const linkedProductNumber = ci.linkedProductNumber || parentProduct?.number || "форсунки";
      return {
        ...COPPER_WASHER_PRODUCT,
        id: ci.id,
        number: `Мідна шайба до форсунки ${linkedProductNumber}`,
        qty: ci.qty,
        parentProductId,
        linkedProductNumber,
      };
    }
    const p = products.find((pp) => pp.id === ci.id);
    if (!p) return { id: ci.id, number: "Товар", oem: "", price: 0, qty: ci.qty, images: [] };
    return { ...p, qty: ci.qty };
  });
  const primaryCartItems = cartItems.filter((item) => !item.isCartAddon);
  const washersByParentId = new Map(
    cartItems
      .filter((item) => item.isCartAddon)
      .map((item) => [String(item.parentProductId), item])
  );
  const cartTotal = cartItems.reduce((s, i) => s + (i.price || 0) * Math.max(0, i.qty), 0);

  function addToCart(p) {
    trackEvent("add_to_cart", { product_id: p.id, product_number: p.number, quantity: 1, value: Number(p.price || 0) });
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
    trackEvent("add_to_cart", { product_id: p.id, product_number: p.number, quantity: Math.max(1, Number(n) || 1), value: Number(p.price || 0) });
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

  function addCopperWasherForInjector(injector) {
    const washerId = copperWasherIdFor(injector.id);
    const suggestedQuantity = Math.max(1, Number(injector.qty) || 0);
    setCart((prev) => {
      const existing = prev.find((item) => item.id === washerId);
      if (existing) {
        return prev.map((item) => item.id === washerId
          ? { ...item, qty: Math.max(1, Number(item.qty) || 0) + suggestedQuantity }
          : item);
      }

      const next = [...prev];
      const injectorIndex = next.findIndex((cartItem) => cartItem.id === injector.id);
      next.splice(injectorIndex >= 0 ? injectorIndex + 1 : next.length, 0, {
        id: washerId,
        qty: suggestedQuantity,
        parentProductId: injector.id,
        linkedProductNumber: injector.number,
      });
      return next;
    });
  }

  function updateQty(id, val) {
    let v = String(val);
    let n = parseInt(v, 10);
    if (Number.isNaN(n)) n = 0;
    if (v.length > 1 && v.startsWith("0")) n = parseInt(v.replace(/^0+/, ""), 10) || 0;
    n = Math.max(0, n);
    const stock = getProductStockById(products, id);
    if (stock && n > stock) n = stock;
    setCart((prev) => {
      const currentQty = Number(prev.find((item) => item.id === id)?.qty) || 0;
      return prev.map((item) => {
        if (item.id === id) return { ...item, qty: n };
        if (String(item.parentProductId || copperWasherParentId(item.id)) === String(id) && Number(item.qty) === currentQty) {
          return { ...item, qty: n };
        }
        return item;
      });
    });
  }
  function removeFromCart(id) {
    setCart((prev) => prev.filter((item) => (
      item.id !== id && String(item.parentProductId || copperWasherParentId(item.id)) !== String(id)
    )));
  }

  /* ----------- Товар / Модалка ----------- */
  const [productOpen, setProductOpen] = useState(null);
  const startedWithParamRef = useRef(false);
  const [modalQtyStr, setModalQtyStr] = useState("1");
  const [activeImg, setActiveImg] = useState(0);
  const [productTab, setProductTab] = useState("info");

  // Комплектуючі для відкритого товару
  const compatKeys = useMemo(() => {
    if (!productOpen) return new Set();
    const arr = [];
    if (productOpen.number) arr.push(String(productOpen.number));
    if (productOpen.oem) arr.push(String(productOpen.oem));
    if (Array.isArray(productOpen.cross)) arr.push(...productOpen.cross);
    return new Set(arr.map((x) => String(x).trim().toUpperCase()));
  }, [productOpen]);

  const compatProducts = useMemo(() => {
    if (!productOpen) return [];
    return products.filter((pp) =>
      Array.isArray(pp?.compat_for) &&
      pp.compat_for.some((x) => compatKeys.has(String(x).trim().toUpperCase()))
    );
  }, [products, productOpen, compatKeys]);

  const modalProductInCart = productOpen
    ? Math.max(0, Number(cart.find((item) => item.id === productOpen.id)?.qty) || 0)
    : 0;
  const modalProductStock = productOpen ? Math.max(0, Number(productOpen.qty) || 0) : 0;
  const modalMaxAdd = productOpen
    ? (modalProductStock === 0 ? 99 : Math.max(0, modalProductStock - modalProductInCart))
    : 0;
  const modalSelectedQty = Math.max(1, parseInt(modalQtyStr || "1", 10) || 1);

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
    setProductTab("info");
    setActiveImg(0);
    setModalQtyStr("1");
    try {
      const path = productPath(p);
      if (window.location.pathname !== path) window.history.pushState({ productNumber: p.number }, "", path);
    } catch {}
    applyProductSeo(p);
    trackEvent("product_view", { product_id: p.id, product_number: p.number });
  }

  function closeProduct() {
    try {
      setProductOpen(null);
      resetSeo();
      if (window.location.pathname.startsWith("/product/")) window.history.pushState({}, "", "/");
    } catch {}
  }

  useEffect(() => {
    try {
      const legacyId = new URL(window.location.href).searchParams.get("p");
      const routeNumber = decodeURIComponent(window.location.pathname.match(/^\/product\/([^/]+)\/?$/)?.[1] || "");
      if ((legacyId || routeNumber) && Array.isArray(products) && products.length) {
        const key = normalizePartNumber(routeNumber);
        const found = products.find((pp) => legacyId ? String(pp.id) === String(legacyId) : [pp.number, pp.oem, ...(pp.cross || [])].some(value => normalizePartNumber(value) === key));
        if (found) {
          setProductOpen(found);
          setActiveImg(0);
          setModalQtyStr("1");
          applyProductSeo(found);
          if (window.location.pathname !== productPath(found)) window.history.replaceState({ productNumber: found.number }, "", productPath(found));
        }
      }
    } catch {}
  }, [products]);

  useEffect(() => {
    const onPop = () => {
      try {
        const routeNumber = decodeURIComponent(window.location.pathname.match(/^\/product\/([^/]+)\/?$/)?.[1] || "");
        if (routeNumber) {
          const key = normalizePartNumber(routeNumber);
          const found = products.find((pp) => [pp.number, pp.oem, ...(pp.cross || [])].some(value => normalizePartNumber(value) === key));
          if (found) {
            setProductOpen(found);
            pushRecent(found.id);
            setActiveImg(0);
            setModalQtyStr("1");
            applyProductSeo(found);
            return;
          }
        }
        setProductOpen(null);
        resetSeo();
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
    agreeLegal: false,
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
    const overlayOpen = Boolean(productOpen || cartOpen || checkoutOpen);
    if (!overlayOpen) return;

    const scrollY = window.scrollY;
    const previous = {
      htmlOverflow: document.documentElement.style.overflow,
      bodyOverflow: document.body.style.overflow,
      bodyPosition: document.body.style.position,
      bodyTop: document.body.style.top,
      bodyWidth: document.body.style.width,
    };

    document.documentElement.style.overflow = "hidden";
    document.body.style.overflow = "hidden";
    document.body.style.position = "fixed";
    document.body.style.top = `-${scrollY}px`;
    document.body.style.width = "100%";

    return () => {
      document.documentElement.style.overflow = previous.htmlOverflow;
      document.body.style.overflow = previous.bodyOverflow;
      document.body.style.position = previous.bodyPosition;
      document.body.style.top = previous.bodyTop;
      document.body.style.width = previous.bodyWidth;
      window.scrollTo(0, scrollY);
    };
  }, [productOpen, cartOpen, checkoutOpen]);

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
  const agreeValid = !!order.agree && !!order.agreeLegal;

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
      payment: order.payment || (order.delivery === "Нова пошта" ? "Передплата по реквізитам" : "Готівковий розрахунок"),
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
      attribution: captureAttribution(),
    };

    try {
      const r = await fetch(`${API}/api/order`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!r.ok) throw new Error("Помилка запиту");
      setOrderPlaced(true);
      trackEvent("order", { value: cartTotal, item_count: cartItems.length });
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
    trackEvent("checkout_start", { value: cartTotal, item_count: cartItems.length });
  }

  /* ===================== UI ===================== */
  return (
    <div className="brand-shell min-h-screen text-neutral-100">
      <header ref={headerRef} className="modern-header fixed top-0 inset-x-0 z-50">
        <div className="modern-nav">
          <div className="mx-auto max-w-7xl px-4 md:px-5 flex h-16 items-center gap-5">
            <a href="#/" className="flex shrink-0 items-center gap-2.5" aria-label="Diesel Hub — головна">
              <img src="/dh-logo-brand.png" alt="" className="brand-logo h-10 w-10 object-contain" />
              <div className="brand-wordmark font-extrabold tracking-tight">Diesel Hub</div>
            </a>
            <nav className="modern-links hidden lg:flex items-center gap-6 ml-5" aria-label="Основна навігація">
              <button type="button" onClick={focusCatalog}>Каталог</button>
              <a href="#/warranty">Гарантія</a>
              <a href="#/trade-in">Trade-in</a>
              <a href="#/partners-sto">Для СТО</a>
            </nav>
            <div className="ml-auto flex items-center gap-2 md:gap-3">
              <a href="tel:+380665507055" className="modern-phone-number hidden md:inline-flex">066 550 70 55</a>
              <a href="tel:+380665507055" className="modern-phone hidden sm:inline-flex">Допомога з підбором</a>
              <button
                onClick={() => setCartOpen((value) => !value)}
                className="modern-cart relative"
              >
                <span>Кошик</span>
                {cartCount > 0 && <b>{cartCount}</b>}
              </button>
            </div>
          </div>
        </div>
      </header>

      <div aria-hidden style={{ height: headerHeight }} />

      <form
        className={classNames("persistent-search", persistentSearchVisible && "visible")}
        style={{ top: Math.max(0, headerHeight - 1) }}
        onSubmit={(event) => {
          event.preventDefault();
          trackSearch(query, filteredSorted.length);
          focusCatalog();
        }}
      >
        <div className="mx-auto max-w-7xl px-4 md:px-5">
          <div className="persistent-search-inner">
            <span aria-hidden>⌕</span>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Номер, OEM або крос-номер"
              aria-label="Закріплений пошук у каталозі"
            />
            <button type="submit">Знайти</button>
          </div>
        </div>
      </form>

      <section className="modern-hero">
        <div className="mx-auto max-w-7xl px-4 md:px-5 py-12 md:py-16 grid lg:grid-cols-[minmax(0,1.08fr)_minmax(360px,.72fr)] gap-12 items-center relative z-10">
          <div>
            <div className="modern-kicker">DIESEL HUB</div>
            <h1>
              Форсунки та ПНВТ від{" "}
              <a className="krop-site-link" href={KROP_SITE_URL} target="_blank" rel="noreferrer">Krop Diesel Hub</a>
            </h1>
            <div className="hero-promise" aria-label="Нові та реставровані деталі з гарантією">
              <span>Нові</span>
              <span>Реставровані</span>
              <span>З гарантією</span>
            </div>

            <div className="hero-actions hero-actions-compact">
              <a href="tel:+380665507055" className="hero-primary">Підібрати з консультантом</a>
              <a href="#/trade-in" className="hero-secondary hero-secondary-button">Обміняти старі запчастини <span>→</span></a>
            </div>

            <form
              ref={heroSearchRef}
              className="hero-search"
              onSubmit={(event) => {
                event.preventDefault();
                trackSearch(query, filteredSorted.length);
                focusCatalog();
              }}
            >
              <span aria-hidden>⌕</span>
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Введіть номер деталі, OEM або виробника"
                aria-label="Пошук у каталозі"
              />
              <button type="submit">Знайти деталь</button>
            </form>
          </div>

          <div className="hero-visual" aria-label="Переваги Diesel Hub">
            <div className="hero-logo-orbit">
              <img src="/dh-logo2-brand.png" alt="Форсунки та ПНВТ Diesel Hub" />
            </div>
            <div className="hero-proof-panel">
              <small>
                Стандарт{" "}
                <a className="krop-site-link" href={KROP_SITE_URL} target="_blank" rel="noreferrer">Krop Diesel Hub</a>
              </small>
              <div className="hero-proof-values">
                <span><strong>200+</strong><em>позицій у каталозі</em></span>
                <span className="hero-proof-warranty"><strong>6 місяців</strong><em>гарантії</em></span>
                <span><strong>Перевірено</strong><em>перед відправкою</em></span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section ref={catalogRef} className="catalog-shell scroll-mt-32">
        <div className="mx-auto max-w-7xl px-4 md:px-5 py-7 md:py-10">
          <div className="catalog-toolbar catalog-toolbar-first">
            <div className="catalog-results">
              <h2>Каталог</h2>
              <span className="catalog-count"><b>{filtered.length}</b> {filtered.length === 1 ? "товар знайдено" : "товарів знайдено"}</span>
              {usingDemoCatalog && <em>Локальне демо</em>}
            </div>
            <div className="catalog-toolbar-actions">
              {activeFilterCount > 0 && <button type="button" onClick={resetFilters}>Скинути все</button>}
              <button type="button" className="filter-toggle" onClick={() => setMoreFiltersOpen((value) => !value)}>
                Фільтри {activeFilterCount > 0 && <b>{activeFilterCount}</b>}
              </button>
            </div>
          </div>

          <div className="catalog-layout">
            <aside className={classNames("filter-panel", moreFiltersOpen ? "mobile-open" : "")}>
              <div className="filter-panel-head">
                <div><span>Фільтри</span><small>Уточніть параметри</small></div>
                {activeFilterCount > 0 && <button type="button" onClick={resetFilters}>Очистити</button>}
              </div>

              <div className="filter-section">
                <label className="filter-label">Номер або OEM</label>
                <input
                  value={filters.number}
                  onChange={(event) => setFilters((current) => ({ ...current, number: event.target.value }))}
                  placeholder="Наприклад, 0445..."
                  className="filter-input"
                />
              </div>

              <div className="filter-section">
                <div className="filter-label">Тип деталі</div>
                <div className="filter-options">
                  <button
                    type="button"
                    className={filters.type.size === 0 ? "active" : ""}
                    onClick={() => setFilters((current) => ({ ...current, type: new Set() }))}
                  >Усі деталі</button>
                  {TYPE_GROUPS.map((group) => (
                    <button
                      type="button"
                      key={group.id}
                      className={filters.type.has(group.id) ? "active" : ""}
                      onClick={() => setFilters((current) => ({ ...current, type: toggleSet(current.type, group.id) }))}
                    >{group.label}</button>
                  ))}
                </div>
              </div>

              <div className="filter-section">
                <div className="filter-label">Наявність</div>
                <div className="filter-options">
                  {AVAILABILITIES.map((availability) => (
                    <button
                      type="button"
                      key={availability}
                      className={filters.availability.has(availability) ? "active" : ""}
                      onClick={() => setFilters((current) => ({ ...current, availability: toggleSet(current.availability, availability) }))}
                    >{availability}</button>
                  ))}
                </div>
              </div>

              <div className="filter-section">
                <div className="filter-label">Виробник</div>
                <div className="filter-options">
                  {brands.map((brand) => (
                    <button
                      type="button"
                      key={brand}
                      className={filters.brand.has(brand) ? "active" : ""}
                      onClick={() => setFilters((current) => ({ ...current, brand: toggleSet(current.brand, brand) }))}
                    >{brand}</button>
                  ))}
                </div>
              </div>

              <div className="filter-section">
                <div className="filter-label">Стан</div>
                <div className="filter-options">
                  {CONDITIONS.map((condition) => (
                    <button
                      type="button"
                      key={condition}
                      className={filters.condition.has(condition) ? "active" : ""}
                      onClick={() => setFilters((current) => ({ ...current, condition: toggleSet(current.condition, condition) }))}
                    >{condition}</button>
                  ))}
                </div>
              </div>

              <div className="filter-section">
                <div className="filter-label">Обʼєм двигуна</div>
                <div className="filter-options compact">
                  {liters.map((liter) => (
                    <button
                      type="button"
                      key={liter}
                      className={filters.engine.has(liter) ? "active" : ""}
                      onClick={() => setFilters((current) => ({ ...current, engine: toggleSet(current.engine, liter) }))}
                    >{Number(liter).toFixed(1)} л</button>
                  ))}
                </div>
              </div>
            </aside>

            <div className="products-column">
              {productsLoading ? (
                <div className="catalog-grid" aria-label="Завантаження товарів">
                  {Array.from({ length: 6 }, (_, index) => <div className="product-skeleton" key={index} />)}
                </div>
              ) : shown.length === 0 ? (
                queryLooksLikePartNumber ? (
                  <div className="number-help-card">
                    <div className="number-help-content">
                      <div className="number-help-kicker">Не знайшли в каталозі?</div>
                      <h3>Зателефонуйте менеджеру — він допоможе знайти деталь</h3>
                      <p>Перевіримо OEM і крос-номери, сумісність та актуальну наявність.</p>
                      <div className="number-help-query"><span>Номер для перевірки</span><b>{query.trim()}</b></div>
                      <button className="number-help-reset" type="button" onClick={resetFilters}>Показати весь каталог</button>
                    </div>
                    <a href="tel:+380665507055" className="number-help-contact" aria-label="Зателефонувати менеджеру з підбору за номером 066 550 70 55">
                      <span>Менеджер з підбору</span>
                      <strong>066 550 70 55</strong>
                      <small>Натисніть, щоб зателефонувати</small>
                    </a>
                  </div>
                ) : (
                  <div className="empty-catalog">
                    <img src="/dh-logo2-brand.png" alt="" />
                    <h3>За цими параметрами нічого не знайдено</h3>
                    <p>Спробуйте змінити запит або очистити частину фільтрів.</p>
                    <button type="button" onClick={resetFilters}>Показати всі товари</button>
                  </div>
                )
              ) : (
                <div className="catalog-grid">
                  {shown.map((product) => (
                    <article key={product.id} className="product-card" onClick={() => openProduct(product)}>
                      <div className="product-image">
                        {hasImages(product.images) ? (
                          <img src={product.images[0]} alt={`${product.type} ${product.number}`} loading="lazy" />
                        ) : (
                          <img className="product-placeholder" src="/dh-logo2-brand.png" alt="Фото готується" />
                        )}
                        <span className="product-type">{product.type}</span>
                        <span className={classNames("product-stock", effectiveAvailability(product) === "В наявності" ? "in-stock" : "preorder")}>
                          {effectiveAvailability(product) === "В наявності" ? `В наявності · ${product.qty} шт` : "Під замовлення"}
                        </span>
                      </div>
                      <div className="product-content">
                        <div className="product-brand">{product.manufacturer} · {product.condition}</div>
                        <h3>{product.number}</h3>
                        {(product.cross || []).some((cross) => normalizePartNumber(cross) === normalizePartNumber(query)) && query.trim() && (
                          <div className="product-cross-match">Знайдено за крос-номером <b>{query.trim()}</b></div>
                        )}
                        <dl>
                          <div><dt>OEM</dt><dd>{product.oem || "—"}</dd></div>
                          <ProductCrosses items={product.cross || []} highlight={query} />
                          {Number(product.engine) > 0 && <div className="product-card-engine"><dt>Двигун</dt><dd>{formatEngine(product.engine)}</dd></div>}
                          <div className="product-card-warranty"><dt>Гарантія</dt><dd>6 місяців</dd></div>
                        </dl>
                        <div className="product-footer">
                          <div><small>Ціна</small><strong>{(product.price || 0).toLocaleString("uk-UA")} ₴</strong></div>
                          <button
                            type="button"
                            onClick={(event) => { event.stopPropagation(); addToCart(product); }}
                            aria-label={`Додати ${product.number} до кошика`}
                          >До кошика <span>＋</span></button>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              )}

              {!productsLoading && filteredSorted.length > 0 && (totalPages > 1 || filteredSorted.length > shown.length) && (
                <nav className="catalog-pagination" aria-label="Сторінки каталогу">
                  <span className="catalog-pagination-summary">Показано {shown.length} з {filteredSorted.length}</span>
                  <div className="catalog-page-buttons">
                    <button
                      type="button"
                      className="catalog-page-arrow"
                      disabled={paginationPage === 1}
                      onClick={() => goToCatalogPage(paginationPage - 1)}
                      aria-label="Попередня сторінка"
                    ><span>←</span><b>Назад</b></button>
                    {pagesToShow.map((pageNumber, index) => pageNumber === "…" ? (
                      <span className="catalog-page-ellipsis" key={`ellipsis-${index}`}>…</span>
                    ) : (
                      <button
                        type="button"
                        className={mode === "page" && currentPage === pageNumber ? "is-active" : ""}
                        aria-current={mode === "page" && currentPage === pageNumber ? "page" : undefined}
                        onClick={() => goToCatalogPage(pageNumber)}
                        key={pageNumber}
                      >{pageNumber}</button>
                    ))}
                    <button
                      type="button"
                      className="catalog-page-arrow"
                      disabled={paginationPage === totalPages}
                      onClick={() => goToCatalogPage(paginationPage + 1)}
                      aria-label="Наступна сторінка"
                    ><b>Далі</b><span>→</span></button>
                  </div>
                  {filteredSorted.length > shown.length && (
                    <button type="button" className="catalog-show-more" onClick={showMoreProducts}>Показати ще</button>
                  )}
                </nav>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Product Modal */}
      {productOpen && (
        <div className="product-overlay fixed inset-0 z-[60]" role="dialog" aria-modal="true" aria-label={`Картка товару ${productOpen.number}`}>
          <div className="modal-backdrop absolute inset-0" onClick={closeProduct} />
          <div className="product-dialog product-dialog-modern">
            <button type="button" className="product-dialog-close" onClick={closeProduct} aria-label="Закрити картку товару">×</button>

            <div className="product-dialog-grid">
              <div className="product-gallery-panel">
                <div className="product-dialog-badges">
                  <span>{productOpen.type}</span>
                  <span className={effectiveAvailability(productOpen) === "В наявності" ? "available" : "preorder"}>
                    {effectiveAvailability(productOpen) === "В наявності" ? `В наявності · ${productOpen.qty} шт` : "Під замовлення"}
                  </span>
                </div>

                <div className="product-main-image">
                  {hasImages(productOpen.images) ? (
                    <img src={productOpen.images[activeImg]} alt={`${productOpen.type} ${productOpen.number}`} />
                  ) : (
                    <img className="product-main-placeholder" src="/dh-logo2-brand.png" alt="Фото готується" />
                  )}
                </div>

                {hasImages(productOpen.images) && productOpen.images.length > 1 && (
                  <div className="product-thumbnails">
                    {productOpen.images.map((img, idx) => (
                      <button type="button" key={img} className={idx === activeImg ? "active" : ""} onClick={() => setActiveImg(idx)}>
                        <img src={img} alt={`Фото ${idx + 1}`} />
                      </button>
                    ))}
                  </div>
                )}

                <div className="product-quality-note">
                  <div className="product-quality-check"><i>✓</i><span><small>Перед відправкою</small><strong>Перевірено</strong></span></div>
                  <div className="product-quality-warranty"><span><small>Гарантія на деталь</small><strong>{getWarranty()}</strong></span></div>
                </div>
              </div>

              <div className="product-detail-panel">
                <div className="product-detail-eyebrow">{productOpen.manufacturer} · {productOpen.condition}</div>
                <h2><span>{productOpen.type}</span>{productOpen.number}</h2>

                <div className="product-dialog-tabs" role="tablist" aria-label="Інформація про товар">
                  <button type="button" className={productTab === "info" ? "active" : ""} onClick={() => setProductTab("info")}>Характеристики</button>
                  <button type="button" className={productTab === "parts" ? "active" : ""} onClick={() => setProductTab("parts")}>
                    Комплектуючі {compatProducts.length > 0 && <b>{compatProducts.length}</b>}
                  </button>
                </div>

                {productTab === "info" ? (
                  <div className="product-dialog-info">
                    <div className="product-spec-grid">
                      <div><span>OEM номер</span><strong>{productOpen.oem || "—"}</strong></div>
                      <div><span>Виробник</span><strong>{productOpen.manufacturer || "—"}</strong></div>
                      <div><span>Стан</span><strong>{productOpen.condition || "—"}</strong></div>
                      {Number(productOpen.engine) > 0 && <div><span>Обʼєм двигуна</span><strong>{formatEngine(productOpen.engine)}</strong></div>}
                    </div>

                    {(productOpen.type === "Форсунка" || productOpen.type === "ПНВТ") && (
                      <div className="product-dialog-crosses">
                        <span>Крос-номери</span>
                        <div>{(productOpen.cross || []).length > 0 ? productOpen.cross.map((cross) => <b key={cross}>{cross}</b>) : <b>—</b>}</div>
                      </div>
                    )}

                    <a className="product-warranty-link" href="/#/warranty" onClick={(event) => event.stopPropagation()}>Умови гарантії та повернення <span>→</span></a>
                  </div>
                ) : (
                  <div className="product-parts-list">
                    {compatProducts.length === 0 ? (
                      <div className="product-parts-empty">Для цього товару комплектуючі ще не додані.</div>
                    ) : compatProducts.map((cp) => (
                      <div className="product-part-row" key={cp.id}>
                        <div><strong>{cp.number || "—"}</strong><span>{cp.type}</span></div>
                        <b>{(cp.price || 0).toLocaleString("uk-UA")} ₴</b>
                        <button type="button" onClick={(event) => { event.stopPropagation(); addToCart(cp); }}>Додати</button>
                      </div>
                    ))}
                  </div>
                )}

                <div className="product-buy-box">
                  <div className="product-buy-summary">
                    <div>
                      <span>Ціна за одиницю</span>
                      <small>
                        {modalProductStock > 0 ? `В наявності: ${modalProductStock} шт.` : "Під замовлення · 1–3 дні"}
                        {modalProductInCart > 0 && ` · У кошику: ${modalProductInCart} шт.`}
                      </small>
                    </div>
                    <strong>{(productOpen.price || 0).toLocaleString("uk-UA")} ₴</strong>
                  </div>
                  <div className="product-buy-actions">
                    <label className="product-quantity-control">
                      <span>Кількість</span>
                      <div className="product-qty-stepper">
                        <button
                          type="button"
                          aria-label={`Зменшити кількість: ${productOpen.number}`}
                          onClick={() => setModalQtyStr(String(Math.max(1, modalSelectedQty - 1)))}
                          disabled={modalSelectedQty <= 1 || modalMaxAdd <= 0}
                        >−</button>
                        <input
                          aria-label={`Кількість для додавання: ${productOpen.number}`}
                          type="number"
                          min={1}
                          max={modalMaxAdd || 1}
                          value={String(Math.min(modalSelectedQty, Math.max(1, modalMaxAdd)))}
                          readOnly
                        />
                        <button
                          type="button"
                          aria-label={`Збільшити кількість: ${productOpen.number}`}
                          onClick={() => setModalQtyStr(String(Math.min(modalMaxAdd, modalSelectedQty + 1)))}
                          disabled={modalMaxAdd <= 0 || modalSelectedQty >= modalMaxAdd}
                        >+</button>
                      </div>
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        const addN = Math.min(modalSelectedQty, modalMaxAdd);
                        if (addN) addToCartN(productOpen, addN);
                      }}
                      disabled={modalMaxAdd <= 0}
                    >
                      <span>{modalMaxAdd > 0 ? "Додати до кошика" : "Уся кількість вже в кошику"}</span>
                      {modalMaxAdd > 0 && <strong>{((productOpen.price || 0) * Math.min(modalSelectedQty, modalMaxAdd)).toLocaleString("uk-UA")} ₴</strong>}
                    </button>
                  </div>
                  <a href="tel:+380665507055" className="product-consult-link">Потрібна допомога з підбором? <strong>066 550 70 55</strong></a>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Cart Drawer */}
      {cartOpen && (
        <div className="fixed inset-0 z-[70]">
          <div className="modal-backdrop absolute inset-0 bg-black/60" onClick={() => setCartOpen(false)} />
          <div className="cart-drawer absolute right-0 top-0 h-full w-full max-w-[580px] bg-neutral-950 border-l border-neutral-800 flex flex-col">
            {/* Header */}
            <div className="cart-drawer-header">
              <div>
                <h2>Кошик</h2>
                {primaryCartItems.length > 0 && <span>{primaryCartItems.length} {primaryCartItems.length === 1 ? "товар" : "товари"}</span>}
              </div>
              <button onClick={() => setCartOpen(false)}>
                Закрити
              </button>
            </div>

            {/* Scrollable items */}
            <div className="flex-1 overflow-y-auto p-4">
              {cartItems.length === 0 ? (
                <div className="text-neutral-400 text-left">Кошик порожній</div>
              ) : (
                <div className="space-y-4">
                  {primaryCartItems.map((item) => {
                    const linkedWasher = washersByParentId.get(String(item.id));
                    const isInjector = item.type === "Форсунка";
                    const suggestedQuantity = Math.max(1, Number(item.qty) || 0);
                    return (
                      <div key={item.id} className="cart-product-group">
                        <div className="cart-product-main">
                          <div className="cart-product-thumb">
                            {hasImages(item.images) ? (
                              <img src={item.images[0]} alt="" />
                            ) : (
                              <span>Без фото</span>
                            )}
                          </div>
                          <div className="cart-product-info">
                            <div className="cart-product-topline">
                              <div>
                                <span className="cart-product-type">{item.type || "Деталь"}</span>
                                <div className="cart-product-number">{item.number}</div>
                              </div>
                              <div className="cart-product-price">
                                <span>{Number(item.price || 0).toLocaleString("uk-UA")} ₴/шт.</span>
                                <strong>{((item.price || 0) * Math.max(0, item.qty)).toLocaleString("uk-UA")} ₴</strong>
                              </div>
                            </div>
                            <div className="cart-product-meta">
                              {(item.manufacturer || item.condition) && <span>{[item.manufacturer, item.condition].filter(Boolean).join(" · ")}</span>}
                              <span className={(getProductStockById(products, item.id) || 0) > 0 ? "is-stock" : "is-order"}>
                                {(getProductStockById(products, item.id) || 0) > 0 ? "В наявності" : "Під замовлення · 1–3 дні"}
                              </span>
                              <span className="is-warranty">Гарантія 6 місяців</span>
                            </div>
                            <div className="cart-product-controls">
                              <label className="cart-quantity-control">
                                <span>Кількість</span>
                                <div className="cart-qty-stepper">
                                  <button
                                    type="button"
                                    aria-label={`Зменшити кількість: ${item.number}`}
                                    onClick={() => updateQty(item.id, Math.max(1, Number(item.qty) - 1))}
                                    disabled={Number(item.qty) <= 1}
                                  >−</button>
                                  <input
                                    aria-label={`Кількість: ${item.number}`}
                                    type="number"
                                    min={1}
                                    max={getProductStockById(products, item.id) || undefined}
                                    value={String(item.qty)}
                                    readOnly
                                  />
                                  <button
                                    type="button"
                                    aria-label={`Збільшити кількість: ${item.number}`}
                                    onClick={() => updateQty(item.id, Number(item.qty) + 1)}
                                    disabled={(getProductStockById(products, item.id) || 0) > 0 && Number(item.qty) >= getProductStockById(products, item.id)}
                                  >+</button>
                                </div>
                              </label>
                              <button className="cart-remove-product" onClick={() => removeFromCart(item.id)}>Видалити товар</button>
                            </div>
                          </div>
                        </div>

                        {isInjector && (
                          <div className={classNames("cart-washer-row", linkedWasher && "is-added")}>
                            <div className="cart-washer-copy">
                              <small>До цієї форсунки</small>
                              <strong>Мідна шайба</strong>
                              <span>{item.number} · 100 ₴/шт.</span>
                            </div>
                            {linkedWasher ? (
                              <div className="cart-washer-controls">
                                <div className="cart-qty-stepper cart-qty-stepper-small">
                                  <button
                                    type="button"
                                    aria-label={`Зменшити кількість шайб до форсунки ${item.number}`}
                                    onClick={() => updateQty(linkedWasher.id, Math.max(1, Number(linkedWasher.qty) - 1))}
                                    disabled={Number(linkedWasher.qty) <= 1}
                                  >−</button>
                                  <input
                                    aria-label={`Кількість шайб до форсунки ${item.number}`}
                                    type="number"
                                    min={1}
                                    max={COPPER_WASHER_PRODUCT.qty}
                                    value={String(linkedWasher.qty)}
                                    readOnly
                                  />
                                  <button
                                    type="button"
                                    aria-label={`Збільшити кількість шайб до форсунки ${item.number}`}
                                    onClick={() => updateQty(linkedWasher.id, Number(linkedWasher.qty) + 1)}
                                  >+</button>
                                </div>
                                <strong>{(Math.max(0, Number(linkedWasher.qty) || 0) * 100).toLocaleString("uk-UA")} ₴</strong>
                                <button type="button" onClick={() => removeFromCart(linkedWasher.id)}>Прибрати</button>
                              </div>
                            ) : (
                              <button type="button" className="cart-washer-add" onClick={() => addCopperWasherForInjector(item)}>
                                Додати {suggestedQuantity} шт. <span>{(suggestedQuantity * 100).toLocaleString("uk-UA")} ₴</span>
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Sticky bottom panel */}
            <div className="cart-drawer-footer">
              <div className="cart-total-line">
                <div>Разом</div>
                <strong>{cartTotal.toLocaleString("uk-UA")} ₴</strong>
              </div>
              <div className="cart-footer-actions">
                <button
                  onClick={openCheckout}
                  disabled={cartItems.length === 0 || cartItems.some((i) => i.qty <= 0)}
                  className={classNames(
                    "flex-1 rounded-xl font-semibold py-3",
                    cartItems.length === 0 || cartItems.some((i) => i.qty <= 0)
                      ? "bg-neutral-800 text-neutral-500 cursor-not-allowed"
                      : "bg-[#34B7B7] text-neutral-950 hover:brightness-90"
                  )}
                >
                  Оформити замовлення
                </button>
                <button
                  onClick={() => setCartOpen(false)}
                  className="rounded-xl border border-neutral-700 px-4 py-3 font-semibold hover:border-[#34B7B7]"
                >
                  Продовжити покупки
                </button>
              </div>
            </div>
          </div>
        </div>
      )}


      {/* Checkout Modal */}
      
{/* Checkout Modal (safe) */}
{checkoutOpen && (
  <div className="checkout-overlay fixed inset-0 z-[80]">
    <div className="modal-backdrop absolute inset-0 bg-black/60" onClick={() => setCheckoutOpen(false)} />
    <div className="checkout-dialog max-w-4xl bg-neutral-950 border border-neutral-800 rounded-2xl overflow-hidden" role="dialog" aria-modal="true" aria-label="Оформлення замовлення">
      <div className="checkout-header flex items-center justify-between px-4 py-3 border-b border-neutral-800">
        <div className="text-lg font-semibold">Оформлення</div>
        <button type="button" onClick={() => setCheckoutOpen(false)} className="text-white hover:text-neutral-300" aria-label="Закрити оформлення замовлення">Закрити</button>
      </div>

      <div className="checkout-scroll p-3">
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
                className="rounded-xl border border-[#34B7B7]/60 bg-[#34B7B7] text-neutral-950 px-4 py-2 font-semibold hover:brightness-95"
              >
                Повернутися до каталогу
              </button>
              <button
                onClick={() => { setCheckoutOpen(false); }}
                className="rounded-xl border border-neutral-700 px-4 py-2 font-semibold hover:border-[#34B7B7]"
              >
                Закрити
              </button>
            </div>
          </div>
        )}
        <div className={classNames("checkout-layout grid md:grid-cols-2 gap-4", orderPlaced && "hidden")}>
          {/* Left: Form */}
          <div className="checkout-form space-y-3">
            <label className="block">
              <div className="text-sm mb-1">ПІБ</div>
              <input
                maxLength={50}
                value={order.name || ""}
                onChange={(e)=>{ const v=(e.target.value||"").replace(/[0-9]/g,""); setOrder(o=>({...o, name: v})); }}
                className="w-full rounded-lg bg-neutral-900 border border-neutral-800 px-3 py-2 text-sm outline-none focus:border-[#34B7B7]"
                placeholder="Введіть ПІБ"
              />
            </label>

            <label className="block">
              <div className="text-sm mb-1">Телефон</div>
              <div className="flex items-center gap-2">
                <span className="checkout-phone-prefix inline-flex items-center justify-center rounded-lg bg-neutral-900 border border-neutral-800 px-3 py-2 text-sm select-none">+380</span>
                <input
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={18}
                  value={formatPhoneMask(order.phone || "")}
                  onChange={(e)=>{ const d=(e.target.value||"").replace(/\D/g,"").slice(0,9); setOrder(o=>({...o, phone:d})); }}
                  onKeyDown={(e) => { if (e.key === "Backspace") { const input = e.target; const before = (input.value || "").slice(0, input.selectionStart || 0); const digitsBefore = (before.match(/\d/g) || []).length; const prev = (order.phone || ""); if (digitsBefore > 0) { const next = prev.slice(0, digitsBefore - 1) + prev.slice(digitsBefore); setOrder(o => ({ ...o, phone: next })); e.preventDefault(); } } }}
                        className="checkout-phone-input min-w-0 flex-1 rounded-lg bg-neutral-900 border border-neutral-800 px-3 py-2 text-sm outline-none focus:border-[#34B7B7]"
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
                  className={classNames("px-3 py-1.5 rounded-lg border text-sm", order.delivery==="Нова пошта" ? "border-[#34B7B7] text-[#34B7B7]" : "border-neutral-700")}
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
                  className={classNames("px-3 py-1.5 rounded-lg border text-sm", order.delivery==="Самовивіз" ? "border-[#34B7B7] text-[#34B7B7]" : "border-neutral-700")}
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
                    className="w-full rounded-lg bg-neutral-900 border border-neutral-800 px-3 py-2 text-sm outline-none focus:border-[#34B7B7]"
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
                  <button type="button" onClick={()=>setNpType("branch")} className={classNames("px-3 py-1.5 rounded-lg border text-sm", npType==="branch"?"border-[#34B7B7] text-[#34B7B7]":"border-neutral-700")}>Відділення</button>
                  <button type="button" onClick={()=>setNpType("postomat")} className={classNames("px-3 py-1.5 rounded-lg border text-sm", npType==="postomat"?"border-[#34B7B7] text-[#34B7B7]":"border-neutral-700")}>Поштомат</button>
                </div>

                {/* Warehouse */}
                <div className="relative">
                  <div className="text-sm mb-1">Відділення / Поштомат</div>
                  <input
                    value={npWhInput}
                    onChange={(e)=>{ setNpWhInput(e.target.value); setNpWhOpen(true); }}
                    onFocus={()=>{ if (npWhList.length) setNpWhOpen(true); }}
                    className="w-full rounded-lg bg-neutral-900 border border-neutral-800 px-3 py-2 text-sm outline-none focus:border-[#34B7B7]"
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
                    className="w-full rounded-lg bg-neutral-900 border border-neutral-800 px-3 py-2 text-sm outline-none focus:border-[#34B7B7]"
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
                  className="w-full rounded-lg bg-neutral-900 border border-neutral-800 px-3 py-2 text-sm outline-none focus:border-[#34B7B7]"
                >
                  <option value="Передплата по реквізитам">Передплата по реквізитам</option>
                  <option value="Готівковий розрахунок">Готівковий розрахунок</option>
                </select>
              </label>
            )}

            
            {/* Checkboxes */}
            <label className="checkout-consent flex items-start gap-2 mt-2">
              <input
                type="checkbox"
                checked={!!order.agree}
                onChange={(e) => setOrder(o => ({ ...o, agree: e.target.checked }))}
              />
              <span className="text-sm text-white">
                Підтверджую, що ознайомився з{" "}
                <a className="text-[#34B7B7] no-underline hover:no-underline" href="#/warranty">Гарантією</a>
                {" "}та умовами повернення
              </span>
            </label>

            <label className="checkout-consent flex items-start gap-2">
              <input
                type="checkbox"
                checked={!!order.agreeLegal}
                onChange={(e) => setOrder(o => ({ ...o, agreeLegal: e.target.checked }))}
              />
              <span className="text-sm text-white">
                Погоджуюся з умовами{" "}
                <a className="text-[#34B7B7] no-underline hover:no-underline" href="#/offer">Публічної оферти</a>
                {" "}та надаю згоду на обробку моїх персональних даних відповідно до{" "}
                <a className="text-[#34B7B7] no-underline hover:no-underline" href="#/privacy">Політики конфіденційності</a>.
              </span>
            </label>

          </div>

          {/* Right: Summary + Submit full width */}
          <div className="checkout-summary rounded-xl border border-neutral-800 p-3 flex flex-col">
            <div className="text-white text-lg mb-2">Ваше замовлення</div>
            <div className="checkout-order-items space-y-3 max-h-80 overflow-auto pr-2">
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
    const stockNum = (function(){ const s = getProductStockById(products, it.id); return (typeof s==="number" ? s : (typeof it.stock==="number" ? it.stock : (typeof it.available==="number" ? it.available : null))); })();
    const avail = (stockNum !== null ? (stockNum > 0 ? "В наявності" : "Під замовлення") : effectiveAvailability(it));
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
              <div className="font-semibold text-[#34B7B7]">{cartTotal.toLocaleString("uk-UA")} ₴</div>
            </div>
            {/* Submit full width under total */}
            <div className="checkout-submit pt-3">
              {(() => {
                const nameValid = /^[A-Za-zА-Яа-яЁёІіЇїЄєҐґ'’ -]{1,50}$/.test(order.name || "");
                const phoneValid = /^[0-9]{9}$/.test(order.phone || "");
                const paymentValue = order.payment || (order.delivery === "Нова пошта" ? "Передплата по реквізитам" : "Готівковий розрахунок");
                const agreeValid = !!order.agree && !!order.agreeLegal;
                const cityOk = order.delivery === "Нова пошта" ? !!(npCityInput && npWhInput) : true;
                const okToSubmit = nameValid && phoneValid && agreeValid && !!paymentValue && cityOk && cartItems.length>0 && !cartItems.some(i=>i.qty<=0);
                return (
                  <button
                    onClick={placeOrder}
                    disabled={!okToSubmit}
                    className={classNames(
                      "w-full rounded-xl font-semibold py-3",
                      !okToSubmit ? "bg-neutral-800 text-neutral-500 cursor-not-allowed" : "bg-[#34B7B7] text-neutral-950 hover:brightness-90"
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
                      className="rv-card shrink-0 w-[160px] md:w-[180px] bg-neutral-950/60 border border-neutral-800 rounded-2xl hover:border-[#34B7B7]/60 transition-colors transform hover:-translate-y-0.5 active:translate-y-0 text-left"
                    >
                      <div className="rv-thumb w-full aspect-[4/3] overflow-hidden rounded-t-2xl bg-neutral-900">
                        {Array.isArray(p.images) && p.images.length > 0 ? (
                          <img src={p.images[0]} alt={p.number ? `${p.number} — ${p.manufacturer || ''}` : ''} className="w-full h-full object-contain p-2" loading="lazy" />
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
                          <span className="rv-price text-[13px] font-semibold text-[#34B7B7]">
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
      <footer className="brand-footer mt-16 border-t border-neutral-800">
<div className="mx-auto max-w-7xl px-4 py-8 text-sm text-neutral-400 flex flex-col items-start gap-4 md:flex-row md:items-center md:justify-between">
  <div>© {new Date().getFullYear()} Diesel Hub</div>
  <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
    <a className="hover:text-white" href="#/offer">Оферта</a>
    <a className="hover:text-white" href="#/warranty">Повернення та гарантія</a>
    <a className="hover:text-white" href="#/privacy">Конфіденційність</a>
    <a className="hover:text-white" href="#/payment">Оплата і доставка</a>
  </div>
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
