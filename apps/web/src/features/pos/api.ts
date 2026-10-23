// apps/web/src/features/pos/api.ts
import { posApiClient, POS_MUTATION_TIMEOUT_MS } from "@/lib/api/client";
import { endpoints } from "@/lib/api/endpoints";
import { toApiError } from "@/lib/api/errors";
import { asArray, buildQueryString } from "@/lib/utils";
import type { Paginated } from "@/types/common";
import type {
  MenuAvailability,
  PosOrderDetail,
  PosOrderSummary,
} from "./types";

export interface OrderListParams {
  shopId: string;
  status?: string;
  orderType?: string;
  page?: number;
  pageSize?: number;
}

export interface ComponentSelectionInput {
  component_key: string;
  finished_good_id: string;
  finished_good_name?: string;
  quantity: number;
}

export interface PaymentSplitInput {
  method: "cash" | "mpesa" | "card";
  amount: number;
  reference?: string;
}

export interface CreatePosOrderInput {
  client_idempotency_key?: string;
  order_type: "dine-in" | "takeaway" | "delivery" | "pickup" | "dine_in";
  table_number?: string;
  customer_name?: string;
  customer_phone?: string;
  shop_id?: string;
  items: Array<{
    line_type?: "menu_item" | "combo";
    menu_id?: string;
    menu_name?: string;
    combo_id?: string;
    quantity: number;
    selling_price?: number;
    notes?: string;
    selections?: ComponentSelectionInput[];
    combo_selections?: Array<{
      group_index: number;
      menu_item_ids: string[];
    }>;
  }>;
  total_amount: number;
  tax_amount?: number;
  discount_amount?: number;
  payment_method: "cash" | "mpesa" | "card" | "split";
  payment_splits?: PaymentSplitInput[];
  mpesa_reference?: string;
  payment_status?: "paid" | "pending" | "failed" | "unpaid";
  notes?: string;
}

function toMenuAvailability(raw: Record<string, unknown>): MenuAvailability {
  const maxPortions = Math.max(
    0,
    Math.floor(Number(raw.maxPortions ?? raw.max_portions ?? 0)),
  );
  const isAvailable = Boolean(
    raw.isAvailable ?? raw.is_available ?? maxPortions > 0,
  );
  const isLow = Boolean(
    raw.isLow ??
      raw.is_low ??
      (isAvailable && maxPortions > 0 && maxPortions <= 5),
  );

  return {
    menuItemId: String(raw.menuItemId ?? raw.menu_id ?? raw.menuId ?? ""),
    menuCode: String(
      raw.menuCode ?? raw.menu_code ?? raw.menuItemId ?? raw.menu_id ?? "",
    ),
    name: String(raw.name ?? raw.menu_name ?? ""),
    isAvailable,
    isLow,
    maxPortions,
    availableQuantity: Number(
      raw.availableQuantity ?? raw.available_quantity ?? maxPortions,
    ),
    finishedGoodId: (raw.finishedGoodId ??
      raw.finished_good_id ??
      null) as string | null,
  };
}


function toOrderSummary(raw: Record<string, unknown>): PosOrderSummary {
  const items = raw.items;
  let itemCount = Number(raw.itemCount ?? raw.item_count ?? 0);
  if (!itemCount && Array.isArray(items)) itemCount = items.length;

  const orderId = String(
    raw.orderId ?? raw.order_id ?? raw.event_id ?? raw.id ?? "",
  );

  let createdAt = "";
  if (typeof raw.createdAt === "string") createdAt = raw.createdAt;
  else if (typeof raw.created_at === "string") createdAt = raw.created_at;
  else createdAt = new Date().toISOString();

  return {
    orderId,
    status: String(
      raw.status ?? raw.kitchen_status ?? raw.kitchenStatus ?? "not_sent",
    ),
    kitchenStatus: (raw.kitchenStatus ?? raw.kitchen_status) as
      | string
      | undefined,
    sentToKitchen: Boolean(raw.sentToKitchen ?? raw.sent_to_kitchen),
    orderType: String(raw.orderType ?? raw.order_type ?? "dine_in").replace(
      /-/g,
      "_",
    ),
    totalAmount: Number(raw.totalAmount ?? raw.total_amount ?? 0),
    itemCount,
    paymentStatus: String(
      raw.paymentStatus ?? raw.payment_status ?? "unpaid",
    ),
    paymentMethod: (raw.paymentMethod ?? raw.payment_method) as
      | string
      | undefined,
    createdAt,
    tableNumber: (raw.tableNumber ?? raw.table_number ?? null) as
      | string
      | null,
    customerName: (raw.customerName ?? raw.customer_name ?? null) as
      | string
      | null,
    customerPhone: (raw.customerPhone ?? raw.customer_phone ?? null) as
      | string
      | null,
  };
}

