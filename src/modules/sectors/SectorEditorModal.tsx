import React, { useState } from "react";
import { X, Map, Compass } from "lucide-react";

interface SectorEditorModalProps {
  sector: any | null; // null if creating a new sector
  onClose: () => void;
  onSave: (payload: any) => Promise<void>;
}

export function SectorEditorModal({ sector, onClose, onSave }: SectorEditorModalProps) {
  const [sectorCode, setSectorCode] = useState(sector?.sector_code || sector?.sectorCode || "");
  const [sectorName, setSectorName] = useState(sector?.sector_name || sector?.sectorName || "");
  const [description, setDescription] = useState(sector?.description || "");
  const [status, setStatus] = useState(sector?.status || "ACTIVE");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sectorCode || !sectorName) {
      setError("Please fill in code and name.");
      return;
    }
    setIsSubmitting(true);
    setError(null);
    try {
      await onSave({
        id: sector?.id,
        sectorCode,
        sectorName,
        description,
        status
      });
      onClose();
    } catch (err: any) {
      setError(err?.message || "Failed to save sector.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-950/60 flex items-center justify-center z-50 p-4 font-sans no-print animate-in fade-in duration-200">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-100">
        
        {/* Header */}
        <div className="px-5 py-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Map className="w-5 h-5 text-indigo-400" />
            <h3 className="font-bold text-sm tracking-tight text-white">
              {sector ? `Edit Sector: ${sectorName}` : "Create National Sector"}
            </h3>
          </div>
          <button 
            type="button" 
            onClick={onClose} 
            className="p-1 text-slate-400 hover:text-white rounded-lg flex items-center justify-center min-h-[32px] min-w-[32px] cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs text-slate-700">
          {error && (
            <div className="p-3 bg-red-50 text-red-700 rounded-lg border border-red-200 font-semibold">
              {error}
            </div>
          )}

          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-1">
              <label htmlFor="sector-code-inp" className="block font-bold text-slate-600 mb-1">Sector Code *</label>
              <input
                id="sector-code-inp"
                type="text"
                placeholder="SEC-AGRI"
                value={sectorCode}
                onChange={(e) => setSectorCode(e.target.value)}
                className="w-full p-2 border border-slate-200 rounded-lg focus:outline-hidden focus:border-indigo-600 font-mono font-bold uppercase"
                required
              />
            </div>
            <div className="col-span-2">
              <label htmlFor="sector-name-inp" className="block font-bold text-slate-600 mb-1">Official Sector Name *</label>
              <input
                id="sector-name-inp"
                type="text"
                placeholder="e.g. Agriculture & Forestry"
                value={sectorName}
                onChange={(e) => setSectorName(e.target.value)}
                className="w-full p-2 border border-slate-200 rounded-lg focus:outline-hidden focus:border-indigo-600 font-semibold"
                required
              />
            </div>
          </div>

          <div>
            <label htmlFor="sector-status-sel" className="block font-bold text-slate-600 mb-1">Status</label>
            <select
              id="sector-status-sel"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full p-2 border border-slate-200 rounded-lg focus:outline-hidden bg-white font-semibold"
            >
              <option value="ACTIVE">ACTIVE</option>
              <option value="ARCHIVED">ARCHIVED</option>
            </select>
          </div>

          <div>
            <label htmlFor="sector-desc-inp" className="block font-bold text-slate-600 mb-1">Sector Scope and Focus</label>
            <textarea
              id="sector-desc-inp"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Scope of trades, industries involved, and national economic impact priorities."
              className="w-full p-2 border border-slate-200 rounded-lg focus:outline-hidden h-24 resize-none leading-relaxed"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2 border-t pt-4 mt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-700 font-semibold rounded-lg cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 bg-slate-900 border border-slate-950 text-white hover:bg-slate-850 font-bold rounded-lg cursor-pointer shadow-sm"
            >
              {isSubmitting ? "Saving..." : "Save Sector"}
            </button>
          </div>
        </form>

      </div>
    </div>
  );
}
