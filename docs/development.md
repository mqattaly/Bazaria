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

API بدون اتصال اولیه به PostgreSQL می‌تواند بالا بیاید؛ endpoint سلامت یک `SELECT 1` می‌زند و هنگام در دسترس نبودن DB پاسخ `503` با قرارداد خطای مشترک می‌دهد. برای مدیریت کاتالوگ، مشتریان، سفارش‌ها و موجودی، API و PostgreSQL باید در دسترس باشند.

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

`npm run db:migrate` از `DATABASE_URL` می‌خواند و migrationهای مرتب‌شدهٔ انجام‌نشده را اجرا می‌کند؛ `0001_foundation_schema.sql` schema پایه را می‌سازد، `0002_product_categories.sql` جدول‌ها و constraintهای محصول/دسته‌بندی را اضافه می‌کند، `0003_customers.sql` جدول مستقل مشتری را می‌سازد، `0004_orders.sql` جدول‌های سفارش و اقلام را با snapshotها و constraintهای چرخهٔ عمر می‌سازد و `0005_inventory.sql` جدول موجودی و گردش‌ها را اضافه می‌کند. migrationها با advisory lock و transaction ثبت می‌شوند.

seed اختیاری فقط وقتی `NODE_ENV=development` است اجرا می‌شود. `database/seeds/0001_phase2_catalog.sql` چهار دسته و شش محصول، `database/seeds/0002_phase3_customers.sql` سه مشتری و `database/seeds/0003_phase5_inventory.sql` موجودی و گردش نمونهٔ محصولات را idempotent می‌سازند؛ seed سفارش اضافه نشده است. runner این SQLها را فقط در مسیر توسعه و در یک transaction اجرا می‌کند. جزئیات در [`database/seeds/README.md`](../database/seeds/README.md) است.

تست دیتابیس migrationها و constraintهای PostgreSQL (از جمله constraintهای کاتالوگ/Customer/Order و موجودی نامنفی یکتا، نوع/مقدار و snapshotهای سازگار، immutability گردش و FKهای نگهدارندهٔ تاریخچه) را روی دیتابیس مقصد بررسی می‌کند. تست روی transactionهای rollbackشونده انجام می‌شود؛ حتماً یک دیتابیس اختصاصی برای تست انتخاب کنید:

```bash
DATABASE_URL=postgresql://USER:PASSWORD@localhost:5432/bazariya_test npm run test:database
```

## API کاتالوگ، مشتریان، سفارش‌ها و موجودی

پیشوند همهٔ مسیرها `/api/v1` است. مدل/DTOهای مشترک و محدودیت‌ها در `packages/shared` هستند؛ ماژول‌های Nest کاتالوگ در `apps/api/src/catalog`، Customer در `apps/api/src/customers`، Order در `apps/api/src/orders` و Inventory در `apps/api/src/inventory` قرار دارند.

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
| `DELETE` | `/products/:id` | حذف محصول پس از تأیید UI؛ در صورت داشتن سابقهٔ گردش موجودی با `409 PRODUCT_HAS_STOCK_HISTORY` رد می‌شود |
| `GET` | `/customers` | فهرست مشتریان با جستجو، فیلتر وضعیت و صفحه‌بندی |
| `POST` | `/customers` | ساخت مشتری |
| `GET` | `/customers/:id` | جزئیات مشتری |
| `PATCH` | `/customers/:id` | ویرایش partial؛ nullableها با `null` پاک می‌شوند |
| `DELETE` | `/customers/:id` | حذف مشتری؛ reference سفارش‌های قبلی در صورت وجود `NULL` می‌شود |
| `GET` | `/orders` | فهرست با جستجو، وضعیت، مشتری، بازهٔ زمانی و صفحه‌بندی |
| `POST` | `/orders` | ثبت transactional پیش‌نویس و اقلام با قیمت/فیلدهای snapshot سمت سرور |
| `GET` | `/orders/:id` | جزئیات سفارش و snapshot اقلام |
| `PATCH` | `/orders/:id` | ویرایش فقط پیش‌نویس |
| `PATCH` | `/orders/:id/status` | تأیید یا لغو؛ لغو سابقه را نگه می‌دارد و endpoint حذف وجود ندارد |
| `GET` | `/inventory` | فهرست موجودی با جستجوی نام/SKU، وضعیت و صفحه‌بندی |
| `GET` | `/inventory/:productId` | جزئیات موجودی؛ محصول غیرفعال نیز قابل مشاهده است |
| `PATCH` | `/inventory/:productId/minimum` | تغییر حداقل موجودی بدون ایجاد گردش |
| `POST` | `/inventory/:productId/movements` | ثبت اتمیک IN، OUT یا ADJUSTMENT |
| `GET` | `/inventory/:productId/movements` | تاریخچهٔ صفحه‌بندی‌شده با فیلتر نوع/زمان |

برای فهرست محصولات، `search` trim و روی ابتدای نام/SKU جستجو می‌شود، `categoryId` و `isActive` فیلتر اختیاری‌اند؛ `page`/`pageSize` پیش‌فرض ۱/۲۰، سقف page برابر 2,147,483,647 و سقف pageSize برابر ۱۰۰ است. SKU پس از trim به uppercase نرمال می‌شود و قیمت‌های API عدد صحیح غیرمنفی Toman هستند.

