/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { Plus, Trash2, Sliders, ToggleLeft, ToggleRight, ListChecks, HelpCircle } from "lucide-react";
import { CustomField } from "../types";

interface CustomSchemaBuilderProps {
  fields: CustomField[];
  onAddField: (field: Omit<CustomField, "id" | "name">) => Promise<void>;
  onRemoveField: (id: string) => Promise<void>;
}

export function CustomSchemaBuilder({ fields, onAddField, onRemoveField }: CustomSchemaBuilderProps) {
  const [label, setLabel] = useState("");
  const [type, setType] = useState<"text" | "number" | "select">("text");
  const [required, setRequired] = useState(true);
  const [optionStr, setOptionStr] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!label.trim()) return;

    setIsSubmitting(true);
    try {
      const options = type === "select" 
        ? optionStr.split(",").map(x => x.trim()).filter(Boolean) 
        : [];
      
      await onAddField({
        label: label.trim(),
        type,
        required,
        options
      });

      // Reset Form State
      setLabel("");
      setType("text");
      setRequired(true);
      setOptionStr("");
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
      
      {/* Configuration Form Panel (5 cols) */}
      <div className="lg:col-span-5 bg-white border border-slate-200/80 rounded-xl p-6 shadow-sm">
        <div className="flex items-center gap-2.5 mb-5 PB-2 border-b border-slate-100">
          <Sliders className="w-4 h-4 text-indigo-600" />
          <h3 className="font-display font-semibold text-slate-800 text-sm tracking-tight">
            PROVISION NEW DATA FIELD
          </h3>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1">
              Field Label Name *
            </label>
            <input 
              type="text"
              required
              placeholder="e.g. Bank Account Number"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg py-2 px-3 focus:bg-white focus:ring-2 focus:ring-outline-none text-slate-800 text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1">
              Verification Format (Type)
            </label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as any)}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg py-2 px-3 focus:bg-white focus:ring-2 focus:ring-outline-none text-slate-800 text-sm"
            >
              <option value="text">Alphanumeric Text Field</option>
              <option value="number">Numeric Only Input</option>
              <option value="select">Multiple Choice Select Choice</option>
            </select>
          </div>

          {type === "select" && (
            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1 flex items-center justify-between">
                <span>Dropdown Select Options *</span>
                <span className="text-[10px] text-slate-400 capitalize normal-case font-normal">Separate values with commas</span>
              </label>
              <input 
                type="text"
                required
                placeholder="e.g. Zenith Bank, GTBank, Trust Bank"
                value={optionStr}
                onChange={(e) => setOptionStr(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg py-2 px-3 focus:bg-white focus:ring-2 focus:ring-outline-none text-slate-800 text-sm"
              />
            </div>
          )}

          <div className="flex items-center justify-between py-2 border-t border-b border-dashed border-slate-100">
            <div>
              <p className="text-xs font-semibold text-slate-700">Enforce Hard Field Validation</p>
              <p className="text-[10px] text-slate-400">Block submission if field is left blank</p>
            </div>
            <button 
              type="button" 
              onClick={() => setRequired(!required)}
              className="text-indigo-600 focus:outline-none"
            >
              {required ? (
                <ToggleRight className="w-8 h-8 pointer-events-none" />
              ) : (
                <ToggleLeft className="w-8 h-8 text-slate-300 pointer-events-none" />
              )}
            </button>
          </div>

          <button 
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-semibold py-2.5 px-4 rounded-lg flex items-center justify-center gap-2 text-xs shadow transition active:scale-[99%]"
          >
            <Plus className="w-4 h-4" />
            {isSubmitting ? "Provisioning..." : "Inject Field into Schema"}
          </button>
        </form>
      </div>

      {/* Active Fields Schema Status Grid (7 cols) */}
      <div className="lg:col-span-7 flex flex-col gap-4">
        
        <div className="bg-slate-50 border border-slate-200/60 rounded-xl p-5">
          <h4 className="text-xs font-bold text-slate-700 mb-1 tracking-wide uppercase flex items-center gap-2">
            <HelpCircle className="w-3.5 h-3.5 text-indigo-500" />
            HOW DYNAMIC SCHEMA INJECTION WORKS
          </h4>
          <p className="text-xs leading-relaxed text-slate-500">
            Using our advanced programmatic registry, newly configured fields are instantaneously available under custom forms without database shutdowns or compilation cycles.
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
          <div className="bg-slate-50/70 p-4 border-b border-slate-200 flex items-center justify-between">
            <h4 className="text-xs font-display font-semibold text-slate-700 uppercase tracking-widest flex items-center gap-2">
              <ListChecks className="w-3.5 h-3.5 text-indigo-500" />
              Active System Custom Fields Definitions ({fields.length})
            </h4>
          </div>
          
          <div className="divide-y divide-slate-100 max-h-[460px] overflow-y-auto">
            {fields.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-xs">
                No custom administrative fields configured. Enrolling takes standard variables only.
              </div>
            ) : (
              fields.map((f, i) => (
                <div key={f.id} className="p-4 flex items-center justify-between hover:bg-slate-50/50 transition">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-display font-medium text-xs text-slate-800">{f.label}</span>
                      {f.required && (
                        <span className="bg-rose-50 text-rose-600 border border-rose-100 text-[9px] px-1.5 py-0.5 rounded font-bold">
                          Required
                        </span>
                      )}
                    </div>
                    <div className="text-[10px] font-mono text-slate-400 mt-1 flex flex-wrap items-center gap-3">
                      <span>KEY: {f.name}</span>
                      <span>•</span>
                      <span>TYPE: {f.type.toUpperCase()}</span>
                      {f.options && f.options.length > 0 && (
                        <>
                          <span>•</span>
                          <span className="max-w-[200px] truncate">CHOICES: {f.options.join(", ")}</span>
                        </>
                      )}
                    </div>
                  </div>
                  <button 
                    onClick={() => onRemoveField(f.id)}
                    className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition focus:outline-none"
                    title="Delete Custom Field From Schema"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

      </div>

    </div>
  );
}
