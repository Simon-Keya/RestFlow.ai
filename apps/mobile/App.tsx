// apps/mobile/App.tsx
import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import RootNavigator from './src/navigation/RootNavigator';
import { useOfflineSync } from './src/features/offline/useOfflineSync';
import { useAuthStore } from './src/features/auth/authStore';
import { colors } from './src/lib/theme';

export default function App() {
  const bootstrap = useAuthStore((s) => s.bootstrap);
  const isHydrated = useAuthStore((s) => s.isHydrated);

  useOfflineSync();

  useEffect(() => {
    bootstrap();
  }, [bootstrap]);

  if (!isHydrated) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: colors?.background ?? '#fff',
        }}
      >
        <ActivityIndicator size="large" color={colors?.primary ?? '#2563eb'} />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <RootNavigator />
        <StatusBar style="auto" />
      </NavigationContainer>
    </SafeAreaProvider>
  );
}