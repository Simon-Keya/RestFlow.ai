# Money: Float → Decimal migration plan

**Current:** monetary fields remain `Float` in Prisma for API compatibility;
critical paths use `money.util` (`toMoneyNumber`, `roundMoney`, cents helpers).

**Target (planned):**

```sql
ALTER TABLE "Event" ALTER COLUMN "unit_cost" TYPE DECIMAL(18,4) USING ROUND("unit_cost"::numeric, 4);
ALTER TABLE "Event" ALTER COLUMN "total_cost" TYPE DECIMAL(18,4) USING ROUND("total_cost"::numeric, 4);
```

Then Prisma `Float` → `Decimal @db.Decimal(18, 4)`, regenerate client, use `toMoneyNumber()` on reads.
