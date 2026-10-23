// apps/mobile/src/screens/refill/RefillApprovalScreen.tsx
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import apiClient from '../../api/apiClient';
import { getSocket } from '../../lib/socket';
import { SOCKET_NAMESPACES } from '../../lib/constants';
import { colors, spacing, typography } from '../../lib/theme';
import type { RootStackParamList } from '../../navigation/types';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

type RefillRequest = {
  id: string;
  request_id?: string;
  item_id?: string;
  item: string;
  item_name?: string;
  requested: number;
  requested_qty?: number;
  unit: string;
  units?: string;
  requester: string;
  status?: string;
};

function normalizeRequest(raw: any): RefillRequest {
  const id = String(raw.id || raw.request_id || '');
  return {
    id,
    request_id: id,
    item_id: raw.item_id,
    item: raw.item || raw.item_name || 'Unknown item',
    item_name: raw.item_name || raw.item,
    requested: Number(raw.requested ?? raw.requested_qty ?? 0),
    requested_qty: Number(raw.requested ?? raw.requested_qty ?? 0),
    unit: raw.unit || raw.units || 'pcs',
    units: raw.units || raw.unit || 'pcs',
    requester: raw.requester || raw.requested_by || raw.actor_name || 'Kitchen',
    status: raw.status || 'pending',
  };
}

export default function RefillApprovalScreen() {
  const navigation = useNavigation<NavigationProp>();

  const [requests, setRequests] = useState<RefillRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const upsertRequest = useCallback((incoming: any) => {
    const item = normalizeRequest(incoming);
    if (!item.id) return;

    setRequests((prev) => {
      const without = prev.filter((r) => r.id !== item.id);
      if (item.status && item.status !== 'pending') {
        return without;
      }
      return [item, ...without];
    });
  }, []);

  const removeRequest = useCallback((id: string) => {
    setRequests((prev) => prev.filter((r) => r.id !== id));
  }, []);

  const fetchPending = useCallback(async () => {
    setError(null);
    try {
      // Prefer a dedicated list endpoint if you have one
      const res = await apiClient.get('/refill/pending').catch(() => null);

      if (res?.data) {
        const list = Array.isArray(res.data)
          ? res.data
          : res.data.items || res.data.requests || [];
        setRequests(list.map(normalizeRequest));
      }
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Failed to load');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Real-time socket — only after mount, never at module scope
  useEffect(() => {
    const socket = getSocket(SOCKET_NAMESPACES.REFILL);

    const onConnect = () => setConnected(true);
    const onDisconnect = () => setConnected(false);

    const onRequested = (payload: any) => {
      upsertRequest({ ...payload, status: 'pending' });
    };

    const onIssued = (payload: any) => {
      const id = payload?.request_id || payload?.id;
      if (id) removeRequest(String(id));
    };

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('refill_requested', onRequested);
    socket.on('refill_issued', onIssued);

    if (socket.connected) setConnected(true);

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('refill_requested', onRequested);
      socket.off('refill_issued', onIssued);
      // do NOT disconnect the shared socket here — other screens may use it
    };
  }, [upsertRequest, removeRequest]);

  useEffect(() => {
    fetchPending();
  }, [fetchPending]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchPending();
  };

  const handleApprove = (item: RefillRequest) => {
    Alert.alert(
      'Approve Refill',
      `Approve ${item.requested} ${item.unit} of ${item.item}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Approve',
          onPress: async () => {
            try {
              // API is source of truth; gateway will broadcast refill_issued
              await apiClient.post('/refill/issue', {
                request_id: item.id,
                approved_qty: item.requested,
                issued_qty: item.requested,
                batch_number: `BATCH-${item.id}`,
                expiry_date: new Date().toISOString().slice(0, 10),
                lost_weight: 0,
              });

              removeRequest(item.id);
              Alert.alert('Approved', `Request ${item.id} approved.`);
            } catch (err: any) {
              const message =
                err?.response?.data?.message ||
                err?.message ||
                'Approve failed';
              Alert.alert('Error', String(message));
            }
          },
        },
      ],
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[typography.body, { marginTop: spacing.md }]}>
          Loading refill requests...
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={typography.title}>Refill Approvals</Text>
        <Text
          style={[
            styles.connection,
            { color: connected ? colors.success : colors.textSecondary },
          ]}
        >
          {connected ? '● Live' : '○ Offline'}
        </Text>
      </View>

      {error ? (
        <TouchableOpacity onPress={fetchPending}>
          <Text style={styles.errorText}>{error} — tap to retry</Text>
        </TouchableOpacity>
      ) : null}

      <FlatList
        data={requests}
        keyExtractor={(item) => item.id}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.info}>
              <Text style={styles.itemName}>{item.item}</Text>
              <Text style={typography.small}>
                {item.requested} {item.unit} • {item.requester}
              </Text>
              <Text style={styles.idText}>{item.id}</Text>
            </View>

            <TouchableOpacity
              style={styles.approveButton}
              onPress={() => handleApprove(item)}
            >
              <Text style={styles.approveText}>Approve</Text>
            </TouchableOpacity>
          </View>
        )}
        ListEmptyComponent={
          <Text style={styles.empty}>No pending refill requests.</Text>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    padding: spacing.lg,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  connection: {
    fontSize: 13,
    fontWeight: '600',
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  info: {
    flex: 1,
    marginRight: spacing.md,
  },
  itemName: {
    ...typography.body,
    fontWeight: '600',
    marginBottom: 2,
  },
  idText: {
    ...typography.small,
    color: colors.textSecondary,
    marginTop: 2,
  },
  approveButton: {
    backgroundColor: colors.success,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: 8,
  },
  approveText: {
    color: '#fff',
    fontWeight: '600',
  },
  empty: {
    textAlign: 'center',
    marginTop: 50,
    color: colors.textSecondary,
  },
  errorText: {
    color: colors.danger,
    marginBottom: spacing.md,
    textAlign: 'center',
  },
});