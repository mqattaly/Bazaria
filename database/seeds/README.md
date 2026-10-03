# Database seeds

`0001_phase2_catalog.sql` contains small, deterministic development fixtures for the Phase 2 Category and Product domains only. It is idempotent for categories and product SKUs and must not be treated as production data.

Run it only with `NODE_ENV=development` after applying migrations:

```bash
npm run db:migrate
npm run db:seed
```

The seed runner refuses other environments. It adds four common shop categories and six example products; it does not create sales, customers, inventory, purchasing, or accounting data.
