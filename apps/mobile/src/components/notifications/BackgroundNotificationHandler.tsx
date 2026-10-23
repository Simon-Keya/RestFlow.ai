// apps/mobile/src/components/notifications/BackgroundNotificationHandler.tsx
import React, { useEffect } from 'react';
import * as Notifications from 'expo-notifications';
import type { NotificationResponse } from 'expo-notifications';
import { useNavigation } from '@react-navigation/native';

import { useNotificationsStore } from '../../features/notifications/notificationsStore';
import type { RootNavigationProp } from '../../types/navigation';

type NotificationData = {
  type?: string;
  priority?: string;
  reference_id?: string;
};

type StoreType = 'info' | 'warning' | 'critical' | 'success';
type StorePriority = 'low' | 'medium' | 'high';

function mapType(raw?: string): StoreType {
  switch (raw) {
    case 'waste':
      return 'critical';
    case 'order':
      return 'info';
    case 'stock':
      return 'warning';
    case 'success':
      return 'success';
    case 'warning':
      return 'warning';
    case 'critical':
      return 'critical';
    default:
      return 'info';
  }
}

function mapPriority(raw?: string): StorePriority {
  if (raw === 'critical' || raw === 'high') return 'high';
  if (raw === 'low') return 'low';
  return 'medium';
}

export default function BackgroundNotificationHandler() {
  const addNotification = useNotificationsStore((s) => s.addNotification);
  const navigation = useNavigation<RootNavigationProp>();

  useEffect(() => {
    const subscription =
      Notifications.addNotificationResponseReceivedListener(
        (response: NotificationResponse) => {
          const content = response.notification.request.content;
          const data = (content.data || {}) as NotificationData;

          addNotification({
            title: content.title || '',
            message: content.body || '',
            type: mapType(data.type),
            priority: mapPriority(data.priority),
            reference_id: data.reference_id,
          });

          if (data.reference_id) {
            if (data.type === 'waste') {
              navigation.navigate('StockOverview');
            } else if (data.type === 'order') {
              navigation.navigate('PosOrder');
            } else if (data.type === 'stock') {
              navigation.navigate('StockOverview');
            }
          }
        },
      );

    return () => {
      subscription.remove();
    };
  }, [addNotification, navigation]);

  return null;
}