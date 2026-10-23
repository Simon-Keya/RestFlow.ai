# Mobile ↔ Nest / Go / Web alignment (Oct 2026)

## Env

| Variable | Purpose |
|----------|---------|
| `EXPO_PUBLIC_API_URL` | Nest (system of record) |
| `EXPO_PUBLIC_POS_API_URL` | Optional Go POS base URL |
| `EXPO_PUBLIC_USE_GO_POS` | Prefer Go for POS when true |

## POS contract (matches web)

- `POST /pos/order` with `line_type`, `menu_item_id`, `quantity`
- Menu load: `GET /pos/bootstrap` then fallback `GET /menu`
- Normalize `menuId` / `sellingPrice` from Nest/Go JSON

## Production finish

- `POST /production/finish` with **`production_id`** (snake_case), `actual_quantity_produced`, `batch_number`, `expiry_date`

## Compile

```bash
cd apps/mobile
cp .env.example .env   # edit URLs
npm install
npx tsc --noEmit
npx expo start
```
