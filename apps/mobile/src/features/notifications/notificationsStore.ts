// apps/mobile/src/features/notifications/notificationsStore.ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export type Notification = {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'warning' | 'critical' | 'success';
  priority: 'low' | 'medium' | 'high';
  read: boolean;
  reference_id?: string;
  timestamp: string;
};

interface NotificationsState {
  notifications: Notification[];
  unreadCount: number;

  addNotification: (notif: Omit<Notification, 'id' | 'timestamp' | 'read'>) => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  clearNotifications: () => void;
}

export const useNotificationsStore = create<NotificationsState>()(
  persist(
    (set, get) => ({
      notifications: [],
      unreadCount: 0,

      addNotification: (notif) => {
        const newNotif: Notification = {
          ...notif,
          id: `notif-${Date.now()}`,
          timestamp: new Date().toISOString(),
          read: false,
        };

        set((state) => ({
          notifications: [newNotif, ...state.notifications],
          unreadCount: state.unreadCount + 1,
        }));
      },

      markAsRead: (id) => {
        set((state) => ({
          notifications: state.notifications.map((n) =>
            n.id === id ? { ...n, read: true } : n
          ),
          unreadCount: Math.max(0, state.unreadCount - 1),
        }));
      },

      markAllAsRead: () => {
        set((state) => ({
          notifications: state.notifications.map((n) => ({ ...n, read: true })),
          unreadCount: 0,
        }));
      },

      clearNotifications: () => set({ notifications: [], unreadCount: 0 }),
    }),
    {
      name: 'restflow-notifications',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);