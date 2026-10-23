// apps/mobile/src/screens/pos/PosOrderScreen.tsx
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import apiClient from '../../api/apiClient';
import posApiClient from '../../api/posApiClient';
import { API_ENDPOINTS } from '../../api/endpoints';
import { useInventoryStore } from '../../features/inventory/inventoryStore';
import { usePosStore } from '../../features/pos/posStore';
import { colors, spacing } from '../../lib/theme';

interface MenuItem {
  id: string;
  name: string;
  price: number;
  category?: string;
  isAvailable?: boolean;
  ingredients?: Record<string, number>;
}

interface OrderItem extends MenuItem {
  qty: number;
}

export default function PosOrderScreen(): React.JSX.Element {
  const { updateStockLocally } = useInventoryStore();
  const { submitOrder, isSubmitting } = usePosStore();

  const [menu, setMenu] = useState<MenuItem[]>([]);
  const [order, setOrder] = useState<OrderItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [orderType, setOrderType] = useState<'dine-in' | 'takeaway' | 'delivery'>(
    'dine-in',
  );
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [tableNumber, setTableNumber] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');

  useEffect(() => {
    const fetchMenu = async () => {
      try {
        setIsLoading(true);
        setError(null);
        // Prefer POS bootstrap (Go or Nest) — same path as web
        let raw: any[] = [];
        try {
          const boot = await posApiClient.get(API_ENDPOINTS.POS_BOOTSTRAP);
          raw =
            boot.data?.menus ||
            boot.data?.items ||
            [];
        } catch {
          /* fall through */
        }
        if (!Array.isArray(raw) || raw.length === 0) {
          const res = await apiClient.get(API_ENDPOINTS.MENU_LIST);
          raw = Array.isArray(res.data)
            ? res.data
            : res.data?.items || res.data?.menus || [];
        }
        // Normalize Nest/Go fields → mobile list model
        const normalized: MenuItem[] = (raw || [])
          .map((m: Record<string, unknown>) => {
            const id = String(
              m.menuId ?? m.menu_id ?? m.menuItemId ?? m.menu_item_id ?? m.id ?? '',
            ).trim();
            if (!id) return null;
            const price = Number(
              m.sellingPrice ?? m.selling_price ?? m.price ?? 0,
            );
            const name = String(m.name ?? id);
            const available =
              m.isAvailable !== false &&
              m.is_available !== false &&
              Number(m.maxPortions ?? m.availableQuantity ?? 1) > 0;
            return {
              id,
              name,
              price: Number.isFinite(price) ? price : 0,
              category: (m.category as string) || undefined,
              isAvailable: available,
            } as MenuItem;
          })
          .filter(Boolean) as MenuItem[];
        setMenu(normalized);
      } catch (err: any) {
        const msg =
          err?.response?.data?.message || err.message || 'Failed to load menu';
        setError(Array.isArray(msg) ? msg.join(', ') : msg);
      } finally {
        setIsLoading(false);
      }
    };
    fetchMenu();
  }, []);

  const addToOrder = (menuItem: MenuItem) => {
    setOrder((prev) => {
      const existing = prev.find((i) => i.id === menuItem.id);
      if (existing) {
        return prev.map((i) =>
          i.id === menuItem.id ? { ...i, qty: i.qty + 1 } : i,
        );
      }
      return [...prev, { ...menuItem, qty: 1 }];
    });
  };

  const increaseQty = (id: string) => {
    setOrder((prev) =>
      prev.map((item) => (item.id === id ? { ...item, qty: item.qty + 1 } : item)),
    );
  };

  const decreaseQty = (id: string) => {
    setOrder((prev) =>
      prev
        .map((item) =>
          item.id === id && item.qty > 1 ? { ...item, qty: item.qty - 1 } : item,
        )
        .filter((item) => item.qty > 0),
    );
  };

  const removeFromOrder = (id: string) => {
    setOrder((prev) => prev.filter((item) => item.id !== id));
  };

  const total = order.reduce((sum, item) => sum + item.price * item.qty, 0);

  const resetOrder = () => {
    setOrder([]);
    setCustomerName('');
    setCustomerPhone('');
    setTableNumber('');
    setDeliveryAddress('');
  };

  const handleCheckout = async () => {
    if (order.length === 0) {
      Alert.alert('Empty Order', 'Please add items first');
      return;
    }

    const result = await submitOrder({
      order_type: orderType,
      table_number: tableNumber || undefined,
      customer_name: customerName || undefined,
      customer_phone: customerPhone || undefined,
      delivery_address: deliveryAddress || undefined,
      items: order.map((item) => ({
        line_type: 'menu_item' as const,
        menu_item_id: item.id,
        menu_id: item.id,
        menu_name: item.name,
        quantity: item.qty,
        unit_price: item.price,
        selling_price: item.price,
      })),
      total_amount: total,
      tax_amount: total * 0.16,
      discount_amount: 0,
      payment_method: 'cash',
    });

    if (!result.success) {
      Alert.alert('Checkout Failed', result.message);
      return;
    }

    // Optimistic local stock update only when online success
    if (!result.offline) {
      order.forEach((item) => {
        if (item.ingredients) {
          Object.entries(item.ingredients).forEach(([ingredient, qtyPer]) => {
            if (ingredient === 'dough') updateStockLocally('ST300', -qtyPer * item.qty);
            if (ingredient === 'cheese') updateStockLocally('A200', -qtyPer * item.qty);
          });
        }
      });
    }

    Alert.alert(
      result.offline ? 'Saved Offline' : 'Order Placed',
      `${result.message}\nTotal: KES ${total.toFixed(0)}`,
    );
    resetOrder();
  };

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Loading menu...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.titleText}>POS - New Order</Text>

      <View style={styles.orderTypeContainer}>
        {(['dine-in', 'takeaway', 'delivery'] as const).map((type) => (
          <TouchableOpacity
            key={type}
            style={[
              styles.orderTypeButton,
              orderType === type && styles.orderTypeButtonActive,
            ]}
            onPress={() => setOrderType(type)}
          >
            <Text
              style={[
                styles.orderTypeText,
                orderType === type && styles.orderTypeTextActive,
              ]}
            >
              {type.replace('-', ' ').toUpperCase()}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.customerSection}>
        <TextInput
          style={styles.input}
          placeholder="Customer Name"
          value={customerName}
          onChangeText={setCustomerName}
        />
        <TextInput
          style={styles.input}
          placeholder="Phone Number"
          value={customerPhone}
          onChangeText={setCustomerPhone}
          keyboardType="phone-pad"
        />
        {orderType === 'dine-in' && (
          <TextInput
            style={styles.input}
            placeholder="Table Number"
            value={tableNumber}
            onChangeText={setTableNumber}
          />
        )}
        {orderType === 'delivery' && (
          <TextInput
            style={styles.input}
            placeholder="Delivery Address"
            value={deliveryAddress}
            onChangeText={setDeliveryAddress}
          />
        )}
      </View>

      <FlatList
        data={menu}
        keyExtractor={(item) => item.id}
        style={styles.menuList}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.menuItem} onPress={() => addToOrder(item)}>
            <Text style={styles.menuName}>{item.name}</Text>
            <Text style={styles.menuPrice}>KES {item.price.toFixed(0)}</Text>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <Text style={styles.emptyText}>No menu items available</Text>
        }
      />

      <View style={styles.orderSummary}>
        <Text style={styles.subtitleText}>Current Order ({order.length})</Text>
        <FlatList
          data={order}
          keyExtractor={(item) => item.id}
          style={styles.orderList}
          renderItem={({ item }) => (
            <View style={styles.orderItem}>
              <Text style={styles.orderName}>
                {item.name} × {item.qty}
              </Text>
              <View style={styles.quantityControls}>
                <TouchableOpacity onPress={() => decreaseQty(item.id)} style={styles.qtyButton}>
                  <Text>-</Text>
                </TouchableOpacity>
                <Text>{item.qty}</Text>
                <TouchableOpacity onPress={() => increaseQty(item.id)} style={styles.qtyButton}>
                  <Text>+</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => removeFromOrder(item.id)}>
                  <Text style={styles.removeText}>✕</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
          ListEmptyComponent={
            <Text style={styles.emptyOrder}>Tap menu items to start</Text>
          }
        />

        {order.length > 0 && (
          <Text style={styles.totalAmount}>KES {total.toFixed(0)}</Text>
        )}

        <TouchableOpacity
          style={[
            styles.checkoutButton,
            (order.length === 0 || isSubmitting) && styles.checkoutDisabled,
          ]}
          onPress={handleCheckout}
          disabled={order.length === 0 || isSubmitting}
        >
          {isSubmitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.checkoutText}>
              Checkout · KES {total.toFixed(0)}
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: spacing.md },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: spacing.md, color: colors.textSecondary },
  errorText: { color: colors.danger, textAlign: 'center' },
  titleText: { fontSize: 22, fontWeight: '700', marginBottom: spacing.md, color: colors.textPrimary },
  subtitleText: { fontSize: 16, fontWeight: '600', color: colors.textPrimary },
  orderTypeContainer: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  orderTypeButton: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: 12,
    backgroundColor: colors.surface,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  orderTypeButtonActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  orderTypeText: { fontWeight: '600', color: colors.textPrimary, fontSize: 12 },
  orderTypeTextActive: { color: '#fff' },
  customerSection: { marginBottom: spacing.md },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: spacing.sm,
    marginBottom: spacing.sm,
    color: colors.textPrimary,
  },
  menuList: { flex: 1 },
  menuItem: {
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: 12,
    marginBottom: spacing.sm,
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: colors.border,
  },
  menuName: { fontWeight: '600', color: colors.textPrimary },
  menuPrice: { color: colors.primary, fontWeight: '700' },
  orderSummary: {
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    maxHeight: '45%',
  },
  orderList: { maxHeight: 180 },
  orderItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  orderName: { flex: 1, color: colors.textPrimary },
  quantityControls: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  qtyButton: {
    width: 28,
    height: 28,
    backgroundColor: colors.border,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeText: { color: colors.danger, fontWeight: '700' },
  totalAmount: {
    marginTop: spacing.sm,
    fontSize: 20,
    fontWeight: '700',
    color: colors.success,
    textAlign: 'right',
  },
  checkoutButton: {
    backgroundColor: colors.success,
    paddingVertical: spacing.md,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: spacing.md,
  },
  checkoutDisabled: { opacity: 0.6 },
  checkoutText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  emptyOrder: { textAlign: 'center', color: colors.textSecondary, padding: spacing.md },
  emptyText: { textAlign: 'center', color: colors.textSecondary, padding: spacing.lg },
});