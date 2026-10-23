// apps/mobile/src/components/notifications/PushNotificationHandler.tsx
import React, { useEffect } from 'react';
import * as Notifications from 'expo-notifications';
import type { Notification } from 'expo-notifications';

import { useNotificationsStore } from '../../features/notifications/notificationsStore';

type PayloadData = {
  type?: string;
  priority?: string;
  reference_id?: string;
};

type StoreType = 'info' | 'warning' | 'critical' | 'success';
type StorePriority = 'low' | 'medium' | 'high';

function mapType(raw?: string): StoreType {
  switch (raw) {
    case 'waste':
    case 'critical':
      return 'critical';
    case 'stock':
    case 'warning':
      return 'warning';
    case 'success':
      return 'success';
    default:
      return 'info';
  }
}

function mapPriority(raw?: string): StorePriority {
  if (raw === 'critical' || raw === 'high') return 'high';
  if (raw === 'low') return 'low';
  return 'medium';
}

// Expo Notifications v55 requires shouldShowBanner + shouldShowList
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export default function PushNotificationHandler() {
  const addNotification = useNotificationsStore((s) => s.addNotification);

  useEffect(() => {
    const requestPermissions = async () => {
      const { status } = await Notifications.requestPermissionsAsync();
      if (status !== 'granted') {
        console.warn('Push notifications permission denied');
      }
    };

    void requestPermissions();

    const receivedSub = Notifications.addNotificationReceivedListener(
      (notification: Notification) => {
        const content = notification.request.content;
        // data can be undefined — never read properties off it directly
        const data = (content.data ?? {}) as PayloadData;

        addNotification({
          title: content.title || 'New Notification',
          message: content.body || '',
          type: mapType(data.type),
          priority: mapPriority(data.priority),
          reference_id:
            typeof data.reference_id === 'string'
              ? data.reference_id
              : undefined,
        });

        void Notifications.setBadgeCountAsync(1);
      },
    );

    const responseSub =
      Notifications.addNotificationResponseReceivedListener((response) => {
        const data = (response.notification.request.content.data ??
          {}) as PayloadData;
        console.log('User tapped notification:', data);
      });

    return () => {
      receivedSub.remove();
      responseSub.remove();
    };
  }, [addNotification]);

  return null;
}