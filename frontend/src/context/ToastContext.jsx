import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

const ToastContext = createContext(null);

const ICONS = {
  success: CheckCircle2,
  error: AlertCircle,
  info: Info,
};

const DEFAULT_DURATION = { success: 4000, info: 4000, error: 7000 };
const MAX_VISIBLE = 4;

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);
  const timers = useRef(new Map());
  const nextId = useRef(0);
  const visible = useRef([]); // mirrors `toasts` so push() can detect duplicates synchronously

  const dismiss = useCallback((id) => {
    clearTimeout(timers.current.get(id));
    timers.current.delete(id);
    visible.current = visible.current.filter((t) => t.id !== id);
    setToasts((current) => current.filter((t) => t.id !== id));
  }, []);

  const push = useCallback(
    (type, message, duration) => {
      const ms = duration ?? DEFAULT_DURATION[type];

      // Same message already on screen (e.g. a request retried or fired twice): keep one and restart its timer
      const existing = visible.current.find((t) => t.type === type && t.message === message);
      if (existing) {
        clearTimeout(timers.current.get(existing.id));
        timers.current.set(existing.id, setTimeout(() => dismiss(existing.id), ms));
        return existing.id;
      }

      const id = ++nextId.current;
      const toast = { id, type, message };
      visible.current = [...visible.current.slice(-(MAX_VISIBLE - 1)), toast];
      setToasts(visible.current);
      timers.current.set(id, setTimeout(() => dismiss(id), ms));
      return id;
    },
    [dismiss]
  );

  // Clear pending timers on unmount
  useEffect(() => {
    const pending = timers.current;
    return () => pending.forEach(clearTimeout);
  }, []);

  const api = useMemo(
    () => ({
      success: (message, duration) => push('success', message, duration),
      error: (message, duration) => push('error', message, duration),
      info: (message, duration) => push('info', message, duration),
      dismiss,
    }),
    [push, dismiss]
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="toast-viewport" role="region" aria-label="Notifications">
        {toasts.map((toast) => {
          const Icon = ICONS[toast.type];
          return (
            <div
              key={toast.id}
              className={`toast toast-${toast.type}`}
              role={toast.type === 'error' ? 'alert' : 'status'}
            >
              <Icon size={18} className="toast-icon" aria-hidden="true" />
              <p className="toast-message">{toast.message}</p>
              <button
                type="button"
                className="toast-close"
                onClick={() => dismiss(toast.id)}
                aria-label="Dismiss notification"
              >
                <X size={14} aria-hidden="true" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>');
  return ctx;
};

/**
 * Readable message from an Axios error (falls back to a generic one).
 */
export const getErrorMessage = (error, fallback = 'Something went wrong. Please try again.') =>
  error?.response?.data?.message || (error?.code === 'ERR_NETWORK' ? 'Cannot reach the server. Check your connection.' : error?.message) || fallback;
