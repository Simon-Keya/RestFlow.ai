// apps/mobile/src/types/navigation.ts
import type {
  NativeStackNavigationProp,
  NativeStackScreenProps,
} from '@react-navigation/native-stack';

export type RootStackParamList = {
  // Auth
  Login: undefined;
  Register: undefined;

  // Payment
  Payment: {
    order_id: string;
    amount: number;
  };
  PaymentSuccess: {
    order_id: string;
  };

  // Stock / inventory
  StockOverview: undefined;
  Receive: { scannedItemId?: string } | undefined;

  // POS
  PosOrder: undefined;

  // Scanner
  BarcodeScanner: undefined;

  // Notifications
  NotificationSettings: undefined;

  // Production
  Production: undefined;
  ProductionHistory: undefined;

  // Recipes
  RecipeList: undefined;
  CreateRecipe: undefined;
  // RecipeDetail: { recipeId: string };

  // Finished goods
  FinishedGoods: undefined;

  // Menu
  MenuList: undefined;
  CreateMenu: undefined;

  // Refill
  RefillRequest: undefined;
  RefillApproval: undefined;

  // Waste (required by RootNavigator)
  RecordWaste: undefined;

  // Profile
  Profile: undefined;
  
  // Closing stock
  ClosingStock: undefined;
};

export type ScreenProps<T extends keyof RootStackParamList> =
  NativeStackScreenProps<RootStackParamList, T>;

export type RootNavigationProp =
  NativeStackNavigationProp<RootStackParamList>;