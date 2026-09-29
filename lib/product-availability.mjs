export const IN_STOCK = "В наявності";
export const PREORDER = "Під замовлення";

export function productAvailabilityForQty(value) {
  const qty = Number(value);
  return Number.isFinite(qty) && qty > 0 ? IN_STOCK : PREORDER;
}

export function withDerivedProductAvailability(product) {
  if (!product || typeof product !== "object") return product;
  return {
    ...product,
    availability: productAvailabilityForQty(product.qty),
  };
}
