import { create } from "zustand";
import type { Notification } from "@/components/navigation";

export interface Toast {
  id: string;
  type: "success" | "error" | "warning" | "info";
  title: string;
  message?: string;
  duration?: number; // duration in ms
}

export interface NotificationState {
  toasts: Toast[];
  notifications: Notification[];
  permission: NotificationPermission | null;

  // Actions
  addToast: (toast: Omit<Toast, "id">) => void;
  addNotification: (notification: Omit<Notification, "id" | "isRead" | "createdAt"> & {
    id?: string;
    isRead?: boolean;
    createdAt?: Date | string;
  }) => void;
  removeToast: (id: string) => void;
  markNotificationRead: (id: string) => void;
  markAllNotificationsRead: () => void;
  dismissNotification: (id: string) => void;
  requestPermission: () => Promise<void>;
}

export const useNotificationStore = create<NotificationState>((set) => ({
  toasts: [],
  notifications: [],
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

  addNotification: (notification) => {
    const id = notification.id ?? Math.random().toString(36).substring(2, 9);
    const nextNotification: Notification = {
      ...notification,
      id,
      isRead: notification.isRead ?? false,
      createdAt: notification.createdAt ?? new Date(),
    };

    set((state) => ({
      notifications: [
        nextNotification,
        ...state.notifications.filter((item) => item.id !== id),
      ].slice(0, 40),
    }));
  },

  removeToast: (id) => {
    set((state) => ({
      toasts: state.toasts.filter((toast) => toast.id !== id),
    }));
  },

  markNotificationRead: (id) => {
    set((state) => ({
      notifications: state.notifications.map((notification) =>
        notification.id === id ? { ...notification, isRead: true } : notification
      ),
    }));
  },

  markAllNotificationsRead: () => {
    set((state) => ({
      notifications: state.notifications.map((notification) => ({
        ...notification,
        isRead: true,
      })),
    }));
  },

  dismissNotification: (id) => {
    set((state) => ({
      notifications: state.notifications.filter((notification) => notification.id !== id),
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
