# Database seeds

The SQL files contain deterministic, development-only fixtures:

- `0001_phase2_catalog.sql`: four Category and six Product examples.
- `0002_phase3_customers.sql`: three independent Customer examples.
- `0003_phase5_inventory.sql`: one Inventory record per sample Product and representative immutable stock movements.

The seeds are idempotent and are not production data. Customer rows remain independent of Products and Categories. No Order fixture is seeded; development orders should be created through the order API/UI so active Product/Customer validation and snapshots are exercised. Inventory fixtures are loaded only by the existing development-only seed runner after the Inventory migration; they do not create or connect to Orders, Purchases, Suppliers, or accounting data.

Run only with `NODE_ENV=development` after applying migrations:

```bash
npm run db:migrate
npm run db:seed
```

The seed runner refuses other environments. It loads all three fixture files in one transaction and retains the existing sample Product IDs/SKUs. Re-running the runner does not duplicate sample stock movements or reset inventory after movement history has been recorded; it also avoids attaching fixture history when a sample Product's stock or minimum has been edited from the expected seed state.
