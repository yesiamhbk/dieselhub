// src/main.jsx
import React from "react";
import { createRoot } from "react-dom/client";
import "./index.css"; // важно: стили (Tailwind/глобальные)

import App from "./App.jsx";
import Warranty from "./Warranty.jsx";
import TradeIn from "./TradeIn.jsx";
import PartnersSTO from "./PartnersSTO.jsx";
import Admin from "./admin.jsx";          // 👈 адмінка

// юр. страницы
import Offer from "./Offer.jsx";
import Privacy from "./Privacy.jsx";
import PaymentDelivery from "./PaymentDelivery.jsx";

const root = createRoot(document.getElementById("root"));

function renderByHash() {
  const hash = window.location.hash || "#/";

  switch (hash) {
    case "#/":
    case "#":
      root.render(<App />);
      break;

    case "#/admin":                       // 👈 роут адмінки
      root.render(<Admin />);
      break;

    case "#/warranty":
      root.render(<Warranty />);
      break;

    case "#/trade-in":
      root.render(<TradeIn />);
      break;

    case "#/partners-sto":
      root.render(<PartnersSTO />);
      break;

    case "#/offer":
      root.render(<Offer />);
      break;

    case "#/privacy":
      root.render(<Privacy />);
      break;

    case "#/payment":
      root.render(<PaymentDelivery />);
      break;

    default:
      root.render(<App />);
      break;
  }
}

window.addEventListener("hashchange", renderByHash);

// первый рендер
if (!window.location.hash) {
  window.location.hash = "#/";
}
renderByHash();
