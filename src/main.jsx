// src/main.jsx
import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import Warranty from "./Warranty.jsx";
import AdminPanel from "./admin.jsx"; // адмінка
import TradeIn from "./TradeIn.jsx";
import "./index.css";

const root = createRoot(document.getElementById("root"));

function normalizeHash(h) {
  if (!h) return "#/";
  if (h === "#admin") return "#/admin";
  if (h === "#warranty") return "#/warranty";
  if (h === "#trade-in") return "#/trade-in";
  return h.startsWith("#/") ? h : "#/";
}

function renderByHash() {
  const h = normalizeHash(window.location.hash);
  switch (h) {
    case "#/admin":
      root.render(<AdminPanel />);
      break;
    case "#/warranty":
      root.render(<Warranty />);
      break;
    case "#/trade-in":
      root.render(<TradeIn />);
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