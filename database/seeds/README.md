# Database seeds

The SQL files contain deterministic, development-only fixtures:

- `0001_phase2_catalog.sql`: four Categories and six Products.
- `0002_phase3_customers.sql`: three independent Customers.
- `0003_phase5_inventory.sql`: Inventory records and representative immutable stock movements.
- `0004_phase6_suppliers_purchases.sql`: two Suppliers and one draft Purchase with a Product snapshot; the draft does not change stock.

The seeds are idempotent and are not production data. Customer, Supplier, Product and Inventory remain separate domains; Purchase history retains its Supplier and Product references. The sample Purchase starts as a draft and creates no StockMovement.

Run only with `NODE_ENV=development` after applying migrations:

```bash
npm run db:migrate
npm run db:seed
```

The seed runner refuses other environments. It loads the fixture SQL in one transaction and retains the stable sample Product IDs/SKUs. Re-running does not duplicate sample stock movements, reset inventory after movement history has been recorded, or confirm/cancel the sample Purchase. The Purchase number sequence is advanced to avoid colliding with seeded numbers.
