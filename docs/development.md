# راهنمای توسعه

## نیازمندی‌ها

- Node.js `22.22.3+` و npm `10.9+` (`.nvmrc` نسخهٔ پیشنهادی را مشخص می‌کند).
- Docker Compose برای اجرای PostgreSQL محلی؛ یا یک PostgreSQL در دسترس با مجوز ساخت schema و جدول.

## نصب و اجرای محلی

از ریشهٔ repository اجرا کنید:

```bash
npm install
cp .env.example .env
docker compose -f docker/compose.yml up -d
npm run db:migrate
NODE_ENV=development npm run db:seed  # اختیاری
npm run dev
```

Vite روی `0.0.0.0:5173` و NestJS روی `0.0.0.0:3001` گوش می‌دهند. صفحهٔ وب را در `http://localhost:5173` و endpoint سلامت را در `http://localhost:3001/api/v1/health` ببینید. Vite درخواست‌های `/api/*` را به مقدار `VITE_API_PROXY_TARGET` می‌فرستد. برای مشاهدهٔ صرف پوستهٔ RTL و داشبورد mock، `npm run dev:web` کافی است و به PostgreSQL نیاز ندارد؛ نشانگر اتصال API بدون API در دسترس آفلاین می‌ماند.

API بدون اتصال اولیه به PostgreSQL می‌تواند بالا بیاید؛ endpoint سلامت یک `SELECT 1` می‌زند و هنگام در دسترس نبودن DB پاسخ `503` با قرارداد خطای مشترک می‌دهد. برای مدیریت کاتالوگ، API و PostgreSQL باید در دسترس باشند.

## متغیرهای محیطی

کپی `.env.example` به `.env` را برای توسعهٔ محلی انجام دهید. متغیرهای اصلی:

| متغیر | کاربرد |
| --- | --- |
| `NODE_ENV` | حالت اجرا؛ `development`, `test` یا `production` |
| `API_PORT` | پورت API (پیش‌فرض `3001`) |
| `DATABASE_URL` | URL اتصال PostgreSQL |
| `WEB_ORIGIN` | origin مجاز برای CORS |
| `VITE_API_PROXY_TARGET` | مقصد proxy سمت Vite، نه URL مورد استفادهٔ مرورگر |
| `POSTGRES_*` | تنظیمات سرویس PostgreSQL در Compose |

مقادیر `.env.example` فقط برای توسعهٔ محلی‌اند و نباید برای محیط مشترک/production استفاده شوند.

## Migration و seed

```bash
npm run db:migrate
NODE_ENV=development npm run db:seed
```

`npm run db:migrate` از `DATABASE_URL` می‌خواند و migrationهای مرتب‌شدهٔ انجام‌نشده را اجرا می‌کند؛ `0001_foundation_schema.sql` schema پایه را می‌سازد و `0002_product_categories.sql` جدول‌ها و constraintهای محصول/دسته‌بندی را اضافه می‌کند. migrationها با advisory lock و transaction ثبت می‌شوند.

seed اختیاری فقط وقتی `NODE_ENV=development` است اجرا می‌شود. فایل SQL idempotent در `database/seeds/0001_phase2_catalog.sql` چهار دسته و شش محصول نمونه می‌سازد؛ برای محیط‌های غیرتوسعه‌ای نیست و هیچ دامنهٔ دیگری را seed نمی‌کند. جزئیات در [`database/seeds/README.md`](../database/seeds/README.md) است.

تست دیتابیس migrationها و constraintهای PostgreSQL (از جمله یکتایی canonical SKU و نام، قیمت صحیح غیرمنفی، واحد مجاز و محدودیت حذف دستهٔ وابسته) را روی دیتابیس مقصد بررسی می‌کند. حتماً یک دیتابیس اختصاصی و قابل‌پاک‌سازی برای تست انتخاب کنید:

```bash
DATABASE_URL=postgresql://USER:PASSWORD@localhost:5432/bazariya_test npm run test:database
```

## API کاتالوگ

پیشوند همهٔ مسیرها `/api/v1` است. مدل/DTOهای مشترک و محدودیت‌ها در `packages/shared` و ماژول‌های Nest در `apps/api/src/catalog` هستند.

| روش | مسیر | شرح |
| --- | --- | --- |
| `GET` | `/categories` | فهرست دسته‌ها و تعداد محصولات وابسته |
| `POST` | `/categories` | ساخت دسته |
| `GET` | `/categories/:id` | دریافت دسته |
| `PATCH` | `/categories/:id` | ویرایش مجاز فیلدها |
| `DELETE` | `/categories/:id` | حذف دستهٔ بدون محصول؛ در غیر این‌صورت `409` |
| `GET` | `/products` | فهرست جستجو/فیلتر/صفحه‌بندی‌شده |
| `POST` | `/products` | ساخت محصول |
| `GET` | `/products/:id` | جزئیات محصول |
| `PATCH` | `/products/:id` | ویرایش مجاز فیلدها |
| `DELETE` | `/products/:id` | حذف محصول پس از تأیید UI |

برای فهرست محصولات، `search` trim و روی ابتدای نام/SKU جستجو می‌شود، `categoryId` و `isActive` فیلتر اختیاری‌اند؛ `page`/`pageSize` پیش‌فرض ۱/۲۰، سقف page برابر ۲٬۱۴۷٬۴۸۳٬۶۴۷ و سقف pageSize برابر ۱۰۰ است. SKU پس از trim به uppercase نرمال می‌شود و قیمت‌های API عدد صحیح غیرمنفی Toman هستند. همهٔ پاسخ‌ها از envelope مشترک `data` یا `error` استفاده می‌کنند.

## تست، lint و build

```bash
npm run lint
npm run typecheck
npm test
npm run test:database
npm run build
npm run test:phase0
```

`npm test` شامل تست‌های HTTP API برای قراردادها و CRUD کاتالوگ (با repository حافظه‌ای، بدون PostgreSQL)، تست صفحه‌ها/فرم‌های وب با Testing Library و تست اجزای UI است. `npm run test:database` تست واقعی یکپارچگی با PostgreSQL است و به `DATABASE_URL` نیاز دارد. `npm run test:phase0` دستور سازگاری قبلی برای lint/typecheck/tests/database/build است.

## نکات توسعه

- هر دامنه در ماژول خود بماند؛ controller محل انباشتن منطق کسب‌وکار نیست و CRUD generic اضافه نکنید.
- هر تغییر schema باید migration مستقل، نسخه‌بندی‌شده و قابل‌تکرار داشته باشد.
- ورودی کلاینت معتبر فرض نمی‌شود؛ DTO باید فیلدهای ناشناخته را رد کند و queryهای متغیردار با placeholderهای `pg` پارامتری باشند.
- دامنهٔ Phase 2 به Product و Category تخت محدود است؛ منطق خرید، سود، فروش، مشتری، موجودی، حسابداری و دیگر حوزه‌ها در این فاز اضافه نمی‌شوند.
- مؤلفه‌های UI باید از توکن‌های معنایی، label/error مرتبط، focus قابل‌مشاهده و ویژگی‌های دسترس‌پذیری استفاده کنند. دادهٔ داشبورد را با اطلاعات واقعی کاتالوگ اشتباه نگیرید.
