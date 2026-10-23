# stock-units pure expectations

toCanonicalStockQty(0.5, "kg", 400) → { quantity: 500, unit: "g", unitCost: 0.4 }
toCanonicalStockQty(2, "L", 100) → { quantity: 2000, unit: "ml", unitCost: 0.1 }
toCanonicalStockQty(3, "pcs", 10) → { quantity: 3, unit: "pcs", unitCost: 10 }
quantityInItemUnit(1, "kg", "g") → 1000
quantityInItemUnit(500, "g", "kg") → 0.5
scaleFactorForUnitChange("kg", "g") → 1000
