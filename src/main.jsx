// src/main.jsx
import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import Warranty from "./Warranty.jsx";
import AdminPanel from "./admin.jsx"; // адмінка
import "./index.css";

const root = createRoot(document.getElementById("root"));

/**
 * Нормалізуємо hash так, щоб працювали обидва варіанти:
 *  - #admin  і  #/admin
 *  - #warranty  і  #/warranty
 * Все інше йде на головну: #/
 */
function normalizeHash(h) {
  const raw = (h || "#/").toLowerCase();

  // admin
  if (raw === "#admin" || raw.startsWith("#admin/")) return "#/admin";
  if (raw === "#/admin" || raw.startsWith("#/admin")) return "#/admin";

  // warranty
  if (raw === "#warranty" || raw.startsWith("#warranty/")) return "#/warranty";
  if (raw === "#/warranty" || raw.startsWith("#/warranty")) return "#/warranty";

  return "#/";
}

function renderByHash() {
  const route = normalizeHash(window.location.hash);

  switch (route) {
    case "#/admin":
      root.render(<AdminPanel />);
      break;

    case "#/warranty":
      root.render(<Warranty />);
      break;

    case "#/":
    default:
      root.render(<App />);
      break;
  }
}

// Перший рендер і підписка на зміни hash
window.addEventListener("hashchange", renderByHash);
renderByHash();
