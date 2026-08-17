import test from "node:test";
import assert from "node:assert/strict";
import { buildTelegramOrderMessage } from "../lib/telegram-order.mjs";

test("formats a numbered Telegram order without technical metadata", () => {
  const message = buildTelegramOrderMessage({
    orderNumber: 10,
    name: "Рибак Сергій Сергійович",
    phone: "+380684657039",
    delivery: "Нова пошта: смт Шевченкове, Відділення №3",
    payment: "Накладений платіж",
    items: [{
      number: "166006212R",
      availability: "В наявності",
      condition: "Відновлене",
      type: "Форсунка",
      qty: 1,
      price: 8000,
    }],
    total: 8000,
  });

  assert.match(message, /<b>Замовлення №10<\/b>/);
  assert.match(message, /💳 Накладений платіж · Нова пошта/);
  assert.match(message, /• 166006212R \| В наявності \| Відновлене \| Форсунка \| 1 шт × 8.000 ₴/);
  assert.match(message, /Σ Разом: <b>8.000 ₴<\/b>/);
  assert.doesNotMatch(message, /device|ip|utm/i);
});

test("escapes customer data for Telegram HTML", () => {
  const message = buildTelegramOrderMessage({
    orderNumber: 11,
    name: "A&B <Test>",
    phone: "+380000000000",
    delivery: "Самовивіз",
    payment: "Готівковий розрахунок",
    items: [{ number: "A<B", qty: 1, price: 0 }],
    total: 0,
  });

  assert.match(message, /A&amp;B &lt;Test&gt;/);
  assert.match(message, /A&lt;B/);
});
