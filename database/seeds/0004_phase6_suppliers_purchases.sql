-- Development-only supplier and draft purchase fixtures.
INSERT INTO bazariya.suppliers (id, name, phone, email, address, note, is_active)
VALUES
  ('00000000-0000-4000-8000-000000000301', 'پخش نمونه بازاریا', '021-12345678', 'orders@example.test', 'تهران، بازار بزرگ', 'تأمین‌کنندهٔ نمونه', true),
  ('00000000-0000-4000-8000-000000000302', 'تأمین کالای خانه', '021-87654321', 'sales@example.test', NULL, NULL, true)
ON CONFLICT (id) DO UPDATE
SET name = EXCLUDED.name,
    phone = EXCLUDED.phone,
    email = EXCLUDED.email,
    address = EXCLUDED.address,
    note = EXCLUDED.note,
    is_active = EXCLUDED.is_active,
    updated_at = now();

INSERT INTO bazariya.purchases (
  id, purchase_number, supplier_id, status, subtotal, discount, total, note
)
SELECT
  '00000000-0000-4000-8000-000000000303'::uuid,
  'PUR-000001',
  '00000000-0000-4000-8000-000000000301'::uuid,
  'draft',
  1500000,
  50000,
  1450000,
  'پیش‌نویس نمونه؛ برای ثبت موجودی نهایی نشده است'
WHERE EXISTS (SELECT 1 FROM bazariya.products WHERE sku = 'CUP-001' AND is_active)
  AND NOT EXISTS (SELECT 1 FROM bazariya.purchases WHERE purchase_number = 'PUR-000001')
ON CONFLICT (id) DO NOTHING;

INSERT INTO bazariya.purchase_items (
  purchase_id,
  product_id,
  product_name_snapshot,
  product_sku_snapshot,
  unit_snapshot,
  unit_price,
  quantity,
  line_total
)
SELECT
  '00000000-0000-4000-8000-000000000303'::uuid,
  product.id,
  product.name,
  product.sku,
  product.unit,
  250000,
  6,
  1500000
FROM bazariya.products AS product
WHERE product.sku = 'CUP-001'
  AND product.is_active
  AND EXISTS (
    SELECT 1 FROM bazariya.purchases
    WHERE id = '00000000-0000-4000-8000-000000000303'
      AND status = 'draft'
  )
ON CONFLICT (purchase_id, product_id) DO NOTHING;

SELECT setval(
  'bazariya.purchase_number_seq',
  GREATEST(COALESCE((SELECT max(substring(purchase_number FROM 5)::bigint) FROM bazariya.purchases), 1), 1),
  true
);
