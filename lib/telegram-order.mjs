export function escapeTelegramHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

export function formatTelegramMoney(value) {
  const amount = Number(value || 0);
  return Math.round(Number.isFinite(amount) ? amount : 0).toLocaleString("uk-UA");
}

export function telegramPaymentLabel(payment, delivery) {
  const value = String(payment || "Не вказано").trim();
  if (value === "Накладений платіж" && /^Нова пошта/i.test(String(delivery || ""))) {
    return "Накладений платіж · Нова пошта";
  }
  return value;
}

export function buildTelegramOrderMessage({ orderNumber, name, phone, delivery, payment, items, total }) {
  const title = orderNumber ? `Замовлення №${orderNumber}` : "Нове замовлення";
  const visibleItems = items.slice(0, 25);
  const itemLines = visibleItems.map((item) => {
    const number = item.number || item.oem || item.id || "Без номера";
    return `• ${escapeTelegramHtml(number)} | ${escapeTelegramHtml(item.availability || "—")} | ${escapeTelegramHtml(item.condition || "—")} | ${escapeTelegramHtml(item.type || "—")} | ${item.qty} шт × ${formatTelegramMoney(item.price)} ₴`;
  });
  if (items.length > visibleItems.length) itemLines.push(`… і ще ${items.length - visibleItems.length} позицій`);

  return [
    `<b>${escapeTelegramHtml(title)}</b>`,
    "",
    `👤 ${escapeTelegramHtml(name || "Не вказано")}`,
    `📞 ${escapeTelegramHtml(phone || "Не вказано")}`,
    `🚚 ${escapeTelegramHtml(delivery || "Не вказано")}`,
    `💳 ${escapeTelegramHtml(telegramPaymentLabel(payment, delivery))}`,
    "",
    ...itemLines,
    "",
    `Σ Разом: <b>${formatTelegramMoney(total)} ₴</b>`,
  ].join("\n");
}