export const posApi = {
  async getOrders(
    params: OrderListParams,
  ): Promise<Paginated<PosOrderSummary>> {
    try {
      const { data } = await posApiClient.get(
        `${endpoints.pos.orders}${buildQueryString({ ...params })}`,
      );
      const root = (data ?? {}) as Record<string, unknown>;
      const items = asArray<Record<string, unknown>>(root.items ?? data)
        .map(toOrderSummary)
        .filter((o) => o.orderId);
      return {
        items,
        total: Number(root.total ?? items.length),
        page: Number(root.page ?? params.page ?? 1),
        pageSize: Number(root.pageSize ?? params.pageSize ?? 25),
      };
    } catch (error) {
      throw toApiError(error);
    }
  },

  async getOrder(orderId: string): Promise<PosOrderDetail> {
    try {
      const { data } = await posApiClient.get(endpoints.pos.order(orderId));
      return data as PosOrderDetail;
    } catch (error) {
      throw toApiError(error);
    }
  },

  async getBootstrap(shopId: string): Promise<{
    menus: unknown[];
    availability: MenuAvailability[];
    combos: unknown[];
    categories: unknown[];
    serverTime?: string;
    durationMs?: number;
  }> {
    try {
      const { data } = await posApiClient.get(
        `${endpoints.pos.bootstrap}${buildQueryString({ shopId })}`,
      );
      const root = (data ?? {}) as Record<string, unknown>;
      // Go may return menus and/or items — collapse to menus for a stable client type
      const menusRaw = Array.isArray(root.menus)
        ? root.menus
        : Array.isArray(root.items)
          ? root.items
          : [];
      return {
        menus: menusRaw,
        availability: Array.isArray(root.availability)
          ? (root.availability as MenuAvailability[])
          : [],
        combos: Array.isArray(root.combos) ? root.combos : [],
        categories: Array.isArray(root.categories) ? root.categories : [],
        serverTime: root.serverTime as string | undefined,
        durationMs: root.durationMs as number | undefined,
      };
    } catch (error) {
      throw toApiError(error);
    }
  },

  async getMenuAvailability(shopId: string): Promise<MenuAvailability[]> {
    try {
      const { data } = await posApiClient.get(
        `${endpoints.pos.menuAvailability}${buildQueryString({ shopId })}`,
      );
      const root = (data ?? {}) as Record<string, unknown>;
      return asArray<Record<string, unknown>>(root.items ?? data)
        .map(toMenuAvailability)
        .filter((m) => m.menuItemId);
    } catch (error) {
      throw toApiError(error);
    }
  },

  async createOrder(input: CreatePosOrderInput): Promise<{
    success: boolean;
    orderId?: string;
    eventId?: string;
    message?: string;
  }> {
    try {
      const { data } = await posApiClient.post(endpoints.pos.createOrder, input, {
        timeout: POS_MUTATION_TIMEOUT_MS,
      });
      return data as {
        success: boolean;
        orderId?: string;
        eventId?: string;
        message?: string;
      };
    } catch (error) {
      throw toApiError(error);
    }
  },

  async sendToKitchen(
    orderId: string,
    shopId?: string,
  ): Promise<{ success: boolean; message?: string }> {
    try {
      const { data } = await posApiClient.post(
        endpoints.pos.sendToKitchen(orderId),
        { shop_id: shopId },
      );
      return data as { success: boolean; message?: string };
    } catch (error) {
      throw toApiError(error);
    }
  },

  async updatePayment(
    orderId: string,
    input: {
      payment_status: "paid" | "pending" | "failed" | "unpaid";
      payment_method?: "cash" | "mpesa" | "card" | "split";
      mpesa_reference?: string;
      shop_id?: string;
      notes?: string;
    },
  ): Promise<{ success: boolean; message?: string }> {
    try {
      const { data } = await posApiClient.post(
        endpoints.pos.updatePayment(orderId),
        input,
      );
      return data as { success: boolean; message?: string };
    } catch (error) {
      throw toApiError(error);
    }
  },
};