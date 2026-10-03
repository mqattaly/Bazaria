# معماری بازاریا

## محدودهٔ فعلی

مخزن زیرساخت Phase 0، بنیاد رابط کاربری Phase 1، دامنهٔ محدود کاتالوگ Phase 2 و مدیریت مستقل مشتریان Phase 3 را پیاده‌سازی می‌کند. **Product** و **Category تخت**، و نیز **Customer** مستقل، دامنه‌های واقعی‌اند؛ داشبورد همچنان mock است و ورود واقعی یا احراز هویت وجود ندارد.

## Stack و مرزبندی

```text
apps/
  web/       React + TypeScript + Vite؛ پوستهٔ فارسی/RTL، کاتالوگ و مشتریان
  api/       NestJS + TypeScript؛ REST API ماژولار
packages/
  shared/    قراردادهای TypeScript و انواع مشترک
  config/    تنظیمات پایهٔ TypeScript
 database/
  migrations/ SQLهای نسخه‌بندی‌شده
  seeds/       دادهٔ توسعهٔ اختیاری برای کاتالوگ و مشتریان
 docker/
  compose.yml  PostgreSQL محلی برای توسعه
```

وب فقط از URLهای نسبی مانند `/api/v1/health` استفاده می‌کند. Vite در توسعه درخواست `/api` را به API proxy می‌کند؛ کد اجراشده در مرورگر به `localhost` یا سرویس دیگری روی loopback وصل نمی‌شود.

## رابط کاربری

- `apps/web/src/styles.css` توکن‌های معنایی رنگ و حالت روشن/تیره را تعریف می‌کند. `ThemeProvider` انتخاب تم را در مرورگر نگه می‌دارد.
- قلم Vazirmatn Variable محلی است و آیکون‌های پایه SVGهای درون‌برنامه‌ای‌اند.
- `components/layout/` پوستهٔ واکنش‌گرا، سربرگ و ناوبری دسکتاپ/موبایل را دارد؛ `components/ui/` primitives دسترس‌پذیر و RTL-aware را فراهم می‌کند.
- `/products` فهرست قابل جستجو، فیلتر و صفحه‌بندی‌شده، `/products/:id` جزئیات و `/categories` مدیریت دسته‌ها را نمایش می‌دهند. فرم‌ها و تأیید حذف به API وصل‌اند؛ قیمت فقط برای نمایش به قالب فارسی تومان تبدیل می‌شود.
- `/customers` فهرست واکنش‌گرا، جستجو/فیلتر، فرم ایجاد/ویرایش و تأیید حذف را دارد؛ `/customers/:id` فقط اطلاعات پایه و timestampهای همان مشتری را نشان می‌دهد. مسیرها مستقل از کاتالوگ و دامنه‌های آینده‌اند.
- داشبورد در `features/dashboard/` قرار دارد و اعداد/فعالیت‌های آن همچنان در `dashboard.mock.ts` و صرفاً نمایشی‌اند. میانبر افزودن محصول و افزودن مشتری فرم متناظر را باز می‌کند؛ KPI مشتری اضافه نشده است.
- `/login` placeholder است و هیچ احراز هویتی انجام نمی‌دهد.

## دامنه‌های Product، Category و Customer و REST API

API در NestJS ماژولار است. Controllerها مرز HTTP هستند، سرویس‌ها قواعد دامنه را اعمال می‌کنند و repositoryها queryهای SQL پارامتری را با `DatabaseService` اجرا می‌کنند. قراردادهای ورودی/خروجی در `@bazariya/shared` و اعتبارسنجی HTTP با DTOهای typed انجام می‌شود. مسیر همهٔ endpointها زیر `/api/v1` است.

### Category

- مسیرها: `GET /categories`, `POST /categories`, `GET /categories/:id`, `PATCH /categories/:id`, `DELETE /categories/:id`.
- دسته‌بندی تخت است؛ `name` پس از trim باید یکتا باشد (بدون حساسیت به بزرگی/کوچکی حروف). `description`, `isActive`, `createdAt`, `updatedAt` نیز در مدل قرار دارند. فهرست تعداد محصولات وابسته را هم برمی‌گرداند.
- حذف دسته‌ای که محصول دارد با پاسخ کنترل‌شدهٔ `409` مسدود می‌شود؛ کلید خارجی نیز `ON DELETE RESTRICT` است.

### Product

- مسیرها: `GET /products`, `POST /products`, `GET /products/:id`, `PATCH /products/:id`, `DELETE /products/:id`.
- فیلدها: نام، SKU، شناسهٔ دسته، واحد تایپ‌شده (`piece`, `pack`, `carton`, `kilogram`, `gram`, `liter`, `meter`)، توضیحات، قیمت فروش، قیمت خرید پایهٔ اختیاری، وضعیت فعال و timestampها.
- SKU پس از trim به uppercase نرمال می‌شود و یکتایی به‌صورت canonical (حروف بزرگ) اعمال می‌شود؛ الگوریتم خودکار تولید SKU وجود ندارد.
- قیمت‌ها در API و PostgreSQL عدد صحیح غیرمنفی Toman هستند؛ مقدار پولی float ذخیره نمی‌شود. قالب‌بندی فارسی (`Intl.NumberFormat`) فقط در presentation انجام می‌گیرد.
- `GET /products` جستجوی trim‌شده و بدون حساسیت به حروف را روی ابتدای نام و SKU، و فیلترهای اختیاری `categoryId` و `isActive` می‌پذیرد. `page` و `pageSize` عدد صحیح مثبت‌اند؛ پیش‌فرض‌ها ۱ و ۲۰، سقف `page` برابر ۲٬۱۴۷٬۴۸۳٬۶۴۷ و سقف `pageSize` برابر ۱۰۰ است. پاسخ شامل `items` و `pagination: { page, pageSize, total, totalPages }` است.
- updateها فقط فیلدهای مجاز DTO را می‌پذیرند؛ فیلد ناشناخته رد می‌شود. شناسهٔ دسته باید به دستهٔ موجود اشاره کند.

