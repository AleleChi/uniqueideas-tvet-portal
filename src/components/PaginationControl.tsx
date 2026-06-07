/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

export interface PaginationControlProps {
  currentPage: number;
  totalCount: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
  pageSizeOptions?: number[];
  idPrefix?: string;
}

export function PaginationControl({
  currentPage,
  totalCount,
  pageSize,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 25, 50, 100, 250],
  idPrefix = "pagination",
}: PaginationControlProps) {
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  
  // Keep local state for the keyboard "Jump to Page" input
  const [jumpInput, setJumpInput] = useState(String(currentPage));

  useEffect(() => {
    setJumpInput(String(currentPage));
  }, [currentPage]);

  const handleJumpGo = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const pageNum = parseInt(jumpInput, 10);
    if (!isNaN(pageNum) && pageNum >= 1 && pageNum <= totalPages) {
      onPageChange(pageNum);
    } else {
      setJumpInput(String(currentPage));
    }
  };

  const handleKeyDownJump = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      handleJumpGo();
    }
  };

  // Pagination helper algorithms
  const getPagesRange = () => {
    const siblingCount = 1;
    const totalPageNumbers = siblingCount * 2 + 5; // siblingCount + firstPage + lastPage + currentPage + 2 * DOTS

    if (totalPageNumbers >= totalPages) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }

    const leftSiblingIndex = Math.max(currentPage - siblingCount, 1);
    const rightSiblingIndex = Math.min(currentPage + siblingCount, totalPages);

    const shouldShowLeftDots = leftSiblingIndex > 2;
    const shouldShowRightDots = rightSiblingIndex < totalPages - 1;

    const firstPageIndex = 1;
    const lastPageIndex = totalPages;

    if (!shouldShowLeftDots && shouldShowRightDots) {
      const leftItemCount = 3 + 2 * siblingCount;
      const leftRange = Array.from({ length: leftItemCount }, (_, i) => i + 1);
      return [...leftRange, "DOTS", lastPageIndex];
    }

    if (shouldShowLeftDots && !shouldShowRightDots) {
      const rightItemCount = 3 + 2 * siblingCount;
      const rightRange = Array.from({ length: rightItemCount }, (_, i) => totalPages - rightItemCount + 1 + i);
      return [firstPageIndex, "DOTS", ...rightRange];
    }

    if (shouldShowLeftDots && shouldShowRightDots) {
      const middleRange = Array.from(
        { length: rightSiblingIndex - leftSiblingIndex + 1 },
        (_, i) => leftSiblingIndex + i
      );
      return [firstPageIndex, "DOTS", ...middleRange, "DOTS", lastPageIndex];
    }

    return Array.from({ length: totalPages }, (_, i) => i + 1);
  };

  const pageRange = getPagesRange();

  // Dynamic record counters
  const startRecord = totalCount === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const endRecord = Math.min(currentPage * pageSize, totalCount);

  return (
    <div 
      className="flex flex-col md:flex-row items-center justify-between gap-4 py-4 px-4 bg-white border border-slate-200 rounded-[10px] shadow-xs text-xs font-sans text-slate-700 select-none w-full"
      aria-label="Pagination Navigation"
    >
      {/* 1. Dynamic Record Counter & Page Size Picker */}
      <div className="flex flex-wrap items-center justify-center md:justify-start gap-4 w-full md:w-auto">
        <span className="font-medium text-slate-600">
          Showing <span className="font-semibold text-slate-900">{startRecord}-{endRecord}</span> of <span className="font-semibold text-slate-900">{totalCount.toLocaleString()}</span> records
        </span>

        {onPageSizeChange && (
          <div className="flex items-center gap-2">
            <label htmlFor={`${idPrefix}-page-size`} className="font-medium text-slate-500 text-[11px] uppercase tracking-wider">
              Rows:
            </label>
            <select
              id={`${idPrefix}-page-size`}
              value={pageSize}
              onChange={(e) => {
                onPageSizeChange(Number(e.target.value));
                onPageChange(1); // Reset to page 1 on page size update
              }}
              className="px-2 py-1 bg-white border border-slate-200 hover:border-slate-300 rounded-[8px] focus:outline-none focus:ring-1 focus:ring-indigo-500 font-semibold text-slate-700 transition h-8"
              aria-label="Rows per page"
            >
              {pageSizeOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* 2. Main Page Controller Buttons (Responsive layout) */}
      <div className="flex items-center justify-center gap-1.5" role="navigation">
        {/* Prev Page Button */}
        <button
          type="button"
          onClick={() => currentPage > 1 && onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className="h-9 px-3 border border-slate-200 hover:bg-slate-50 disabled:hover:bg-transparent rounded-[10px] text-slate-700 disabled:text-slate-300 disabled:border-slate-100 font-semibold transition flex items-center gap-1 cursor-pointer disabled:cursor-not-allowed text-xs focus:ring-2 focus:ring-indigo-150 focus:outline-none"
          aria-label="Go to previous page"
        >
          <ChevronLeft className="w-4 h-4" />
          <span>Prev</span>
        </button>

        {/* Desktop numeric list (Hidden on small mobile) */}
        <div className="hidden sm:flex items-center gap-1">
          {pageRange.map((p, idx) => {
            if (p === "DOTS") {
              return (
                <span
                  key={`dots-${idx}`}
                  className="w-9 h-9 flex items-center justify-center text-slate-400 font-medium font-mono text-center tracking-tighter"
                >
                  ...
                </span>
              );
            }

            const pageNum = Number(p);
            const isActive = pageNum === currentPage;

            return (
              <button
                key={`page-${pageNum}`}
                type="button"
                onClick={() => onPageChange(pageNum)}
                className={`w-9 h-9 rounded-[10px] flex items-center justify-center font-bold tracking-tight transition text-xs focus:ring-2 focus:ring-indigo-150 focus:outline-none cursor-pointer ${
                  isActive
                    ? "bg-indigo-600 text-white shadow-xs pointer-events-none"
                    : "border border-transparent text-slate-700 hover:bg-slate-100"
                }`}
                aria-current={isActive ? "page" : undefined}
                aria-label={`Go to page ${pageNum}`}
              >
                {pageNum}
              </button>
            );
          })}
        </div>

        {/* Mobile Page Display */}
        <span className="flex sm:hidden font-semibold mx-2 text-slate-700 text-[13px]">
          Page {currentPage} of {totalPages}
        </span>

        {/* Next Page Button */}
        <button
          type="button"
          onClick={() => currentPage < totalPages && onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className="h-9 px-3 border border-slate-200 hover:bg-slate-50 disabled:hover:bg-transparent rounded-[10px] text-slate-700 disabled:text-slate-300 disabled:border-slate-100 font-semibold transition flex items-center gap-1 cursor-pointer disabled:cursor-not-allowed text-xs focus:ring-2 focus:ring-indigo-150 focus:outline-none"
          aria-label="Go to next page"
        >
          <span>Next</span>
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* 3. High-Recall Compact Page Jumper (Jump to specific page) */}
      <form 
        onSubmit={handleJumpGo}
        className="flex items-center justify-center gap-2 w-full md:w-auto"
      >
        <span className="text-slate-500 font-medium">Page</span>
        <input
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          value={jumpInput}
          onChange={(e) => setJumpInput(e.target.value.replace(/\D/g, ""))}
          onKeyDown={handleKeyDownJump}
          className="w-10 h-8 text-center bg-slate-50 border border-slate-200 rounded-[8px] focus:outline-none focus:ring-1 focus:ring-indigo-500 text-xs font-bold font-mono text-slate-800"
          aria-label="Jump to page number"
        />
        <span className="text-slate-500 font-medium">of {totalPages}</span>
        <button
          type="button"
          onClick={() => handleJumpGo()}
          className="h-8 px-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-[8px] transition cursor-pointer text-[11px] uppercase tracking-wider focus:outline-none focus:ring-2 focus:ring-indigo-150 flex items-center justify-center"
        >
          Go
        </button>
      </form>
    </div>
  );
}
