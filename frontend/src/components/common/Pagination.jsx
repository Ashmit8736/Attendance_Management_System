import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

/**
 * Page controls for server-paginated lists.
 * `pagination` is the { page, totalPages, total } object returned by the API.
 */
export const Pagination = ({ pagination, onPageChange, noun = 'records' }) => {
  const { page = 1, totalPages = 1, total = 0 } = pagination || {};
  if (totalPages <= 1) return null;

  return (
    <nav className="pagination-bar" aria-label="Pagination">
      <span aria-live="polite">
        Page <strong>{page}</strong> of <strong>{totalPages}</strong> ({total} {noun})
      </span>
      <div className="row-gap-sm">
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          className="btn-secondary btn-pager"
          aria-label="Previous page"
        >
          <ChevronLeft size={14} aria-hidden="true" />
          <span>Previous</span>
        </button>
        <button
          type="button"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
          className="btn-secondary btn-pager"
          aria-label="Next page"
        >
          <span>Next</span>
          <ChevronRight size={14} aria-hidden="true" />
        </button>
      </div>
    </nav>
  );
};