برای فهرست مشتریان، جستجوی parameterized روی نام/شماره/ایمیل و فیلتر اختیاری `isActive` وجود دارد؛ صفحه‌بندی پیش‌فرض ۱/۲۰ و `pageSize` حداکثر ۱۰۰ است. نام trim و محدود، phone و email اختیاری‌اند؛ phone با قالب موبایل یا تلفن ثابت ایران اعتبارسنجی و email trim/lowercase و اعتبارسنجی می‌شود. PATCH بدنهٔ خالی را رد می‌کند و nullableها را با `null` پاک می‌کند. Customer مستقل از Product و Category است. همهٔ پاسخ‌ها از envelope مشترک `data` یا `error` استفاده می‌کنند.

برای سفارش‌ها، بدنهٔ `POST` فقط `customerId?`, `items[{ productId, quantity }]`, `discount?` و `note?` را می‌پذیرد؛ قیمت، جمع، وضعیت یا فیلد ناشناخته از کلاینت پذیرفته نمی‌شود. تخفیف و مبلغ‌ها عدد صحیح تومان‌اند، تخفیف از subtotal بیشتر نیست و ردیف محصول تکراری ادغام می‌شود. Customer اختیاری اما در صورت انتخاب باید فعال باشد؛ محصولات باید هنگام ثبت/به‌روزرسانی اقلام فعال باشند. `PATCH /orders/:id` فقط پیش‌نویس را ویرایش می‌کند؛ `PATCH /orders/:id/status` draft را تأیید/لغو و confirmed را لغو می‌کند. timestampها UTC هستند؛ فیلتر datetime در UI به‌وقت `Asia/Tehran` تفسیر و به UTC تبدیل می‌شود، و `from`/`to` در API باید ISO-8601 با timezone صریح مانند `2026-09-01T00:00:00+03:30` باشند. پیش‌فرض صفحه‌بندی ۱/۲۰ و سقف `pageSize` برابر ۱۰۰ است.

برای Inventory، `GET /inventory` از `search`, `status`, `lowStock`, `page`, `pageSize` پشتیبانی می‌کند. `out-of-stock` از `low-stock` جداست؛ فیلتر `status=low-stock` موجودی مثبت تا حداقل را می‌گیرد و `lowStock=true` صفر را نیز شامل می‌شود. صفر با حداقل صفر همچنان `isLowStock=true` است.

در بدنهٔ `POST /inventory/:productId/movements`، `IN` و `OUT` مقدار صحیح مثبت می‌خواهند؛ `OUT` بیش از موجودی با `409 INSUFFICIENT_STOCK` رد می‌شود. در `ADJUSTMENT` مقدار `quantity` موجودی نهایی (صفر هم مجاز است) است؛ سرور before/after و delta تاریخچه را می‌سازد. Inventory با Product فقط reference دارد و به Order وصل نیست؛ تغییر وضعیت سفارش، موجودی را کم نمی‌کند. movement update/delete endpoint ندارد و trigger دیتابیس تاریخچه را immutable نگه می‌دارد. محصول غیرفعال قابل مشاهده اما از حرکت جدید منع می‌شود.

## تست، lint و build

```bash
npm run lint
npm run typecheck
npm test
npm run test:database
npm run build
npm run test:phase0
```

`npm test` شامل تست‌های HTTP API و محاسبات سفارش/موجودی (بدون PostgreSQL)، تست transaction repository موجودی با client کنترل‌شده، تست CRUD کاتالوگ/مشتری، صفحه‌های سفارش و موجودی، جستجو/فیلتر/صفحه‌بندی/جهش‌های موفق و خطا، و تست اجزای UI است. `npm run test:database` تست واقعی یکپارچگی با PostgreSQL است و به `DATABASE_URL` نیاز دارد. `npm run test:phase0` دستور سازگاری قبلی برای lint/typecheck/tests/database/build است.

## نکات توسعه

- هر دامنه در ماژول خود بماند؛ controller محل انباشتن منطق کسب‌وکار نیست و CRUD generic اضافه نکنید.
- هر تغییر schema باید migration مستقل، نسخه‌بندی‌شده و قابل‌تکرار داشته باشد.
- ورودی کلاینت معتبر فرض نمی‌شود؛ DTO باید فیلدهای ناشناخته را رد کند و queryهای متغیردار با placeholderهای `pg` پارامتری باشند.
- Customer از Product و Category مستقل است؛ رابطهٔ اختیاری Order با Customer در خود دامنهٔ Order نگهداری می‌شود. Inventory مالک مقدار، حداقل و StockMovement است و Product فقط مرجع آن است؛ Order هیچ تغییری در موجودی ایجاد نمی‌کند. منطق خرید، چندانباره‌بودن، تأمین‌کننده، پرداخت، حسابداری، تحویل، رزرو/ارزش‌گذاری، وفاداری و گزارش‌های پیشرفته خارج از محدوده می‌مانند.
- مؤلفه‌های UI باید از توکن‌های معنایی، label/error مرتبط، focus قابل‌مشاهده و ویژگی‌های دسترس‌پذیری استفاده کنند. دادهٔ داشبورد را با اطلاعات واقعی کاتالوگ اشتباه نگیرید.
