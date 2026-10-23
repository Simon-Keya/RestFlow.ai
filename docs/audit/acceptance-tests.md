# Acceptance tests

## Pre-prep 10 → 8.2
- original=10, yielded=8.2 → lost=1.8, loss%=18
- prepped_unit_cost = (10 × raw_uc) / 8.2
- waste value for COGS path = 0 (absorbed)

## Combo ×10
- 150g patty / combo → 1500g total in classic and expanded modes
- never 3000g

## Multi-output
- Inventory stock_deductions == Consumption quantities
- No second BOM explosion of production inputs on sale

## Variance
- |0.004| hidden; |0.35| shown

## Commands
```bash
cd RestFlowGo
go test ./tests/unit/ -count=1
```
