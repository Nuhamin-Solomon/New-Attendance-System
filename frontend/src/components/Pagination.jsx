import Icon from "./Icon";

export function getPageItems(current, total) {
  if (!total || total <= 1) return [];
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const set = new Set([1, 2, current - 1, current, current + 1, total - 1, total]);
  const pages = [...set].filter((p) => p >= 1 && p <= total).sort((a, b) => a - b);
  const items = [];
  let prev = 0;
  for (const p of pages) {
    if (prev && p - prev > 1) items.push("…");
    items.push(p);
    prev = p;
  }
  return items;
}

export default function Pagination({
  page,
  totalPages,
  total,
  pageSize,
  onPageChange,
  itemLabel = "records",
  showInfo = true,
}) {
  const safePage = Math.max(1, Math.min(page, totalPages || 1));
  const start = total === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const end = Math.min(safePage * pageSize, total);

  return (
    <div className="table-footer pagination-footer">
      {showInfo && (
        <div className="pagination-info">
          {total === 0
            ? `No ${itemLabel.toLowerCase()} found`
            : `Showing ${start}\u2013${end} of ${total} ${itemLabel.toLowerCase()}`}
        </div>
      )}
      {(totalPages || 1) > 1 && (
        <nav className="pagination" aria-label="Pagination">
          <button
            className="pagination-btn"
            onClick={() => onPageChange(safePage - 1)}
            disabled={safePage <= 1}
            title="Previous page"
          >
            <Icon name="arrow-left" size={14} /> Previous
          </button>
          <div className="pagination-pages">
            {getPageItems(safePage, totalPages || 1).map((p, i) =>
              p === "…" ? (
                <span key={`ellipsis-${i}`} className="pagination-ellipsis">…</span>
              ) : (
                <button
                  key={p}
                  className={`pagination-num${p === safePage ? " active" : ""}`}
                  onClick={() => onPageChange(p)}
                  aria-current={p === safePage ? "page" : undefined}
                >
                  {p}
                </button>
              )
            )}
          </div>
          <button
            className="pagination-btn"
            onClick={() => onPageChange(safePage + 1)}
            disabled={safePage >= (totalPages || 1)}
            title="Next page"
          >
            Next <Icon name="arrow-right" size={14} />
          </button>
        </nav>
      )}
    </div>
  );
}