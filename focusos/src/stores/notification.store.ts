import { create } from "zustand";

export interface Toast {
  id: string;
  type: "success" | "error" | "warning" | "info";
  title: string;
  message?: string;
  duration?: number; // duration in ms
}

export interface NotificationState {
  toasts: Toast[];
  permission: NotificationPermission | null;

  // Actions
  addToast: (toast: Omit<Toast, "id">) => void;
  removeToast: (id: string) => void;
  requestPermission: () => Promise<void>;
}

export const useNotificationStore = create<NotificationState>((set) => ({
  toasts: [],
  permission: typeof window !== "undefined" ? Notification.permission : null,

  addToast: (toast) => {
    const id = Math.random().toString(36).substring(2, 9);
    const newToast: Toast = { ...toast, id };
    
    set((state) => ({
      toasts: [...state.toasts, newToast],
    }));

    // Auto-remove toast after duration (default: 4000ms)
    const duration = toast.duration ?? 4000;
    setTimeout(() => {
      set((state) => ({
        toasts: state.toasts.filter((t) => t.id !== id),
      }));
    }, duration);
  },

  removeToast: (id) => {
    set((state) => ({
      toasts: state.toasts.filter((toast) => toast.id !== id),
    }));
  },

  requestPermission: async () => {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    try {
      const permission = await Notification.requestPermission();
      set({ permission });
    } catch (err) {
      console.warn("Failed to request push notification permission:", err);
    }
  },
}));
