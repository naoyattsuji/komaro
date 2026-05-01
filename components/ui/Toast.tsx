"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { CheckCircle, XCircle, X } from "lucide-react";

export type ToastType = "success" | "error" | "info";

export interface ToastMessage {
  id: string;
  type: ToastType;
  message: string;
}

let listeners: ((toasts: ToastMessage[]) => void)[] = [];
let toasts: ToastMessage[] = [];

function emit() {
  listeners.forEach((l) => l([...toasts]));
}

export function showToast(message: string, type: ToastType = "success") {
  const id = Math.random().toString(36).slice(2);
  toasts = [...toasts, { id, type, message }];
  emit();
  setTimeout(() => {
    toasts = toasts.filter((t) => t.id !== id);
    emit();
  }, 4000);
}

export function ToastContainer() {
  const [messages, setMessages] = useState<ToastMessage[]>([]);

  useEffect(() => {
    listeners.push(setMessages);
    return () => {
      listeners = listeners.filter((l) => l !== setMessages);
    };
  }, []);

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[100] flex flex-col gap-2 w-full max-w-sm px-4">
      {messages.map((toast) => (
        <div
          key={toast.id}
          className={cn(
            "flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg text-sm font-medium animate-in slide-in-from-bottom-2",
            "bg-gray-900 text-white"
          )}
          role="alert"
        >
          {toast.type === "success" && <CheckCircle size={18} />}
          {toast.type === "error" && <XCircle size={18} className="text-red-400" />}
          <span className="flex-1">{toast.message}</span>
          <button
            onClick={() => {
              toasts = toasts.filter((t) => t.id !== toast.id);
              emit();
            }}
            className="opacity-50 hover:opacity-100"
          >
            <X size={16} />
          </button>
        </div>
      ))}
    </div>
  );
}
