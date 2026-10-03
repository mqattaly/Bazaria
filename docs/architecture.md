# معماری بازاریا

## محدودهٔ فعلی

مخزن به‌صورت npm monorepo سازمان‌دهی شده است. Phase 0 فقط Foundation را فراهم می‌کند؛ هیچ جریان فروش، احراز هویت، دادهٔ کسب‌وکاری یا multi-tenancy در این مرحله پیاده‌سازی نشده است.

## Stack و مرزبندی

```text
apps/
  web/       React + TypeScript + Vite؛ پوستهٔ فارسی و RTL
  api/       NestJS + TypeScript؛ REST API ماژولار
packages/
  shared/    قراردادهای TypeScript مشترک API
  config/    تنظیمات پایهٔ مشترک TypeScript
 database/
  migrations/ SQLهای نسخه‌بندی‌شده
  seeds/       دادهٔ seed (در Phase 0 خالی)
docker/
  compose.yml  PostgreSQL محلی برای توسعه
```

وب فقط از URLهای نسبی مانند `/api/v1/health` استفاده می‌کند. Vite در حالت توسعه درخواست `/api` را به API محلی proxy می‌کند؛ کد اجراشده در مرورگر به `localhost` یا سرویس دیگری روی loopback وصل نمی‌شود.

API در NestJS به ماژول‌های کوچک تقسیم شده است. Controllerها فقط مرز HTTP هستند؛ دسترسی داده در `DatabaseService`/لایهٔ داده قرار می‌گیرد و منطق کسب‌وکار، در فازهای بعد، باید در سرویس‌های ماژولی بماند. اتصال پایگاه داده با `pg.Pool` ساخته می‌شود. ORM استفاده نمی‌شود و queryهای متغیردار باید پارامتری باشند.

## قرارداد REST و خطا

- پیشوند نسخه: `/api/v1`
- پاسخ موفق: `{ "data": ... }` و در صورت نیاز `meta` برای شناسهٔ درخواست یا pagination.
- پاسخ خطا: `{ "error": { "code": "...", "message": "...", "details": [...] } }`.
- خطاهای داخلی، stack trace، متن SQL و جزئیات اتصال به کلاینت برگردانده نمی‌شوند.
- اعتبارسنجی ورودی HTTP به‌صورت سراسری با `ValidationPipe` و گزینه‌های `whitelist`, `forbidNonWhitelisted` و `transform` انجام می‌شود. تنظیمات محیط با Zod اعتبارسنجی می‌شوند.
- CORS با `WEB_ORIGIN` محدود می‌شود؛ Helmet نیز headerهای امنیتی پایه را تنظیم می‌کند.

## PostgreSQL و migrationها

اتصال برنامه از `DATABASE_URL` می‌آید و از `pg` استفاده می‌کند. migrationها در `database/migrations/` نگهداری می‌شوند و نامشان باید `NNNN_description.sql` باشد. اجراکننده:

1. برای اجرای هم‌زمان از PostgreSQL advisory lock می‌گیرد.
2. نسخه‌ها را در `public.schema_migrations` ثبت می‌کند.
3. هر migration و ثبت نسخهٔ آن را در یک transaction اجرا می‌کند.

Migration نخست فقط schema برنامهٔ `bazariya` را ایجاد می‌کند. جداول کسب‌وکار به Phase 1 تعلق دارند. نقش دیتابیس اجراکننده به مجوز ساخت schema و جدول tracking نیاز دارد.

## قراردادهای مشترک

- TypeScript: strict mode؛ typeها و interfaceهای قابل‌استفادهٔ هر دو سمت در `@bazariya/shared` قرار می‌گیرند.
- نام‌گذاری: کلاس/کامپوننت `PascalCase`، توابع و متغیرها `camelCase`، نام فایل‌ها/routeها `kebab-case` و نام جدول/ستون SQL در فازهای بعد `snake_case`.
- محیط: متغیرهای موردنیاز در `.env.example` مستند می‌شوند؛ فایل `.env` محلی commit نمی‌شود.
- زمان: زمان‌های ذخیره‌شده در PostgreSQL باید در آینده با `timestamptz` و UTC مدیریت شوند؛ نمایش محصول در صورت نیاز با timezone `Asia/Tehran` و تقویم جلالی انجام می‌شود.
- مبلغ: در جداول کسب‌وکار آینده مقدار پولی integer خواهد بود؛ در Phase 0 هنوز مبلغی وجود ندارد.

## موارد خارج از محدوده

Login واقعی، roleها، tenantها، RLS، فروشگاه/محصول/ویزیت/سفارش، قیمت‌گذاری، GPS و همهٔ قابلیت‌های عملیاتی پس از تأیید Phase 0 بررسی می‌شوند. این Foundation هیچ‌یک از آن‌ها را ادعای پیاده‌سازی‌شده نمی‌داند.
