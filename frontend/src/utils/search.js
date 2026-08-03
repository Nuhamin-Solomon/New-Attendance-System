export function matchesSearch(row, query, fields) {
  const q = String(query || "").trim().toLowerCase();
  if (!q) return true;
  return fields.some((f) => String(row?.[f] ?? "").toLowerCase().includes(q));
}
