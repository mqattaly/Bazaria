-- Development-only catalog fixtures. Run via `npm run db:seed` in NODE_ENV=development.
INSERT INTO bazariya.categories (id, name, description, is_active)
VALUES
  ('00000000-0000-4000-8000-000000000001', 'ظروف یکبار مصرف', 'ظروف و لیوان‌های مصرفی فروشگاه', true),
  ('00000000-0000-4000-8000-000000000002', 'لوازم آشپزخانه', 'ابزارهای سادهٔ موردنیاز آشپزخانه', true),
  ('00000000-0000-4000-8000-000000000003', 'پلاسکو', 'محصولات پلاستیکی خانگی', true),
  ('00000000-0000-4000-8000-000000000004', 'نظافت', 'لوازم پایهٔ نظافت خانه', true)
ON CONFLICT DO NOTHING;

INSERT INTO bazariya.products (
  name, sku, category_id, unit, description, sale_price, purchase_price, is_active
)
SELECT fixture.name, fixture.sku, category.id, fixture.unit, fixture.description,
       fixture.sale_price, fixture.purchase_price, true
FROM (
  VALUES
    ('لیوان کاغذی ۲۲۰ میلی‌لیتری', 'CUP-001', 'ظروف یکبار مصرف', 'piece', 'لیوان مناسب نوشیدنی گرم و سرد', 12000::bigint, 8000::bigint),
    ('ظرف غذای درب‌دار', 'BOX-001', 'ظروف یکبار مصرف', 'piece', 'ظرف یک‌خانهٔ درب‌دار', 18000::bigint, 12500::bigint),
    ('قابلمهٔ کوچک', 'POT-001', 'لوازم آشپزخانه', 'piece', 'قابلمهٔ سبک برای استفادهٔ روزمره', 680000::bigint, 520000::bigint),
    ('آبکش پلاستیکی', 'PLS-001', 'پلاسکو', 'piece', 'آبکش پلاستیکی دسته‌دار', 95000::bigint, 65000::bigint),
    ('بطری آب یک لیتری', 'BOT-001', 'پلاسکو', 'piece', 'بطری سبک و قابل استفادهٔ مجدد', 85000::bigint, 57000::bigint),
    ('اسکاچ ظرف‌شویی', 'CLN-001', 'نظافت', 'pack', 'بستهٔ سه‌تایی اسکاچ', 45000::bigint, 30000::bigint)
) AS fixture(name, sku, category_name, unit, description, sale_price, purchase_price)
JOIN bazariya.categories AS category ON lower(category.name) = lower(fixture.category_name)
ON CONFLICT (sku) DO NOTHING;
