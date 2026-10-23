export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface ShopScoped {
  shopId: string;
}

export type SortDirection = "asc" | "desc";

export interface DateRangeParams {
  from?: string;
  to?: string;
}

/** Discriminated result used by a handful of hooks that need to distinguish "empty" from "loading". */
export type AsyncState<T> =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "success"; data: T };
