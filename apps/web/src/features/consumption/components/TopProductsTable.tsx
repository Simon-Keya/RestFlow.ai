// TopProductsTable.tsx
"use client";

import Link from "next/link";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import {
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableHeaderCell,
  TableCell,
} from "@/components/ui/Table";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatCurrency } from "@/lib/format/currency";
import { formatQuantity } from "@/lib/format/numbers";
import { routes } from "@/lib/routes";
import { PackageSearch } from "lucide-react";
import type { TopConsumedProduct } from "../types";

export function TopProductsTable({
  shopId,
  products,
}: {
  shopId: string;
  products: TopConsumedProduct[];
}) {
  const list = Array.isArray(products) ? products : [];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Top consumed products</CardTitle>
      </CardHeader>
      {list.length === 0 ? (
        <EmptyState
          icon={PackageSearch}
          title="Nothing consumed in this period"
        />
      ) : (
        <Table>
          <TableHead>
            <tr>
              <TableHeaderCell>Product</TableHeaderCell>
              <TableHeaderCell className="text-right">Quantity</TableHeaderCell>
              <TableHeaderCell className="text-right">Value</TableHeaderCell>
            </tr>
          </TableHead>
          <TableBody>
            {list.map((product) => (
              <TableRow key={product.itemId}>
                <TableCell>
                  <Link
                    href={routes.consumptionProduct(shopId, product.itemId)}
                    className="font-medium text-primary-700 hover:underline"
                  >
                    {product.name}
                  </Link>
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatQuantity(product.quantityConsumed, product.unit)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatCurrency(product.valueConsumed)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </Card>
  );
}
