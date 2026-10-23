# InventoryBatch migration

Adds the FEFO lot table defined in `schema.prisma` but previously absent from migration history.

## Apply (Nest API / same Postgres Go uses)

```bash
cd apps/api
npx prisma migrate deploy
# or
npx prisma migrate dev --name inventory_batch
```

After deploy, Nest `recordReceiveBatch` and Go receive/FEFO write to `"InventoryBatch"`.
