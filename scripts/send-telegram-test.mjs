import { buildTelegramOrderMessage } from "../lib/telegram-order.mjs";

const token = process.env.TELEGRAM_BOT_TOKEN;
const chatId = process.env.TELEGRAM_CHAT_ID;

if (!token || !chatId) {
  console.error("Telegram test is not configured: TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID is missing.");
  process.exit(1);
}

const orderMessage = buildTelegramOrderMessage({
  orderNumber: 10,
  name: "Тестовий клієнт",
  phone: "+380000000000",
  delivery: "Нова пошта: тестове місто, Відділення №0 — тестова адреса",
  payment: "Накладений платіж",
  items: [{
    number: "TEST-166006212R",
    availability: "В наявності",
    condition: "Відновлене",
    type: "Форсунка",
    qty: 1,
    price: 8000,
  }],
  total: 8000,
});

const text = `<i>🧪 Тестове повідомлення · не замовлення</i>\n\n${orderMessage}`;
const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    chat_id: chatId,
    text,
    parse_mode: "HTML",
  }),
});

if (!response.ok) {
  const error = await response.text().catch(() => "");
  console.error(`Telegram test failed (${response.status}): ${error.slice(0, 500)}`);
  process.exit(1);
}

const result = await response.json();
console.log(`Telegram test sent successfully (message ${result?.result?.message_id ?? "unknown"}).`);
