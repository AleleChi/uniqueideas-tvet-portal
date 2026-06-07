/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";

interface SkeletonLoaderProps {
  label: string;
}

export function SkeletonLoader({ label }: SkeletonLoaderProps) {
  return (
    <div id="ideas-skeleton-container" className="space-y-6 animate-pulse p-4 sm:p-6 bg-white rounded-xl border border-slate-200 shadow-sm max-w-7xl mx-auto">
      {/* Skeleton Header */}
      <div className="flex items-center justify-between border-b border-slate-100 pb-5">
        <div className="space-y-2">
          <div className="h-6 w-48 bg-slate-200 rounded-md"></div>
          <p className="text-xs font-mono text-slate-400 uppercase tracking-widest flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-indigo-400 animate-ping"></span>
            {label}
          </p>
        </div>
        <div className="h-9 w-28 bg-slate-200 rounded-lg"></div>
      </div>

      {/* Grid of Skeleton Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-1 bg-slate-50/50 p-5 rounded-xl border border-slate-100 space-y-4">
          <div className="h-4 w-32 bg-slate-200 rounded"></div>
          <div className="h-10 w-full bg-slate-200 rounded-lg"></div>
          <div className="space-y-2 pt-2">
            <div className="h-3 w-full bg-slate-200 rounded"></div>
            <div className="h-3 w-5/6 bg-slate-205 bg-slate-200 rounded"></div>
            <div className="h-3 w-2/3 bg-slate-200 rounded"></div>
          </div>
        </div>

        <div className="md:col-span-2 bg-slate-50/20 p-5 rounded-xl border border-slate-100/80 space-y-5">
          <div className="flex items-center justify-between">
            <div className="h-4.5 w-40 bg-slate-200 rounded"></div>
            <div className="h-3 w-20 bg-slate-150 bg-slate-200 rounded"></div>
          </div>
          <div className="space-y-3.5">
            {[1, 2, 3].map((idx) => (
              <div key={idx} className="flex items-center justify-between py-3 border-b border-slate-100/50">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-full bg-slate-200"></div>
                  <div className="space-y-1.5">
                    <div className="h-3 w-36 bg-slate-200 rounded"></div>
                    <div className="h-2.5 w-24 bg-slate-200 rounded"></div>
                  </div>
                </div>
                <div className="h-6 w-16 bg-slate-200 rounded"></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
