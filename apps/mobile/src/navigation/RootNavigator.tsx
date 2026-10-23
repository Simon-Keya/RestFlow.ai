// apps/mobile/src/navigation/RootNavigator.tsx
import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ActivityIndicator, Text, View } from 'react-native';

import { useAuthStore } from '../features/auth/authStore';
import { colors } from '../lib/theme';
import type { RootStackParamList } from './types';

import LoginScreen from '../screens/auth/LoginScreen';
import RegisterScreen from '../screens/auth/RegisterScreen';
import StockOverviewScreen from '../screens/inventory/StockOverviewScreen';
import ReceiveGoodsScreen from '../screens/inventory/ReceiveGoodsScreen';
import RefillRequestScreen from '../screens/refill/RefillRequestScreen';
import RefillApprovalScreen from '../screens/refill/RefillApprovalScreen';
import ProductionScreen from '../screens/production/ProductionScreen';
import ProductionHistoryScreen from '../screens/production/ProductionHistoryScreen';
import RecipeListScreen from '../screens/recipe/RecipeListScreen';
import CreateRecipeScreen from '../screens/recipe/CreateRecipeScreen';
import FinishedGoodsScreen from '../screens/finished-goods/FinishedGoodsScreen';
import MenuListScreen from '../screens/menu/MenuListScreen';
import CreateMenuScreen from '../screens/menu/CreateMenuScreen';
import PosOrderScreen from '../screens/pos/PosOrderScreen';
import BarcodeScannerScreen from '../screens/scanning/BarcodeScannerScreen';
import RecordWasteScreen from '../screens/waste/RecordWasteScreen';
import ClosingStockScreen from '../screens/kitchen/ClosingStockScreen';
import NotificationSettings from '../screens/notifications/NotificationSettings';
import ProfileScreen from '../screens/profile/ProfileScreen';
import LogoutButton from '../components/common/LogoutButton';

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function RootNavigator() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isHydrated = useAuthStore((s) => s.isHydrated);

  // Wait for auth rehydration from storage (not login button spinner)
  if (!isHydrated) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: colors.background,
        }}
      >
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={{ marginTop: 12, color: colors.textSecondary }}>
          Loading...
        </Text>
      </View>
    );
  }

  return (
    <Stack.Navigator
      initialRouteName={isAuthenticated ? 'StockOverview' : 'Login'}
      screenOptions={{
        headerStyle: { backgroundColor: colors.primary },
        headerTintColor: '#fff',
        headerTitleStyle: { fontWeight: 'bold' },
        headerRight: () => (isAuthenticated ? <LogoutButton /> : null),
        // animation can reduce some web transition quirks; optional
        animation: 'default',
      }}
    >
      <Stack.Screen
        name="Login"
        component={LoginScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="Register"
        component={RegisterScreen}
        options={{ title: 'Create Account' }}
      />

      <Stack.Screen
        name="StockOverview"
        component={StockOverviewScreen}
        options={{ title: 'Stock Overview' }}
      />
      <Stack.Screen
        name="Receive"
        component={ReceiveGoodsScreen}
        options={{ title: 'Receive Goods (GRN)' }}
      />

      <Stack.Screen
        name="RefillRequest"
        component={RefillRequestScreen}
        options={{ title: 'Request Refill' }}
      />
      <Stack.Screen
        name="RefillApproval"
        component={RefillApprovalScreen}
        options={{ title: 'Refill Approvals' }}
      />

      <Stack.Screen
        name="Production"
        component={ProductionScreen}
        options={{ title: 'Production' }}
      />
      <Stack.Screen
        name="ProductionHistory"
        component={ProductionHistoryScreen}
        options={{ title: 'Production History' }}
      />

      <Stack.Screen
        name="RecipeList"
        component={RecipeListScreen}
        options={{ title: 'Recipes' }}
      />
      <Stack.Screen
        name="CreateRecipe"
        component={CreateRecipeScreen}
        options={{ title: 'Create Recipe' }}
      />

      <Stack.Screen
        name="FinishedGoods"
        component={FinishedGoodsScreen}
        options={{ title: 'Finished Goods' }}
      />

      <Stack.Screen
        name="MenuList"
        component={MenuListScreen}
        options={{ title: 'Menu Items' }}
      />
      <Stack.Screen
        name="CreateMenu"
        component={CreateMenuScreen}
        options={{ title: 'Create Menu Item' }}
      />

      <Stack.Screen
        name="PosOrder"
        component={PosOrderScreen}
        options={{ title: 'POS - New Order' }}
      />
      <Stack.Screen
        name="BarcodeScanner"
        component={BarcodeScannerScreen}
        options={{ title: 'Scan Barcode' }}
      />

      <Stack.Screen
        name="RecordWaste"
        component={RecordWasteScreen}
        options={{ title: 'Record Waste' }}
      />

      <Stack.Screen
        name="ClosingStock"
        component={ClosingStockScreen}
        options={{ title: 'Closing Stock Count' }}
      />
      <Stack.Screen
        name="Profile"
        component={ProfileScreen}
        options={{ title: 'My Profile' }}
      />
    </Stack.Navigator>
  );
}