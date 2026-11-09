interface PaginationProps {
  page: number;
  pageSize: number;
  total: number;
  onChange(page: number): void;
}

export function Pagination({ page, pageSize, total, onChange }: PaginationProps) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const first = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const last = Math.min(total, page * pageSize);
  return (
    <nav className="pagination" aria-label="Paginação">
      <span>
        {first}–{last} de {total}
      </span>
      <button type="button" onClick={() => onChange(page - 1)} disabled={page <= 1}>
        Anterior
      </button>
      <span aria-current="page">
        Página {page} de {pages}
      </span>
      <button type="button" onClick={() => onChange(page + 1)} disabled={page >= pages}>
        Próxima
      </button>
    </nav>
  );
}
