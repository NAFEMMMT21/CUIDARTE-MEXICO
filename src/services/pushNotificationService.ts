/**
 * Push and In-App Notification Service for Cuidarte Pachuca
 * Manages native browser push notifications, sound triggers, and in-app interactive toasts.
 */

import { audioNotificationService, NotificationSoundType } from "./audioNotificationService";

export type AppNotificationCategory =
  | "shift_new"
  | "shift_change"
  | "shift_start_soon"
  | "shift_end_10min"
  | "med_5min"
  | "med_overdue"
  | "general";

export interface AppNotification {
  id: string;
  category: AppNotificationCategory;
  title: string;
  body: string;
  timestamp: string; // ISO string
  read: boolean;
  soundType: NotificationSoundType;
  actionType?: "open_kardex" | "open_calendar" | "start_guardia" | "end_guardia" | "open_expediente";
  actionPayload?: {
    clientId?: string;
    clientNombre?: string;
    medId?: string;
    medNombre?: string;
    eventId?: string;
    guardiaId?: string;
    horario?: string;
  };
}

type NotificationListener = (notifications: AppNotification[]) => void;
type ToastListener = (notification: AppNotification) => void;

class PushNotificationService {
  private notifications: AppNotification[] = [];
  private listeners: Set<NotificationListener> = new Set();
  private toastListeners: Set<ToastListener> = new Set();
  private permissionState: NotificationPermission = "default";
  private swRegistration: ServiceWorkerRegistration | null = null;
  private wakeLockSentinel: any = null;

  constructor() {
    if (typeof window !== "undefined") {
      if ("Notification" in window) {
        this.permissionState = Notification.permission;
      }
      this.loadStoredNotifications();
      this.initServiceWorker();
    }
  }

