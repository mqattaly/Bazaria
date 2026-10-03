-- Development-only Customer fixtures. Run via `npm run db:seed` in NODE_ENV=development.
INSERT INTO bazariya.customers (id, name, phone, email, address, description, is_active)
VALUES
  ('00000000-0000-4000-8000-000000000011', 'مینا رضایی', '09121234567', 'mina.rezaei@example.test', 'تهران، خیابان نمونه', 'نمونهٔ مشتری فعال', true),
  ('00000000-0000-4000-8000-000000000012', 'آرمان کریمی', '02112345678', NULL, NULL, NULL, false),
  ('00000000-0000-4000-8000-000000000013', 'نرگس موسوی', NULL, 'narges.m@example.test', NULL, 'نمونهٔ مشتری با ایمیل', true)
ON CONFLICT (id) DO NOTHING;
