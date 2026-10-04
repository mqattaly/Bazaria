-- Development-only Inventory fixtures; IDs stay stable so movement inserts are idempotent.
WITH fixture(sku, quantity, minimum_quantity) AS (
  VALUES
    ('CUP-001', 100::bigint, 24::bigint),
    ('BOX-001', 0::bigint, 12::bigint),
    ('POT-001', 18::bigint, 6::bigint),
    ('PLS-001', 4::bigint, 5::bigint),
    ('BOT-001', 35::bigint, 10::bigint),
    ('CLN-001', 8::bigint, 0::bigint)
)
INSERT INTO bazariya.inventory AS current_inventory (product_id, quantity, minimum_quantity)
SELECT product.id, fixture.quantity, fixture.minimum_quantity
FROM fixture
JOIN bazariya.products AS product ON product.sku = fixture.sku
ON CONFLICT (product_id) DO UPDATE
SET quantity = EXCLUDED.quantity,
    minimum_quantity = EXCLUDED.minimum_quantity,
    updated_at = now()
WHERE NOT EXISTS (
  SELECT 1
  FROM bazariya.stock_movements AS movement
  WHERE movement.product_id = EXCLUDED.product_id
)
AND current_inventory.quantity = 0
AND current_inventory.minimum_quantity = 0;

WITH expected_inventory(sku, quantity, minimum_quantity) AS (
  VALUES
    ('CUP-001', 100::bigint, 24::bigint),
    ('BOX-001', 0::bigint, 12::bigint),
    ('POT-001', 18::bigint, 6::bigint),
    ('PLS-001', 4::bigint, 5::bigint),
    ('BOT-001', 35::bigint, 10::bigint),
    ('CLN-001', 8::bigint, 0::bigint)
)
INSERT INTO bazariya.stock_movements (
  id, product_id, type, quantity, before_quantity, after_quantity, note, created_at
)
SELECT fixture.id, product.id, fixture.type, fixture.quantity,
       fixture.before_quantity, fixture.after_quantity, fixture.note, now() - fixture.age
FROM (
  VALUES
    ('00000000-0000-4000-8000-000000000101'::uuid, 'CUP-001', 'IN', 120::bigint, 0::bigint, 120::bigint, 'ثبت موجودی آغازین', interval '8 days'),
    ('00000000-0000-4000-8000-000000000102'::uuid, 'CUP-001', 'OUT', 20::bigint, 120::bigint, 100::bigint, 'فروش حضوری', interval '2 days'),
    ('00000000-0000-4000-8000-000000000103'::uuid, 'BOX-001', 'ADJUSTMENT', 0::bigint, 0::bigint, 0::bigint, 'تأیید شمارش انبار', interval '1 day'),
    ('00000000-0000-4000-8000-000000000104'::uuid, 'POT-001', 'IN', 20::bigint, 0::bigint, 20::bigint, 'ثبت موجودی آغازین', interval '10 days'),
    ('00000000-0000-4000-8000-000000000105'::uuid, 'POT-001', 'OUT', 2::bigint, 20::bigint, 18::bigint, 'اصلاح خروج دستی', interval '3 days'),
    ('00000000-0000-4000-8000-000000000106'::uuid, 'PLS-001', 'ADJUSTMENT', 4::bigint, 0::bigint, 4::bigint, 'شمارش اولیه', interval '5 days'),
    ('00000000-0000-4000-8000-000000000107'::uuid, 'BOT-001', 'IN', 35::bigint, 0::bigint, 35::bigint, 'رسید موجودی نمونه', interval '4 days'),
    ('00000000-0000-4000-8000-000000000108'::uuid, 'CLN-001', 'IN', 10::bigint, 0::bigint, 10::bigint, 'ثبت موجودی آغازین', interval '7 days'),
    ('00000000-0000-4000-8000-000000000109'::uuid, 'CLN-001', 'OUT', 2::bigint, 10::bigint, 8::bigint, 'خروج نمونه', interval '1 day')
) AS fixture(id, sku, type, quantity, before_quantity, after_quantity, note, age)
JOIN bazariya.products AS product ON product.sku = fixture.sku
JOIN expected_inventory AS expected ON expected.sku = product.sku
JOIN bazariya.inventory AS current_inventory ON current_inventory.product_id = product.id
WHERE current_inventory.quantity = expected.quantity
AND current_inventory.minimum_quantity = expected.minimum_quantity
AND NOT EXISTS (
  SELECT 1
  FROM bazariya.stock_movements AS existing_movement
  WHERE existing_movement.product_id = product.id
)
ON CONFLICT (id) DO NOTHING;
