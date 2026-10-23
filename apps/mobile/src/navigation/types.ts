// apps/mobile/src/navigation/types.ts
import type {
  NativeStackNavigationProp,
  NativeStackScreenProps,
} from '@react-navigation/native-stack';

export type RootStackParamList = {
  Login: undefined;
  Register: undefined;

  Payment: {
    order_id: string;
    amount: number;
  };
  PaymentSuccess: {
    order_id: string;
  };

  StockOverview: undefined;
  Receive: { scannedItemId?: string } | undefined;

  RefillRequest: undefined;
  RefillApproval: undefined;

  Production: undefined;
  ProductionHistory: undefined;

  RecipeList: undefined;
  CreateRecipe: undefined;

  FinishedGoods: undefined;

  MenuList: undefined;
  CreateMenu: undefined;

  PosOrder: undefined;
  BarcodeScanner: undefined;

  RecordWaste: undefined;

  NotificationSettings: undefined;
  Profile: undefined;

  ClosingStock: undefined;
};

export type ScreenProps<T extends keyof RootStackParamList> =
  NativeStackScreenProps<RootStackParamList, T>;

export type RootNavigationProp =
  NativeStackNavigationProp<RootStackParamList>;