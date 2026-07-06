/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { useNotification } from "./NotificationContext";
import { triggerEnterpriseToast } from "../utils/notification";
import { Search, RotateCcw, Trash2, ArrowLeft, ShieldAlert, CheckCircle, Info } from "lucide-react";

interface DeletedItem {
  id: string;
  original_id: string;
  original_module: string;
  deleted_by: string;
  deleted_at: string;
  deleted_reason: string;
  payload: any;
}

export default function RestorationCenter() {
  const { showToast } = useNotification();
  const [items, setItems] = useState<DeletedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  
  // Selection and dialog state
  const [selectedItem, setSelectedItem] = useState<DeletedItem | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [typedConfirm, setTypedConfirm] = useState("");
  const [checkboxConfirm, setCheckboxConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const fetchDeletedItems = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/restoration/deleted-items");
      if (res.ok) {
        const data = await res.json();
        setItems(data);
      } else {
        triggerEnterpriseToast(showToast, "ERROR", "Could not load deleted registry indexes.");
      }
    } catch (err: any) {
      triggerEnterpriseToast(showToast, "ERROR", err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDeletedItems();
  }, []);

  const handleRestore = async (item: DeletedItem) => {
    try {
      const res = await fetch("/api/restoration/restore", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: item.original_id })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        triggerEnterpriseToast(showToast, "SUCCESS", `Restored ${item.original_module} ID: ${item.original_id} successfully.`);
        fetchDeletedItems();
      } else {
        showToast(data.error || "Failed to restore item.", "error");
      }
    } catch (err: any) {
      triggerEnterpriseToast(showToast, "ERROR", err.message);
    }
  };

  const handlePermanentDeleteInitiate = (item: DeletedItem) => {
    setSelectedItem(item);
    setTypedConfirm("");
    setCheckboxConfirm(false);
    setShowDeleteModal(true);
  };

  const handlePermanentDeleteConfirm = async () => {
    if (!selectedItem) return;
    if (typedConfirm !== "CONFIRM PERMANENT DELETE") {
      showToast("Please enter the confirmation text exactly as requested.", "warning");
      return;
    }
    if (!checkboxConfirm) {
      showToast("Please check the declaration box to authorize permanent deletion.", "warning");
      return;
    }

    try {
      setSubmitting(true);
      const res = await fetch("/api/restoration/permanent-delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: selectedItem.original_id,
          typedConfirmation: typedConfirm
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showToast("Item permanently deleted from platform records.", "success");
        setShowDeleteModal(false);
        setSelectedItem(null);
        fetchDeletedItems();
      } else {
        showToast(data.error || "Failed to permanently purge record.", "error");
      }
    } catch (err: any) {
      triggerEnterpriseToast(showToast, "ERROR", err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const filteredItems = items.filter(item => {
    const q = searchQuery.toLowerCase();
    return (
      item.original_module.toLowerCase().includes(q) ||
      item.deleted_by.toLowerCase().includes(q) ||
      item.deleted_reason.toLowerCase().includes(q) ||
      item.original_id.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-4 md:p-6" id="restoration-center-dashboard">
      {/* Title block */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-slate-900 p-6 rounded-xl border border-indigo-950/40 shadow-xl">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <span className="p-1.5 bg-indigo-500/10 rounded-lg text-indigo-400">
              <RotateCcw className="w-6 h-6 animate-pulse" />
            </span>
            Record Recovery Center
          </h1>
          <p className="text-xs text-slate-400 mt-1 max-w-2xl">
            Audit and recover soft-deleted National records including user accounts, organization registries, and applicant portfolios.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs bg-indigo-950/20 px-3 py-1.5 rounded-lg border border-indigo-900/30 text-indigo-300">
          <Info className="w-4 h-4" />
          <span>Active Session: FED Super Admin Oversight</span>
        </div>
      </div>

      {/* Filter and search utilities */}
      <div className="bg-slate-900/50 p-4 rounded-xl border border-indigo-950/30 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="relative w-full sm:max-w-md">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search by module, deleted by, or recovery serial..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-950 text-slate-200 pl-10 pr-4 py-2 rounded-lg border border-indigo-950 focus:border-indigo-500 focus:outline-none text-xs"
          />
        </div>
        <button
          onClick={fetchDeletedItems}
          className="px-4 py-2 bg-indigo-900/30 hover:bg-indigo-900/50 border border-indigo-850 text-indigo-200 rounded-lg text-xs font-medium cursor-pointer transition flex items-center gap-1.5 shadow-sm"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Reload Registry</span>
        </button>
      </div>

      {/* Primary Data Grid */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map(idx => (
            <div key={idx} className="h-16 bg-slate-900 animate-pulse rounded-lg border border-indigo-950/30" />
          ))}
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="bg-slate-900/25 border border-dashed border-indigo-950/40 rounded-xl p-12 text-center max-w-lg mx-auto">
          <CheckCircle className="w-12 h-12 text-green-500/20 mx-auto mb-4" />
          <h3 className="text-sm font-semibold text-slate-200">System Records Symmetrical</h3>
          <p className="text-xs text-slate-400 mt-1">
            No soft-deleted records require administrative validation.
          </p>
        </div>
      ) : (
        <div className="bg-slate-900 border border-indigo-950 rounded-xl overflow-hidden shadow-2xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950 text-slate-400 border-b border-indigo-950 uppercase tracking-wider font-semibold text-[10px]">
                <tr>
                  <th className="py-4 px-5">Original Module</th>
                  <th className="py-4 px-5">Oversight Serial</th>
                  <th className="py-4 px-5">Deleted By</th>
                  <th className="py-4 px-5">Purge Timestamp</th>
                  <th className="py-4 px-5">Reason</th>
                  <th className="py-4 px-5 text-right">Oversight Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-indigo-950/40 text-slate-200">
                {filteredItems.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-900/80 transition-colors">
                    <td className="py-4 px-5 font-semibold text-indigo-400">
                      <span className="bg-indigo-500/10 text-indigo-300 px-2 py-0.5 rounded text-[11px] uppercase">
                        {item.original_module}
                      </span>
                    </td>
                    <td className="py-4 px-5 font-mono text-slate-300">
                      {item.original_id}
                    </td>
                    <td className="py-4 px-5 text-slate-300">
                      {item.deleted_by}
                    </td>
                    <td className="py-4 px-5 text-slate-400">
                      {new Date(item.deleted_at).toLocaleString()}
                    </td>
                    <td className="py-4 px-5 text-slate-300 max-w-xs truncate" title={item.deleted_reason}>
                      {item.deleted_reason}
                    </td>
                    <td className="py-4 px-5 text-right space-x-2">
                      <button
                        onClick={() => handleRestore(item)}
                        className="inline-flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-medium px-3 py-1.5 rounded-lg text-xs cursor-pointer shadow-sm transition active:scale-[97%]"
                        title="Restore this record back to active state"
                      >
                        <RotateCcw className="w-3 h-3" />
                        <span>Restore</span>
                      </button>
                      <button
                        onClick={() => handlePermanentDeleteInitiate(item)}
                        className="inline-flex items-center gap-1.5 bg-red-600/15 hover:bg-red-600 border border-red-500/30 hover:border-red-500 text-red-400 hover:text-white font-medium px-3 py-1.5 rounded-lg text-xs cursor-pointer shadow-sm transition active:scale-[97%]"
                        title="Permanently remove this record forever"
                      >
                        <Trash2 className="w-3 h-3" />
                        <span>Purge</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Multi-step Permanent Delete Authorization Dialog */}
      {showDeleteModal && selectedItem && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-red-500/30 rounded-2xl max-w-lg w-full overflow-hidden shadow-2xl p-6 space-y-6">
            <div className="flex items-center gap-3 border-b border-indigo-950 pb-4">
              <span className="p-2 bg-red-500/10 rounded-xl text-red-500">
                <ShieldAlert className="w-6 h-6 animate-bounce" />
              </span>
              <div>
                <h3 className="text-md font-bold text-white uppercase tracking-wider">
                  Federal Security Authorization Required
                </h3>
                <p className="text-xs text-red-400">
                  CRITICAL: Absolute and irreversible deletion of a National record.
                </p>
              </div>
            </div>

            <div className="bg-slate-950 border border-slate-800 p-4 rounded-xl text-xs space-y-3 leading-relaxed text-slate-300">
              <p>
                You are authorizing the <strong>permanent deletion</strong> of the following record:
              </p>
              <div className="grid grid-cols-2 gap-2 bg-slate-900 p-3 rounded-lg border border-indigo-950/50 font-mono text-[11px] text-slate-400">
                <div>Module type:</div>
                <div className="text-white font-bold">{selectedItem.original_module}</div>
                <div>Record ID:</div>
                <div className="text-white truncate" title={selectedItem.original_id}>{selectedItem.original_id}</div>
                <div>Purged By:</div>
                <div className="text-white">{selectedItem.deleted_by}</div>
              </div>
              <p className="text-red-400 font-medium">
                Warning: Once authorized, this record and all associated relational indices are permanently dropped from the database cluster. Backups or Record Recovery Center logs won&apos;t be able to recover this profile.
              </p>
            </div>

            {/* Validation Phase 1 */}
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-slate-400">
                STEP 1: Type confirmation phrase exactly:
              </label>
              <div className="bg-slate-950 p-2.5 rounded-lg border border-red-500/20 text-center font-mono font-bold text-[11px] text-red-400 select-all mb-1">
                CONFIRM PERMANENT DELETE
              </div>
              <input
                type="text"
                value={typedConfirm}
                onChange={(e) => setTypedConfirm(e.target.value)}
                placeholder="Type here..."
                className="w-full bg-slate-950 text-slate-200 border border-indigo-950/60 focus:border-red-500 rounded-lg p-2.5 text-xs font-mono text-center tracking-wider focus:outline-none"
              />
            </div>

            {/* Validation Phase 2 */}
            <div className="bg-slate-950 p-3.5 rounded-lg border border-indigo-950/50 flex items-start gap-3">
              <input
                type="checkbox"
                id="checkbox-declare"
                checked={checkboxConfirm}
                onChange={(e) => setCheckboxConfirm(e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded text-indigo-600 bg-slate-900 border-indigo-950 focus:ring-0 cursor-pointer"
              />
              <label htmlFor="checkbox-declare" className="text-[11px] text-slate-400 leading-normal cursor-pointer select-none">
                I solemnly declare that I have checked the dependency matrix for this record and actively authorize its global deletion from the National TVET platform database schema.
              </label>
            </div>

            {/* Footer triggers */}
            <div className="flex items-center justify-end gap-3 border-t border-indigo-950 pt-4">
              <button
                type="button"
                onClick={() => setShowDeleteModal(false)}
                className="px-4 py-2 bg-slate-850 hover:bg-slate-800 text-slate-300 rounded-lg text-xs font-medium cursor-pointer"
              >
                Cancel Oversight
              </button>
              <button
                type="button"
                disabled={submitting || typedConfirm !== "CONFIRM PERMANENT DELETE" || !checkboxConfirm}
                onClick={handlePermanentDeleteConfirm}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-red-650 hover:bg-red-600 disabled:opacity-30 text-white rounded-lg text-xs font-bold shadow-md cursor-pointer disabled:cursor-not-allowed transition"
              >
                {submitting ? "Purging Record..." : "Confirm & Execute Purge"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
