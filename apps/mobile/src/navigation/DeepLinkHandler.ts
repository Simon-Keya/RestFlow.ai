// apps/mobile/src/navigation/DeepLinkHandler.tsx
import React, { useEffect } from 'react';
import * as Linking from 'expo-linking';
import { useNavigation } from '@react-navigation/native';

import type { RootNavigationProp } from '../types/navigation';

function asSingleString(
  value: string | string[] | undefined,
): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

export default function DeepLinkHandler() {
  const navigation = useNavigation<RootNavigationProp>();

  useEffect(() => {
    const handleDeepLink = (event: { url: string }) => {
      const { path, queryParams } = Linking.parse(event.url);
      const normalizedPath = (path || '').toLowerCase().replace(/^\//, '');

      if (
        normalizedPath === 'recipes/new' ||
        normalizedPath.endsWith('recipes/new')
      ) {
        navigation.navigate('CreateRecipe');
        return;
      }

      if (
        normalizedPath === 'recipes' ||
        normalizedPath.includes('recipe')
      ) {
        navigation.navigate('RecipeList');
        return;
      }

      if (normalizedPath.includes('closing-stock')) {
        navigation.navigate('ClosingStock');
        return;
      }

      if (normalizedPath.includes('notification')) {
        navigation.navigate('NotificationSettings');
        return;
      }

      if (normalizedPath.includes('receive')) {
        const scannedItemId = asSingleString(queryParams?.scannedItemId);
        navigation.navigate(
          'Receive',
          scannedItemId ? { scannedItemId } : undefined,
        );
        return;
      }

      if (normalizedPath.includes('pos') || normalizedPath.includes('order')) {
        navigation.navigate('PosOrder');
        return;
      }

      if (normalizedPath.includes('waste')) {
        navigation.navigate('RecordWaste');
        return;
      }

      if (
        normalizedPath.includes('stock') ||
        normalizedPath.includes('inventory')
      ) {
        navigation.navigate('StockOverview');
        return;
      }

      if (normalizedPath.includes('production/history')) {
        navigation.navigate('ProductionHistory');
        return;
      }

      if (normalizedPath.includes('production')) {
        navigation.navigate('Production');
        return;
      }

      if (normalizedPath.includes('refill/approval')) {
        navigation.navigate('RefillApproval');
        return;
      }

      if (normalizedPath.includes('refill')) {
        navigation.navigate('RefillRequest');
        return;
      }

      if (normalizedPath.includes('menu/new')) {
        navigation.navigate('CreateMenu');
        return;
      }

      if (normalizedPath.includes('menu')) {
        navigation.navigate('MenuList');
        return;
      }

      if (normalizedPath.includes('profile')) {
        navigation.navigate('Profile');
      }
    };

    const subscription = Linking.addEventListener('url', handleDeepLink);

    void Linking.getInitialURL().then((url) => {
      if (url) handleDeepLink({ url });
    });

    return () => {
      subscription.remove();
    };
  }, [navigation]);

  return null;
}
