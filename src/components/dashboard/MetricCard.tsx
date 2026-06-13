/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { LucideIcon } from "lucide-react";

interface MetricCardProps {
  id?: string;
  title: string;
  value: string | number;
  trend?: string;
  trendDirection?: "up" | "down" | "neutral";
  icon: LucideIcon;
  iconBgColor?: string;
  iconTextColor?: string;
  isLoading?: boolean;
}

export function MetricCard({
  id,
  title,
  value,
  trend = "Stable (+0%)",
  trendDirection = "neutral",
  icon: IconComponent,
  iconBgColor = "bg-indigo-50",
  iconTextColor = "text-indigo-600",
  isLoading = false
}: MetricCardProps) {
  return (
    <div 
      id={id || `metric-card-${title.toLowerCase().replace(/[^a-z0-9]/g, "-")}`}
      className="bg-white border border-slate-205/85 rounded-xl p-5 shadow-xs flex items-center justify-between hover:shadow-sm hover:border-slate-300 transition-all duration-200"
    >
      <div className="space-y-2">
        <span className="text-xs font-semibold text-slate-450 uppercase tracking-widest block">
          {title}
        </span>
        
        {isLoading ? (
          <div className="h-8 w-24 bg-slate-100 rounded animate-pulse" />
        ) : (
          <h3 className="text-2xl sm:text-3xl font-display font-extrabold text-slate-900 tracking-tight leading-none">
            {value}
          </h3>
        )}

        <div className="flex items-center gap-1.5 mt-1">
          <span className={`inline-block h-2 w-2 rounded-full ${
            trendDirection === "up" 
              ? "bg-emerald-500" 
              : trendDirection === "down" 
              ? "bg-rose-500" 
              : "bg-slate-400"
          }`} />
          <span className="text-[10px] font-mono font-semibold text-slate-400">
            {trend}
          </span>
        </div>
      </div>

      <div className={`p-4 rounded-xl ${iconBgColor} ${iconTextColor} flex-shrink-0 shadow-xs`}>
        <IconComponent className="w-6 h-6" />
      </div>
    </div>
  );
}
