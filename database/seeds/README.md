# Database seeds

The SQL files contain small, deterministic development fixtures only:

- `0001_phase2_catalog.sql`: four Category and six Product examples.
- `0002_phase3_customers.sql`: three independent Customer examples.

Both seeds are idempotent and are not production data. Customer rows have no relationship to Products, Categories, sales, or other future domains.

Run only with `NODE_ENV=development` after applying migrations:

```bash
npm run db:migrate
npm run db:seed
```

The seed runner refuses other environments. It loads the catalog and customer fixtures in one transaction; it does not create sales, orders, inventory, purchasing, invoices, or accounting data.
