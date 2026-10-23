// apps/mobile/src/navigation/linking.ts

import { LinkingOptions } from '@react-navigation/native';
import * as Linking from 'expo-linking';
import type { RootStackParamList } from './types';

const prefix = Linking.createURL('/');

const linking: LinkingOptions<RootStackParamList> = {
  prefixes: [
    prefix,
    'restflow://',
    'https://restflow-mobile.netlify.app',
    'https://restflow-web.netlify.app',
  ],

  config: {
    screens: {
      Login: 'login',
      Register: 'register',

      Payment: 'payment',
      PaymentSuccess: 'payment/success',

      StockOverview: 'stock',
      Receive: {
        path: 'receive',
        parse: {
          scannedItemId: (value: string) => value,
        },
      },

      PosOrder: 'pos',
      BarcodeScanner: 'scan',
      NotificationSettings: 'notifications',

      Production: 'production',
      ProductionHistory: 'production/history',

      RecipeList: 'recipes',
      CreateRecipe: 'recipes/new',

      FinishedGoods: 'finished-goods',

      MenuList: 'menu',
      CreateMenu: 'menu/new',

      RefillRequest: 'refill/request',
      RefillApproval: 'refill/approval',

      RecordWaste: 'waste/record',
      ClosingStock: 'closing-stock',
      Profile: 'profile',
    },
  },

  subscribe(listener) {
    const subscription = Linking.addEventListener(
      'url',
      (event: { url: string }) => {
        listener(event.url);
      },
    );

    void Linking.getInitialURL().then((url: string | null) => {
      if (url) {
        listener(url);
      }
    });

    return () => {
      subscription.remove();
    };
  },
};

export default linking;