export function getPaginationItems(totalPages, currentPage) {
  const total = Math.max(1, Math.trunc(Number(totalPages) || 1));
  const current = Math.min(total, Math.max(1, Math.trunc(Number(currentPage) || 1)));

  if (total <= 9) {
    return Array.from({ length: total }, (_, index) => index + 1);
  }

  const visiblePages = new Set([1, 2, total - 1, total]);

  if (current <= 4) {
    for (let page = 1; page <= Math.min(6, total); page += 1) {
      visiblePages.add(page);
    }
  } else if (current >= total - 3) {
    for (let page = Math.max(1, total - 5); page <= total; page += 1) {
      visiblePages.add(page);
    }
  } else {
    for (let page = current - 1; page <= current + 1; page += 1) {
      visiblePages.add(page);
    }
  }

  const sortedPages = [...visiblePages].sort((a, b) => a - b);
  const items = [];

  sortedPages.forEach((page, index) => {
    const previousPage = sortedPages[index - 1];
    if (index > 0 && page - previousPage > 1) items.push("…");
    items.push(page);
  });

  return items;
}
