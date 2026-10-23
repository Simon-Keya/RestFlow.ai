// apps/mobile/src/screens/payment/PaymentSuccessScreen.tsx
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';

import { colors, spacing, typography } from '../../lib/theme';
import type {
  RootNavigationProp,
  RootStackParamList,
} from '../../types/navigation';

type PaymentSuccessRoute = RouteProp<RootStackParamList, 'PaymentSuccess'>;

export default function PaymentSuccessScreen() {
  const navigation = useNavigation<RootNavigationProp>();
  const route = useRoute<PaymentSuccessRoute>();
  const { order_id } = route.params;

  return (
    <View style={styles.container}>
      <Text style={styles.successIcon}>✅</Text>
      <Text style={typography.title}>Payment Successful!</Text>
      <Text style={styles.orderId}>Order #{order_id}</Text>

      <TouchableOpacity
        style={styles.button}
        onPress={() => navigation.navigate('StockOverview')}
      >
        <Text style={styles.buttonText}>Back to Home</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
    padding: spacing.lg,
  },
  successIcon: { fontSize: 80, marginBottom: spacing.lg },
  orderId: {
    ...typography.body,
    color: colors.textSecondary,
    marginTop: spacing.md,
  },
  button: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: 12,
    marginTop: spacing.xl,
  },
  buttonText: { color: '#fff', fontWeight: '600', fontSize: 18 },
});