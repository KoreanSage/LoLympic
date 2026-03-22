"use client";

import { useState, useEffect, useCallback, createContext, useContext } from "react";

interface ToastItem {
  id: number;
  message: string;
  type: "success" | "error" | "info";
}

interface ToastContextValue {
  toast: (message: string, type?: ToastItem["type"]) => void;
}

const ToastContext = createContext<ToastContextValue>({
  toast: () => {},
});

export function useToast() {
  return useContext(ToastContext);
}

let nextId = 0;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const MAX_VISIBLE = 3;

  const toast = useCallback((message: string, type: ToastItem["type"] = "info") => {
    const id = nextId++;
    setToasts((prev) => {
      const next = [...prev, { id, message, type }];
      // Keep only the newest MAX_VISIBLE toasts
      if (next.length > MAX_VISIBLE) {
        return next.slice(next.length - MAX_VISIBLE);
      }
      return next;
    });
  }, []);

  const remove = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div
        className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] flex flex-col gap-2 items-center pointer-events-none"
        aria-live="polite"
        aria-relevant="additions"
      >
        {toasts.map((t) => (
          <ToastMessage key={t.id} item={t} onDone={() => remove(t.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastMessage({ item, onDone }: { item: ToastItem; onDone: () => void }) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setVisible(false), 2500);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!visible) {
      const timer = setTimeout(onDone, 300);
      return () => clearTimeout(timer);
    }
  }, [visible, onDone]);

  const bg =
    item.type === "success"
      ? "bg-emerald-600/90"
      : item.type === "error"
      ? "bg-red-600/90"
      : "bg-background-overlay/90";

  return (
    <div
      role="alert"
      className={`
        pointer-events-auto px-4 py-2.5 rounded-xl text-sm text-white backdrop-blur-sm border border-white/10
        transition-all duration-300
        ${bg}
        ${visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"}
      `}
    >
      {item.message}
    </div>
  );
}
