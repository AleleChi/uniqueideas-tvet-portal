/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { createContext, useContext, useState, useCallback, useEffect } from "react";
import { CheckCircle, AlertTriangle, XCircle, Info, X } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

export type ToastType = "success" | "warning" | "error" | "info";

export interface Toast {
  id: string;
  message: string;
  type: ToastType;
}

interface NotificationContextProps {
  showToast: (message: string, type: ToastType) => void;
  confirmDelete: (nameOrOptions: any, onConfirm?: () => void) => void;
}

const NotificationContext = createContext<NotificationContextProps | undefined>(undefined);

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [confirmState, setConfirmState] = useState<{
    isOpen: boolean;
    name: string;
    title?: string;
    message?: string;
    onConfirm: () => void;
  } | null>(null);

  const showToast = useCallback((message: string, type: ToastType) => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, message, type }]);
  }, []);

  const confirmDelete = useCallback((nameOrOptions: any, onConfirm?: () => void) => {
    let name = "Target Item";
    let title = "Delete Confirmation";
    let message = "Are you sure you want to delete this item?";
    let confirmFn = onConfirm || (() => {});

    if (typeof nameOrOptions === "object" && nameOrOptions !== null) {
      name = nameOrOptions.name || nameOrOptions.title || "Target Item";
      if (nameOrOptions.title) title = nameOrOptions.title;
      if (nameOrOptions.message) message = nameOrOptions.message;
      if (nameOrOptions.onConfirm) confirmFn = nameOrOptions.onConfirm;
    } else if (typeof nameOrOptions === "string") {
      name = nameOrOptions;
    }

    setConfirmState({
      isOpen: true,
      name,
      title,
      message,
      onConfirm: () => {
        confirmFn();
        setConfirmState(null);
      }
    });
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  // Expose to window for edge-case integration or raw api callbacks as a fallback
  useEffect(() => {
    (window as any).showToast = (message: string, type: ToastType = "info") => {
      showToast(message, type);
    };
    return () => {
      delete (window as any).showToast;
    };
  }, [showToast]);

  return (
    <NotificationContext.Provider value={{ showToast, confirmDelete }}>
      {children}
      
      {/* Centralized Toasts Container */}
      <div className="fixed top-4 right-4 z-[9999] pointer-events-none flex flex-col gap-2 max-w-sm w-full font-sans">
        <AnimatePresence>
          {toasts.map((toast) => (
            <ToastItem
              key={toast.id}
              toast={toast}
              onClose={() => removeToast(toast.id)}
            />
          ))}
        </AnimatePresence>
      </div>

      {/* Centralized Delete Confirmation Modal */}
      <AnimatePresence>
        {confirmState?.isOpen && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setConfirmState(null)}
              className="absolute inset-0 bg-slate-950/70 backdrop-blur-xs pointer-events-auto"
            />

            {/* Modal Box */}
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ type: "spring", duration: 0.3 }}
              className="relative w-full max-w-md bg-white border border-slate-200 rounded-xl shadow-xl p-6 pointer-events-auto overflow-hidden font-sans border-t-4 border-red-600"
              id="delete-confirmation-modal"
            >
              <div className="flex items-start gap-4">
                <div className="p-3 bg-red-50 text-red-600 rounded-lg">
                  <AlertTriangle className="w-6 h-6" />
                </div>
                <div className="space-y-2 flex-grow text-left">
                  <h3 className="text-sm font-bold uppercase tracking-wider text-slate-800 font-display">
                    {confirmState.title || "Delete Confirmation"}
                  </h3>
                  <p className="text-xs text-slate-500 font-medium leading-relaxed">
                    {confirmState.message || "Are you sure you want to delete this item?"}
                  </p>
                  <div className="bg-slate-50 border border-slate-100 p-2.5 rounded-lg">
                    <span className="text-[10px] font-bold text-slate-400 block font-mono uppercase">TARGET NAME:</span>
                    <span className="text-xs font-bold text-slate-800 font-mono">{confirmState.name}</span>
                  </div>
                  <p className="text-[10px] text-slate-400 font-medium">
                    This action is immediate and will remove the beneficiary from active state ledgers.
                  </p>
                </div>
              </div>

              {/* Action row */}
              <div className="mt-6 flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setConfirmState(null)}
                  className="bg-transparent hover:bg-slate-100 text-slate-500 hover:text-slate-700 py-2 px-4 rounded-lg text-xs font-bold transition cursor-pointer"
                  id="cancel-delete-btn"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={confirmState.onConfirm}
                  className="bg-red-600 hover:bg-red-500 text-white py-2 px-5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shadow-xs active:scale-95"
                  id="confirm-delete-btn"
                >
                  Delete
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </NotificationContext.Provider>
  );
}

function ToastItem({ toast, onClose }: { toast: Toast; onClose: () => void; key?: any }) {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, 4000);
    return () => clearTimeout(timer);
  }, [onClose]);

  const styleMap = {
    success: {
      bg: "bg-white border-l-4 border-emerald-500 shadow-emerald-500/10",
      icon: <CheckCircle className="w-4 h-4 text-emerald-500 flex-shrink-0" />,
      text: "text-slate-800",
    },
    warning: {
      bg: "bg-white border-l-4 border-amber-500 shadow-amber-500/10",
      icon: <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0" />,
      text: "text-slate-800",
    },
    error: {
      bg: "bg-white border-l-4 border-rose-500 shadow-rose-500/10",
      icon: <XCircle className="w-4 h-4 text-rose-500 flex-shrink-0" />,
      text: "text-slate-800",
    },
    info: {
      bg: "bg-white border-l-4 border-blue-500 shadow-blue-500/10",
      icon: <Info className="w-4 h-4 text-blue-500 flex-shrink-0" />,
      text: "text-slate-800",
    },
  };

  const scheme = styleMap[toast.type];

  return (
    <motion.div
      initial={{ opacity: 0, y: -20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ type: "spring", stiffness: 350, damping: 25 }}
      className={`pointer-events-auto p-4 rounded-xl border border-slate-150 shadow-md ${scheme.bg} flex items-start gap-3 justify-between`}
    >
      <div className="flex items-start gap-2.5">
        <div className="mt-0.5">{scheme.icon}</div>
        <div className="text-left">
          <p className={`text-[11px] font-semibold leading-relaxed ${scheme.text}`}>
            {toast.message}
          </p>
        </div>
      </div>
      <button
        type="button"
        onClick={onClose}
        className="text-slate-300 hover:text-slate-500 transition cursor-pointer flex-shrink-0"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </motion.div>
  );
}

export function useNotification() {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error("useNotification must be used within a NotificationProvider");
  }
  return context;
}