  private initServiceWorker() {
    if (typeof window !== "undefined" && "serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js", { scope: "/" })
        .then((reg) => {
          this.swRegistration = reg;
        })
        .catch((err) => {
          console.warn("[Push] ServiceWorker registration warning:", err);
        });

      navigator.serviceWorker.addEventListener("message", (event) => {
        if (event.data?.type === "NOTIFICATION_ACTION_CLICK") {
          // Bring window to focus if possible
          if (typeof window !== "undefined" && window.focus) {
            window.focus();
          }
        }
      });
    }
  }

  public async acquireWakeLock(): Promise<boolean> {
    if (typeof navigator !== "undefined" && "wakeLock" in navigator) {
      try {
        this.wakeLockSentinel = await (navigator as any).wakeLock.request("screen");
        this.wakeLockSentinel.addEventListener("release", () => {
          this.wakeLockSentinel = null;
        });
        return true;
      } catch {
        return false;
      }
    }
    return false;
  }

  public releaseWakeLock() {
    if (this.wakeLockSentinel) {
      try {
        this.wakeLockSentinel.release();
        this.wakeLockSentinel = null;
      } catch {}
    }
  }

  private loadStoredNotifications() {
    try {
      const stored = localStorage.getItem("cuidarte_nurse_notifications");
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          // Keep up to 60 most recent notifications
          this.notifications = parsed.slice(0, 60);
        }
      }
    } catch {
      this.notifications = [];
    }
  }

  private persistNotifications() {
    try {
      localStorage.setItem("cuidarte_nurse_notifications", JSON.stringify(this.notifications.slice(0, 60)));
    } catch {}
  }

  public getPermissionStatus(): NotificationPermission {
    if (typeof window !== "undefined" && "Notification" in window) {
      this.permissionState = Notification.permission;
    }
    return this.permissionState;
  }

  public isInsideIframe(): boolean {
    if (typeof window === "undefined") return false;
    try {
      return window.self !== window.top;
    } catch {
      return true;
    }
  }

  public async requestPermission(): Promise<NotificationPermission> {
    if (typeof window === "undefined" || !("Notification" in window)) {
      return "denied";
    }
    try {
      let permission: NotificationPermission = Notification.permission;
      const res = Notification.requestPermission();
      if (res && typeof (res as any).then === "function") {
        permission = await res;
      } else {
        permission = await new Promise<NotificationPermission>((resolve) => {
          Notification.requestPermission((p) => resolve(p));
        });
      }
      this.permissionState = permission;

      // Re-trigger SW registration upon approval
      if (permission === "granted" && "serviceWorker" in navigator) {
        navigator.serviceWorker.register("/sw.js", { scope: "/" }).then((reg) => {
          this.swRegistration = reg;
        }).catch(() => {});
      }

      return permission;
    } catch (err) {
      console.warn("Error requesting notification permission:", err);
      if (typeof window !== "undefined" && "Notification" in window) {
        this.permissionState = Notification.permission;
      } else {
        this.permissionState = "denied";
      }
      return this.permissionState;
    }
  }

  public sendTestPushNotification() {
    return this.notify({
      category: "general",
      title: "🔔 Notificación Push de Prueba - Cuidarte Pachuca",
      body: "¡Excelente! Las notificaciones en segundo plano y el sonido médico están funcionando correctamente en tu dispositivo.",
      soundType: "generic",
    });
  }

  public subscribe(listener: NotificationListener): () => void {
    this.listeners.add(listener);
    listener([...this.notifications]);
    return () => this.listeners.delete(listener);
  }

  public subscribeToast(listener: ToastListener): () => void {
    this.toastListeners.add(listener);
    return () => this.toastListeners.delete(listener);
  }

  private notifySubscribers() {
    const list = [...this.notifications];
    this.listeners.forEach((listener) => listener(list));
  }

  /**
   * Dispatches a notification across all channels:
   * 1. Plays customized synthesized audio chime via Web Audio API.
   * 2. Fires Browser Native Push Notification via Service Worker (background capable) or Notification API.
   * 3. Triggers In-App Interactive Toast.
   * 4. Appends to In-App Notification Center History.
   */
  public notify(params: {
    category: AppNotificationCategory;
    title: string;
    body: string;
    soundType: NotificationSoundType;
    actionType?: AppNotification["actionType"];
    actionPayload?: AppNotification["actionPayload"];
    dedupKey?: string;
  }): AppNotification {
    const { category, title, body, soundType, actionType, actionPayload, dedupKey } = params;

    // Optional deduplication check in sessionStorage
    if (dedupKey && typeof window !== "undefined") {
      const hasFired = sessionStorage.getItem(`notif_fired_${dedupKey}`);
      if (hasFired) {
        // Return existing or dummy to avoid re-triggering
        return (
          this.notifications.find((n) => n.id === dedupKey) || {
            id: dedupKey,
            category,
            title,
            body,
            timestamp: new Date().toISOString(),
            read: false,
            soundType,
          }
        );
      }
      sessionStorage.setItem(`notif_fired_${dedupKey}`, "true");
    }

    const newNotif: AppNotification = {
      id: dedupKey || `notif_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      category,
      title,
      body,
      timestamp: new Date().toISOString(),
      read: false,
      soundType,
      actionType,
      actionPayload,
    };

    // 1. Play Sound
    try {
      audioNotificationService.playByType(soundType);
    } catch (e) {
      console.warn("Audio play error:", e);
    }

    // 2. Vibrate device (if supported on mobile)
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      try {
        if (soundType === "medication_overdue") {
          navigator.vibrate([300, 150, 300, 150, 400]);
        } else {
          navigator.vibrate([200, 100, 200]);
        }
      } catch {}
    }

    // 3. Browser Push Notification (Service Worker background first, fallback to standard Notification)
    if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
      const notifOptions: NotificationOptions = {
        body,
        icon: "/pwa-192x192.png",
        badge: "/pwa-192x192.png",
        tag: dedupKey || newNotif.id,
        requireInteraction: soundType === "medication_overdue" || soundType === "shift_ended_10min",
        data: {
          url: "/",
          actionType,
          actionPayload,
        },
      };

      if ("serviceWorker" in navigator && navigator.serviceWorker.ready) {
        navigator.serviceWorker.ready
          .then((registration) => {
            return registration.showNotification(title, notifOptions);
          })
          .catch(() => {
            try {
              const browserNotif = new Notification(title, notifOptions);
              browserNotif.onclick = () => {
                window.focus();
                browserNotif.close();
              };
            } catch {}
          });
      } else {
        try {
          const browserNotif = new Notification(title, notifOptions);
          browserNotif.onclick = () => {
            window.focus();
            browserNotif.close();
          };
        } catch (err) {
          console.warn("Failed to create browser Notification object:", err);
        }
      }
    }

    // 4. In-App Notification Center and Toasts
    this.notifications = [newNotif, ...this.notifications.slice(0, 59)];
    this.persistNotifications();
    this.notifySubscribers();

    // Trigger floating toast
    this.toastListeners.forEach((listener) => listener(newNotif));

    return newNotif;
  }

  public markAsRead(id: string) {
    this.notifications = this.notifications.map((n) => (n.id === id ? { ...n, read: true } : n));
    this.persistNotifications();
    this.notifySubscribers();
  }

  public markAllAsRead() {
    this.notifications = this.notifications.map((n) => ({ ...n, read: true }));
    this.persistNotifications();
    this.notifySubscribers();
  }

  public clearAll() {
    this.notifications = [];
    this.persistNotifications();
    this.notifySubscribers();
  }

  public getUnreadCount(): number {
    return this.notifications.filter((n) => !n.read).length;
  }

  public getAll(): AppNotification[] {
    return [...this.notifications];
  }
}

export const pushNotificationService = new PushNotificationService();