### Customer

- مسیرها: `GET /customers`, `POST /customers`, `GET /customers/:id`, `PATCH /customers/:id`, `DELETE /customers/:id`.
- فیلدها: UUID، نام trim‌شدهٔ الزامی (۲ تا ۱۲۰ نویسه)، شماره تماس/ایمیل/آدرس/توضیحات nullable، وضعیت فعال با پیش‌فرض true و timestampهای UTC.
- شماره و ایمیل اختیاری‌اند؛ شماره با ارقام فارسی/عربی و فاصله/خط‌تیرهٔ رایج نرمال می‌شود و قالب موبایل/تلفن ایران مانند `09121234567` و `02112345678` پذیرفته می‌شود. شماره یکتا نیست. ایمیل trim و lowercase می‌شود و اعتبارسنجی می‌شود.
- `GET /customers` جستجوی پارامتری را روی نام، شماره تماس و ایمیل و فیلتر اختیاری `isActive` می‌پذیرد. صفحه‌بندی مانند کاتالوگ، با پیش‌فرض ۱/۲۰ و حداکثر `pageSize=100` است.
- `PATCH` فقط فیلدهای ارسال‌شده را تغییر می‌دهد، بدنهٔ خالی رد می‌شود و فیلدهای nullable با `null` قابل پاک‌کردن‌اند. DTO فیلد ناشناخته را رد می‌کند.
- Customer جدول و ماژول API مستقلی دارد؛ هیچ foreign key یا جریان وابسته به Product، Category، Order، Invoice، Sales یا دامنهٔ آینده تعریف نشده است.

### قرارداد پاسخ و خطا

- پاسخ موفق: `{ "data": ... }` و برای فهرست‌های صفحه‌بندی‌شدهٔ محصولات و مشتریان، `items` و `pagination` درون `data` قرار دارند.
- پاسخ خطا: `{ "error": { "code": "...", "message": "...", "details": [...] } }`.
- خطاهای تکراری نام/SKU، دستهٔ نامعتبر، دستهٔ وابسته به محصول، اعتبارسنجی مشتری و not-found به status/code مشخص و پیام امن نگاشت می‌شوند؛ SQL، stack trace و جزئیات اتصال به کلاینت نشت نمی‌کند.
- اعتبارسنجی HTTP با `ValidationPipe` و گزینه‌های `whitelist`, `forbidNonWhitelisted`, `transform` انجام می‌شود. CORS با `WEB_ORIGIN` محدود است و Helmet headerهای امنیتی را تنظیم می‌کند.

## PostgreSQL و migrationها

اتصال برنامه از `DATABASE_URL` و `pg.Pool` می‌آید؛ ORM استفاده نمی‌شود. migrationها در `database/migrations/` با الگوی `NNNN_description.sql` نگهداری می‌شوند. اجراکننده برای اجرای هم‌زمان advisory lock می‌گیرد و هر migration/ثبت نسخه را در transaction اعمال می‌کند.

- `0001_foundation_schema.sql` schema برنامهٔ `bazariya` و جدول پیگیری migrationها را ایجاد می‌کند.
- `0002_product_categories.sql` جدول‌های `categories` و `products`، UUIDها، محدودیت یکتایی نام case-insensitive و SKU canonical، checkهای واحد و قیمت صحیح غیرمنفی، کلید خارجی RESTRICT و indexهای دسته/وضعیت/جستجوی prefix را می‌سازد.
- `0003_customers.sql` جدول مستقل `customers` را با UUID، فیلدهای nullable، وضعیت پیش‌فرض فعال، timestampهای `timestamptz`، checkهای نام/شماره و indexهای وضعیت/شماره ایجاد می‌کند؛ شماره تماس unique نیست.
- اجرای migration: `npm run db:migrate`.
- seed توسعهٔ اختیاری و idempotent: `NODE_ENV=development npm run db:seed`. runner seedهای کوچک کاتالوگ و مشتری را اجرا می‌کند و در محیط‌های دیگر رد می‌شود.
- تست واقعی محدودیت‌ها و migrationها: `npm run test:database` با PostgreSQL مجزا و `DATABASE_URL` معتبر.

نقش دیتابیس اجراکننده به مجوز ساخت schema و جدول tracking نیاز دارد؛ تست یکپارچه را روی دیتابیس اختصاصی/آزمایشی اجرا کنید.

## قراردادهای مشترک

- TypeScript با strict mode؛ typeهای مشترک در `@bazariya/shared` قرار می‌گیرند.
- نام‌گذاری: کلاس/کامپوننت `PascalCase`، متغیر و تابع `camelCase`، نام route/file در UI `kebab-case` و نام جدول/ستون SQL `snake_case` است.
- متغیرهای موردنیاز در `.env.example` مستند می‌شوند؛ `.env` محلی commit نمی‌شود.
- timestampها در PostgreSQL با `timestamptz` و به UTC نگهداری می‌شوند.

## موارد خارج از محدوده

ورود/کاربر/نقش، tenant و RLS، انبار و موجودی یا گردش آن، سفارش و فروش، خرید و تأمین‌کننده، فاکتور، حسابداری، قیمت‌گذاری پیشرفته، GPS و گزارش‌های عملیاتی در Phase 3 ساخته نشده‌اند و جدول/API دامنه‌ای برایشان اضافه نشده است. `purchasePrice` فقط یک فیلد پایهٔ اختیاری محصول است و هیچ منطق خرید یا سودی ندارد. اعداد داشبورد دادهٔ عملیاتی نیستند.
