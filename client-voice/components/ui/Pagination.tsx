// INSERT_YOUR_CODE
import React from "react";

type PaginationProps = {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  className?: string;
};

export const Pagination: React.FC<PaginationProps> = ({
  currentPage,
  totalPages,
  onPageChange,
  className = "",
}) => {
  if (totalPages <= 1) return null;

  // Helper to get the page numbers to display (simple logic for ellipsis)
  const getPageNumbers = () => {
    let pages: (number | "...")[] = [];
    // Always show current, one before+after, first and last  
    if (totalPages <= 5) {
      pages = Array.from({ length: totalPages }, (_, i) => i + 1);
    } else {
      if (currentPage <= 3) {
        pages = [1, 2, 3, 4, "...", totalPages];
      } else if (currentPage >= totalPages - 2) {
        pages = [1, "...", totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
      } else {
        pages = [
          1,
          "...",
          currentPage - 1,
          currentPage,
          currentPage + 1,
          "...",
          totalPages,
        ];
      }
    }
    return pages;
  };

  const handlePageClick = (page: number | "...") => {
    if (typeof page === "number" && page !== currentPage) {
      onPageChange(page);
    }
  };

  return (
    <nav className={`flex justify-center gap-4 mt-6 ${className}`}>
      <button
        className={`rounded-xl p-3 text-sm ${
          currentPage === 1
            ? "bg-white/5 text-slate-500 cursor-not-allowed"
            : "bg-white/10 hover:bg-violet-500/30 text-violet-400"
        }`}
        onClick={() => handlePageClick(currentPage - 1)}
        disabled={currentPage === 1}
      >
        Prev
      </button>
      {getPageNumbers().map((page, idx) =>
        page === "..." ? (
          <span
            key={`ellipsis-${idx}`}
            className="px-2 py-1 text-sm text-slate-500"
          >
            ...
          </span>
        ) : (
          <button
            key={page}
            className={`rounded-xl p-3 text-sm ${
              currentPage === page
                ? "bg-violet-500/90 text-white font-semibold"
                : "bg-white/10 text-violet-400 hover:bg-violet-500/30"
            }`}
            onClick={() => handlePageClick(page)}
            aria-current={currentPage === page ? "page" : undefined}
          >
            {page}
          </button>
        )
      )}
      <button
        className={`rounded-xl p-3 text-sm ${
          currentPage === totalPages
            ? "bg-white/5 text-slate-500 cursor-not-allowed"
            : "bg-white/10 hover:bg-violet-500/30 text-violet-400"
        }`}
        onClick={() => handlePageClick(currentPage + 1)}
        disabled={currentPage === totalPages}
      >
        Next
      </button>
    </nav>
  );
};

export default Pagination;
