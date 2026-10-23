// apps/mobile/src/screens/inventory/StockOverviewScreen.tsx
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  RefreshControl,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';

import { useRole } from '../../hooks/useRole';
import {
  STOCK_PAGE_SIZE,
  useInventoryStore,
} from '../../features/inventory/inventoryStore';
import { useInventoryRealtime } from '../../hooks/useInventoryRealtime';
import { colors, spacing, typography } from '../../lib/theme';
import type { StockItem } from '../../types/api';
import type { RootNavigationProp } from '../../types/navigation';

function formatUnit(unit?: string | null): string {
  if (!unit || !String(unit).trim()) return 'units';
  const u = String(unit).trim();
  if (/^\d+(\.\d+)?$/.test(u)) return 'units';
  return u;
}

function formatQty(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return '0';
  return Number.isInteger(n) ? String(n) : n.toFixed(2);
}

function formatKes(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return '—';
  return `KES ${n.toLocaleString('en-KE', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;
}

function liveDaysToExpiry(item: StockItem): number | null {
  const next = item.next_expiry_date ?? item.closest_expiry_date;
  if (next != null && next !== '') {
    const end = new Date(next);
    if (!Number.isNaN(end.getTime())) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      end.setHours(0, 0, 0, 0);
      return Math.round(
        (end.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
      );
    }
  }

  const days = item.days_to_expiry_min;
  if (days === null || days === undefined || Number.isNaN(Number(days))) {
    return null;
  }
  return Number(days);
}

type Urgency = 'expired' | 'critical' | 'low' | 'ok';

function getUrgency(item: StockItem): Urgency {
  const days = liveDaysToExpiry(item);
  const stock = item.available_stock ?? 0;
  const reorder = item.reorder_point ?? 10;

  if (days !== null && days <= 0) return 'expired';
  if (days !== null && days <= 7) return 'critical';
  if (stock <= 0 || stock <= reorder) return 'low';
  return 'ok';
}

function sortStock(items: StockItem[]): StockItem[] {
  const rank: Record<Urgency, number> = {
    expired: 0,
    critical: 1,
    low: 2,
    ok: 3,
  };
  return [...items].sort((a, b) => {
    const d = rank[getUrgency(a)] - rank[getUrgency(b)];
    if (d !== 0) return d;
    return (a.name || '').localeCompare(b.name || '');
  });
}

export default function StockOverviewScreen() {
  const navigation = useNavigation<RootNavigationProp>();
  const { isKitchen, isPos, isManager } = useRole();

  const {
    stock,
    page,
    total,
    totalPages,
    isLoading,
    error,
    fetchStock,
    nextPage,
    prevPage,
  } = useInventoryStore();

  const [refreshing, setRefreshing] = useState(false);

  useInventoryRealtime();

  useEffect(() => {
    fetchStock(1);
  }, [fetchStock]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await fetchStock(page);
    } finally {
      setRefreshing(false);
    }
  }, [fetchStock, page]);

  const sorted = useMemo(() => sortStock(stock), [stock]);

  const summary = useMemo(() => {
    const low = stock.filter(
      (i) => getUrgency(i) === 'low' || getUrgency(i) === 'expired',
    ).length;
    const expiring = stock.filter((i) => {
      const d = liveDaysToExpiry(i);
      return d !== null && d > 0 && d <= 7;
    }).length;
    const value = stock.reduce((s, i) => s + (i.total_value || 0), 0);
    return {
      totalItems: total,
      pageCount: stock.length,
      low,
      expiring,
      value,
    };
  }, [stock, total]);

  const renderItem = ({ item }: { item: StockItem }) => {
    const urgency = getUrgency(item);
    const days = liveDaysToExpiry(item);
    const unit = formatUnit(item.unit);
    const qty = formatQty(item.available_stock);

    let expiryLabel = 'No expiry';
    let badgeLabel: string | null = null;
    let badgeBg: string = colors.border;
    let badgeText: string = colors.textSecondary;
    let leftBorder: string = colors.border;

    if (urgency === 'expired') {
      expiryLabel = 'EXPIRED';
      badgeLabel = 'Expired';
      badgeBg = '#F8D7DA';
      badgeText = colors.danger;
      leftBorder = colors.danger;
    } else if (urgency === 'critical') {
      expiryLabel = `Expires in ${days} day${days === 1 ? '' : 's'}`;
      badgeLabel = 'Expiring';
      badgeBg = '#FFF3CD';
      badgeText = colors.warning;
      leftBorder = colors.warning;
    } else if (urgency === 'low') {
      expiryLabel = days !== null ? `${days} days` : 'No expiry';
      badgeLabel =
        (item.available_stock ?? 0) <= 0 ? 'Out of stock' : 'Low stock';
      badgeBg = '#FFE5CC';
      badgeText = colors.warning;
      leftBorder = colors.warning;
    } else {
      expiryLabel = days !== null ? `${days} days left` : 'No expiry';
      leftBorder = colors.success;
    }

    return (
      <View style={[styles.card, { borderLeftColor: leftBorder }]}>
        <View style={styles.cardTop}>
          <View style={styles.cardTitles}>
            <Text style={styles.itemName} numberOfLines={1}>
              {item.name || item.id}
            </Text>
            <Text style={styles.sku}>
              SKU: {item.id}
              {item.category ? ` · ${item.category}` : ''}
            </Text>
          </View>
          {badgeLabel ? (
            <View style={[styles.badge, { backgroundColor: badgeBg }]}>
              <Text style={[styles.badgeText, { color: badgeText }]}>
                {badgeLabel}
              </Text>
            </View>
          ) : null}
        </View>

        <View style={styles.cardMid}>
          <View>
            <Text style={styles.qtyLabel}>On hand</Text>
            <Text style={styles.qtyValue}>
              {qty} <Text style={styles.qtyUnit}>{unit}</Text>
            </Text>
          </View>
          <View style={styles.alignEnd}>
            <Text style={styles.qtyLabel}>Expiry</Text>
            <Text
              style={[
                styles.expiryValue,
                urgency === 'expired' && { color: colors.danger },
                urgency === 'critical' && { color: colors.warning },
              ]}
            >
              {expiryLabel}
            </Text>
          </View>
        </View>

        <View style={styles.cardBottom}>
          <Text style={styles.valueText}>{formatKes(item.total_value)}</Text>
        </View>
      </View>
    );
  };

  if (isLoading && stock.length === 0) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Loading stock...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.screenTitle}>Stock Overview</Text>
      <Text style={styles.screenSub}>
        Live inventory · {STOCK_PAGE_SIZE} per page · pull to refresh
      </Text>

      <View style={styles.summaryRow}>
        <View style={styles.summaryChip}>
          <Text style={styles.summaryNum}>{summary.totalItems}</Text>
          <Text style={styles.summaryLbl}>Items</Text>
        </View>
        <View style={styles.summaryChip}>
          <Text
            style={[
              styles.summaryNum,
              summary.low > 0 && { color: colors.warning },
            ]}
          >
            {summary.low}
          </Text>
          <Text style={styles.summaryLbl}>Low / out</Text>
        </View>
        <View style={styles.summaryChip}>
          <Text
            style={[
              styles.summaryNum,
              summary.expiring > 0 && { color: colors.warning },
            ]}
          >
            {summary.expiring}
          </Text>
          <Text style={styles.summaryLbl}>Expiring</Text>
        </View>
        <View style={[styles.summaryChip, { flex: 1.2 }]}>
          <Text style={styles.summaryNumSmall} numberOfLines={1}>
            {formatKes(summary.value)}
          </Text>
          <Text style={styles.summaryLbl}>Page value</Text>
        </View>
      </View>

      {error ? (
        <View style={styles.center}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={() => fetchStock(page)}
          >
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          <FlatList
            data={sorted}
            renderItem={renderItem}
            keyExtractor={(item) => item.id || item.name}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
            }
            ListEmptyComponent={
              <View style={styles.emptyWrap}>
                <Text style={styles.emptyTitle}>No stock yet</Text>
                <Text style={styles.emptySub}>
                  Receive goods to see items here
                </Text>
              </View>
            }
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
          />

          <View style={styles.pager}>
            <TouchableOpacity
              style={[
                styles.pagerBtn,
                page <= 1 && styles.pagerBtnDisabled,
              ]}
              disabled={page <= 1 || isLoading}
              onPress={() => prevPage()}
            >
              <Text style={styles.pagerBtnText}>Previous</Text>
            </TouchableOpacity>
            <Text style={styles.pagerLabel}>
              Page {page} of {totalPages} · {total} total
            </Text>
            <TouchableOpacity
              style={[
                styles.pagerBtn,
                page >= totalPages && styles.pagerBtnDisabled,
              ]}
              disabled={page >= totalPages || isLoading}
              onPress={() => nextPage()}
            >
              <Text style={styles.pagerBtnText}>Next</Text>
            </TouchableOpacity>
          </View>
        </>
      )}

      <View style={styles.actions}>
        {(isKitchen || isManager) && (
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: colors.primary }]}
            onPress={() => navigation.navigate('Receive')}
          >
            <Text style={styles.actionButtonText}>+ Receive Goods</Text>
          </TouchableOpacity>
        )}
        {(isKitchen || isManager) && (
          <TouchableOpacity
            style={[
              styles.actionButton,
              {
                backgroundColor: colors.primaryDark,
                marginTop: spacing.sm,
              },
            ]}
            onPress={() => navigation.navigate('RefillRequest')}
          >
            <Text style={styles.actionButtonText}>+ Request Refill</Text>
          </TouchableOpacity>
        )}
        {(isKitchen || isManager) && (
          <TouchableOpacity
            style={[
              styles.actionButton,
              {
                backgroundColor: colors.warning,
                marginTop: spacing.sm,
              },
            ]}
            onPress={() => navigation.navigate('ClosingStock')}
          >
            <Text style={styles.actionButtonText}>Closing Stock Count</Text>
          </TouchableOpacity>
        )}
        {(isPos || isManager) && (
          <TouchableOpacity
            style={[
              styles.actionButton,
              {
                backgroundColor: colors.success,
                marginTop: spacing.sm,
              },
            ]}
            onPress={() => canUsePos && navigation.navigate('PosOrder')}
          >
            <Text style={styles.actionButtonText}>+ New POS Order</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
  },
  screenTitle: {
    ...typography.title,
    marginBottom: 2,
  },
  screenSub: {
    ...typography.small,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  summaryRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  summaryChip: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: 12,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  summaryNum: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  summaryNumSmall: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  summaryLbl: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 2,
  },
  listContent: {
    paddingBottom: spacing.md,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    borderLeftWidth: 4,
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.sm,
  },
  cardTitles: {
    flex: 1,
    paddingRight: spacing.sm,
  },
  itemName: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  sku: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  cardMid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  qtyLabel: {
    fontSize: 11,
    color: colors.textSecondary,
    marginBottom: 2,
  },
  qtyValue: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  qtyUnit: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.textSecondary,
  },
  alignEnd: {
    alignItems: 'flex-end',
  },
  expiryValue: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  cardBottom: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.sm,
  },
  valueText: {
    fontSize: 13,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  pager: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
    gap: spacing.sm,
  },
  pagerBtn: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  pagerBtnDisabled: {
    opacity: 0.4,
  },
  pagerBtnText: {
    fontWeight: '600',
    color: colors.textPrimary,
    fontSize: 13,
  },
  pagerLabel: {
    flex: 1,
    textAlign: 'center',
    fontSize: 12,
    color: colors.textSecondary,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: spacing.md,
    color: colors.textSecondary,
  },
  errorText: {
    color: colors.danger,
    fontSize: 16,
    textAlign: 'center',
  },
  retryButton: {
    marginTop: spacing.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    backgroundColor: colors.primary,
    borderRadius: 12,
  },
  retryText: {
    color: '#fff',
    fontWeight: '600',
  },
  emptyWrap: {
    marginTop: 48,
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  emptySub: {
    marginTop: spacing.xs,
    color: colors.textSecondary,
  },
  actions: {
    paddingTop: spacing.sm,
    paddingBottom: spacing.lg,
  },
  actionButton: {
    paddingVertical: spacing.md,
    borderRadius: 28,
    alignItems: 'center',
  },
  actionButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
});
