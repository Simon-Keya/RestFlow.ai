// apps/mobile/src/hooks/useNotificationBadge.ts
import { useEffect } from 'react';
import * as Notifications from 'expo-notifications';
import { useNotificationsStore } from '../features/notifications/notificationsStore';

export const useNotificationBadge = () => {
  const { unreadCount } = useNotificationsStore();

  useEffect(() => {
    const updateBadge = async () => {
      try {
        await Notifications.setBadgeCountAsync(unreadCount);
      } catch (error) {
        console.error('Badge update failed:', error);
      }
    };

    updateBadge();
  }, [unreadCount]);

  // Clear badge when app becomes active
  useEffect(() => {
    const subscription = Notifications.addNotificationReceivedListener(() => {
      // Optional: reset badge on app focus
    });

    return () => subscription.remove();
  }, []);
};