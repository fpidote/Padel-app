// src/components/shared/Toaster.jsx
// Muestra los avisos de showToast (logic/toast.js). Se monta una sola vez en App.jsx.
import { useState, useEffect } from "react";
import { subscribeToasts } from "../../logic/toast";

const DURATION_MS = 5000;

export default function Toaster() {
  const [toasts, setToasts] = useState([]);

  useEffect(() => {
    const timers = new Map();
    function dismiss(id) {
      clearTimeout(timers.get(id));
      timers.delete(id);
      setToasts((list) => list.filter((t) => t.id !== id));
    }
    const off = subscribeToasts((toast) => {
      setToasts((list) => [...list, toast]);
      timers.set(toast.id, setTimeout(() => dismiss(toast.id), DURATION_MS));
    });
    return () => {
      off();
      timers.forEach(clearTimeout);
    };
  }, []);

  if (!toasts.length) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-4 inset-x-4 z-[10000] flex flex-col items-center gap-2 pointer-events-none"
    >
      {toasts.map((toast) => (
        <button
          key={toast.id}
          type="button"
          onClick={() => setToasts((list) => list.filter((t) => t.id !== toast.id))}
          className={`pointer-events-auto w-full max-w-md rounded-xl border px-4 py-3 text-left text-sm font-semibold shadow-2xl cursor-pointer bg-[#1e293b] ${
            toast.type === "ok"
              ? "border-green-400/30 text-green-300"
              : "border-red-400/30 text-red-300"
          }`}
        >
          {toast.type === "ok" ? "✓ " : "⚠️ "}
          {toast.message}
        </button>
      ))}
    </div>
  );
}
