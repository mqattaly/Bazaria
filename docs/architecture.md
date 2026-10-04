# معماری بازاریا

## محدودهٔ فعلی

مخزن زیرساخت Phase 0، بنیاد رابط کاربری Phase 1، دامنهٔ محدود کاتالوگ Phase 2، مدیریت مستقل مشتریان Phase 3، مدیریت سفارش‌ها در Phase 4 و Inventory/گردش موجودی در Phase 5 را پیاده‌سازی می‌کند. **Product** و **Category تخت**، **Customer**، **Order/OrderItem** و **Inventory/StockMovement** دامنه‌های مستقل‌اند؛ داشبورد عمدتاً mock است و ورود واقعی یا احراز هویت وجود ندارد.

## Stack و مرزبندی

```text
apps/
  web/       React + TypeScript + Vite؛ پوستهٔ فارسی/RTL، کاتالوگ، مشتریان، سفارش‌ها و موجودی
  api/       NestJS + TypeScript؛ REST API ماژولار
packages/
  shared/    قراردادهای TypeScript و انواع مشترک
  config/    تنظیمات پایهٔ TypeScript
 database/
  migrations/ SQLهای نسخه‌بندی‌شده
  seeds/       دادهٔ توسعهٔ اختیاری برای کاتالوگ، مشتریان و موجودی
 docker/
  compose.yml  PostgreSQL محلی برای توسعه
```

وب فقط از URLهای نسبی مانند `/api/v1/health` استفاده می‌کند. Vite در توسعه درخواست `/api` را به API proxy می‌کند؛ کد اجراشده در مرورگر به `localhost` یا سرویس دیگری روی loopback وصل نمی‌شود.

## رابط کاربری

- `apps/web/src/styles.css` توکن‌های معنایی رنگ و حالت روشن/تیره را تعریف می‌کند. `ThemeProvider` انتخاب تم را در مرورگر نگه می‌دارد.
- قلم Vazirmatn Variable محلی است و آیکون‌های پایه SVGهای درون‌برنامه‌ای‌اند.
- `components/layout/` پوستهٔ واکنش‌گرا، سربرگ و ناوبری دسکتاپ/موبایل را دارد؛ `components/ui/` primitives دسترس‌پذیر و RTL-aware را فراهم می‌کند.
- `/products` فهرست قابل جستجو، فیلتر و صفحه‌بندی‌شده، `/products/:id` جزئیات و `/categories` مدیریت دسته‌ها را نمایش می‌دهند. فرم‌ها و تأیید حذف به API وصل‌اند؛ قیمت فقط برای نمایش به قالب فارسی تومان تبدیل می‌شود.
- `/customers` فهرست واکنش‌گرا، جستجو/فیلتر، فرم ایجاد/ویرایش و تأیید حذف را دارد؛ `/customers/:id` فقط اطلاعات پایه و timestampهای همان مشتری را نشان می‌دهد. Customer از Product و Category مستقل است؛ تنها Order مالک رابطهٔ اختیاری خود با Customer است.
- `/orders` فهرست جستجو/فیلتر/صفحه‌بندی‌شده و واکنش‌گرا، `/orders/new` فرم سفارش، و `/orders/:id` جزئیات و مدیریت وضعیت را نمایش می‌دهند. سفارش پیش‌نویس قابل ویرایش است؛ تأییدشده فقط قابل لغو و لغوشده immutable است. انتخاب مشتری اختیاری و انتخاب محصول قابل جستجو است؛ جزئیات/قیمت محصول هنگام ثبت در سرور snapshot می‌شوند. فیلترهای datetime UI به‌وقت Asia/Tehran تعبیر و به ISO UTC تبدیل می‌شوند؛ تاریخ‌های نمایشی با تقویم فارسی در همین منطقهٔ زمانی قالب‌بندی می‌شوند.
- `/inventory` موجودی را با جستجوی نام/SKU، وضعیت جداگانهٔ کم‌موجودی/ناموجود و صفحه‌بندی نشان می‌دهد؛ `/inventory/:productId` حداقل موجودی، عملیات سریع ورود/خروج/اصلاح و سابقهٔ صفحه‌بندی‌شده با snapshot قبل/بعد را ارائه می‌کند. صفحه‌ها فارسی، RTL و واکنش‌گرا هستند؛ محصول غیرفعال قابل مشاهده است اما ثبت گردش جدید برایش غیرفعال می‌شود. آستانهٔ کم‌موجودی با حداقل برابر هم فعال است.
- داشبورد در `features/dashboard/` قرار دارد؛ میانبر موجودی به `/inventory` می‌رود. KPIهای باقی‌مانده و فعالیت‌ها صرفاً mock/نمایشی‌اند و موجودی عملیاتی در داشبورد گزارش یا KPI ندارد.
- `/login` placeholder است و هیچ احراز هویتی انجام نمی‌دهد.

## دامنه‌های Product، Category، Customer، Order، Inventory و REST API

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
- Customer جدول و ماژول API مستقلی دارد و به Product یا Category وابسته نیست. Order مالک رابطهٔ اختیاری خود با Customer است؛ حذف مشتری فقط `customer_id` سفارش را `NULL` می‌کند و سابقهٔ سفارش باقی می‌ماند.

### Order و OrderItem

- مسیرها: `GET /orders`, `POST /orders`, `GET /orders/:id`, `PATCH /orders/:id` و `PATCH /orders/:id/status`؛ همه زیر `/api/v1` هستند. حذف HTTP برای سفارش ارائه نمی‌شود؛ لغو مسیر نگهداری سابقه است.
- هر سفارش شمارهٔ یکتای سرورساخت (`BAZ-...`)، وضعیت `draft`/`confirmed`/`cancelled`، زمان‌های `timestamptz` و مبالغ صحیح Toman دارد. ثبت سفارش و ردیف‌ها در یک transaction انجام می‌شود.
- Customer اختیاری و در صورت انتخاب باید موجود و فعال باشد. Productها باید موجود و فعال باشند؛ ردیف‌های تکراری محصول در سمت سرور ادغام می‌شوند و محصول با کلید خارجی `ON DELETE RESTRICT` قابل حذف نیست.
- `OrderItem` نام محصول، SKU، واحد و قیمت فروش فعلی را به‌عنوان snapshot نگه می‌دارد. مبلغ هر ردیف و جمع سفارش در سمت سرور از `quantity × unitPrice` محاسبه و به محدودهٔ `Number.MAX_SAFE_INTEGER` محدود می‌شوند. تخفیف یک عدد صحیح نامنفی برای کل سفارش است و از subtotal بیشتر نمی‌شود.
- پیش‌نویس قابل ویرایش است؛ تأیید، پیش‌نویس را immutable می‌کند و لغو فقط وضعیت را تغییر می‌دهد. سفارش تأییدشده قابل لغو است و سفارش لغوشده immutable می‌ماند. اقلام فقط در حالت پیش‌نویس تغییر/حذف می‌شوند؛ cascade حذف اقلام فقط با حذف سفارش پیش‌نویس مجاز است. حذف Customer باعث `SET NULL` می‌شود و snapshotهای محصول باقی می‌مانند.
- فهرست از `search`, `customerId`, `status`, `from`, `to`, `page` و `pageSize` پشتیبانی می‌کند. جستجو شمارهٔ سفارش، مشتری و snapshot نام/SKU را می‌پوشاند؛ صفحه‌بندی مانند Phase 2/3 پیش‌فرض ۱/۲۰ و سقف اندازهٔ صفحه ۱۰۰ است. `from` و `to` باید ISO-8601 همراه offset صریح (`Z` یا `±HH:MM`) باشند؛ ورودی‌ها به UTC normalize می‌شوند و timezone ضمنی از سرور پذیرفته نمی‌شود.

### Inventory و StockMovement

- Inventory دامنه‌ای مستقل از Product، Order و Customer است. هر محصول یک رکورد موجودی دارد؛ محصول جدیدی که هنوز رکوردی ندارد در خواندن‌ها موجودی و حداقل صفر دارد. migration رکورد صفر را برای محصولات موجود ایجاد می‌کند. موجودی عدد صحیح نامنفی است و منطق تغییر آن در Product یا Order قرار ندارد.
- مسیرها: `GET /inventory`, `GET /inventory/:productId`, `PATCH /inventory/:productId/minimum`, `POST /inventory/:productId/movements` و `GET /inventory/:productId/movements`.
- فهرست موجودی جستجوی پارامتری نام/SKU، `status` (`in-stock`, `low-stock`, `out-of-stock`)، `lowStock`، `page` و `pageSize` را می‌پذیرد. `status=low-stock` فقط موجودی مثبت تا حداقل را می‌گیرد تا با ناموجود جدا بماند؛ `lowStock=true` شامل موجودی صفر نیز هست. وضعیت zero همیشه `out-of-stock` است؛ `isLowStock` برای `quantity <= minimumQuantity` محاسبه می‌شود، بنابراین صفر با حداقل صفر نیز کم‌موجودی است.
- جزئیات برای Product غیرفعال قابل خواندن است؛ فقط Product فعال اجازهٔ گردش جدید دارد. `PATCH .../minimum` فقط آستانه را تغییر می‌دهد و movement نمی‌سازد.
- `IN` و `OUT` تعداد صحیح مثبت می‌گیرند؛ `OUT` بیش از موجودی با `409 INSUFFICIENT_STOCK` رد می‌شود. `ADJUSTMENT.quantity` موجودی نهایی و صحیح نامنفی (از جمله صفر) است، نه delta ورودی. سرور before/after را محاسبه می‌کند و برای adjustment، quantity تاریخچه برابر قدرمطلق اختلاف قبل/بعد ذخیره می‌شود. کلاینت نمی‌تواند snapshot ارسال کند.
- درج StockMovement و به‌روزرسانی موجودی در یک transaction انجام می‌شوند: ردیف Product با `FOR SHARE` و ردیف Inventory با `FOR UPDATE` قفل می‌شوند؛ rollback در صورت خطا هر دو تغییر را برمی‌گرداند. Order تغییر موجودی انجام نمی‌دهد.
- تاریخچه با فیلتر اختیاری `type`, `from`, `to` و صفحه‌بندی برمی‌گردد. زمان‌های فیلتر باید ISO-8601 با timezone صریح باشند. before/after، نوع، مقدار و یادداشت رویداد برای همیشه نگهداری می‌شوند و API/trigger دیتابیس اجازهٔ ویرایش یا حذف تاریخچه را نمی‌دهد.

### قرارداد پاسخ و خطا

- پاسخ موفق: `{ "data": ... }` و برای فهرست‌های صفحه‌بندی‌شدهٔ محصولات، مشتریان، سفارش‌ها، Inventory و StockMovement، `items` و `pagination` درون `data` قرار دارند.
- پاسخ خطا: `{ "error": { "code": "...", "message": "...", "details": [...] } }`.
- خطاهای تکراری نام/SKU، دستهٔ نامعتبر، دستهٔ وابسته به محصول، اعتبارسنجی مشتری و not-found به status/code مشخص و پیام امن نگاشت می‌شوند؛ SQL، stack trace و جزئیات اتصال به کلاینت نشت نمی‌کند.
- اعتبارسنجی HTTP با `ValidationPipe` و گزینه‌های `whitelist`, `forbidNonWhitelisted`, `transform` انجام می‌شود. CORS با `WEB_ORIGIN` محدود است و Helmet headerهای امنیتی را تنظیم می‌کند.

## PostgreSQL و migrationها

اتصال برنامه از `DATABASE_URL` و `pg.Pool` می‌آید؛ ORM استفاده نمی‌شود. migrationها در `database/migrations/` با الگوی `NNNN_description.sql` نگهداری می‌شوند. اجراکننده برای اجرای هم‌زمان advisory lock می‌گیرد و هر migration/ثبت نسخه را در transaction اعمال می‌کند.

- `0001_foundation_schema.sql` schema برنامهٔ `bazariya` و جدول پیگیری migrationها را ایجاد می‌کند.
- `0002_product_categories.sql` جدول‌های `categories` و `products`، UUIDها، محدودیت یکتایی نام case-insensitive و SKU canonical، checkهای واحد و قیمت صحیح غیرمنفی، کلید خارجی RESTRICT و indexهای دسته/وضعیت/جستجوی prefix را می‌سازد.
- `0003_customers.sql` جدول مستقل `customers` را با UUID، فیلدهای nullable، وضعیت پیش‌فرض فعال، timestampهای `timestamptz`، checkهای نام/شماره و indexهای وضعیت/شماره ایجاد می‌کند؛ شماره تماس unique نیست.
- `0004_orders.sql` sequence شمارهٔ سفارش و جدول‌های `orders`/`order_items`، snapshotهای محصول، FKهای `SET NULL`/`RESTRICT`/draft-only cascade، checkهای وضعیت و مبالغ صحیح، triggerهای immutability و subtotal، و indexهای فهرست سفارش را ایجاد می‌کند.
- `0005_inventory.sql` جدول مستقل `inventory` با PK/FK یکتای Product و حداقل/موجودی صحیح نامنفی، backfill صفر برای محصولات موجود، جدول snapshotمحور `stock_movements` با checkهای نوع/مقدار سازگار، indexهای محدود، trigger تاریخچهٔ immutable و FKهای نگهدارندهٔ تاریخچه را می‌سازد. حذف Product در صورت وجود movement با `RESTRICT` مسدود است؛ اگر تاریخچه‌ای وجود نداشته باشد، ردیف state موجودی با `CASCADE` حذف می‌شود.
- اجرای migration: `npm run db:migrate`.
- seed توسعهٔ اختیاری و idempotent: `NODE_ENV=development npm run db:seed`. runner seedهای کوچک کاتالوگ، مشتری و شش رکورد نمونهٔ Inventory/گردش را در transaction بار می‌کند؛ هیچ seedای در محیط غیرتوسعه‌ای اجرا نمی‌شود.
- تست واقعی محدودیت‌ها و migrationها: `npm run test:database` با PostgreSQL مجزا و `DATABASE_URL` معتبر؛ تست Inventory defaults/یکتایی، مرزهای stock، سازگاری snapshotها، immutability تاریخچه، FKهای Product و cascade state را نیز بررسی می‌کند.

نقش دیتابیس اجراکننده به مجوز ساخت schema و جدول tracking نیاز دارد؛ تست یکپارچه را روی دیتابیس اختصاصی/آزمایشی اجرا کنید.

## قراردادهای مشترک

- TypeScript با strict mode؛ typeهای مشترک در `@bazariya/shared` قرار می‌گیرند.
- نام‌گذاری: کلاس/کامپوننت `PascalCase`، متغیر و تابع `camelCase`، نام route/file در UI `kebab-case` و نام جدول/ستون SQL `snake_case` است.
- متغیرهای موردنیاز در `.env.example` مستند می‌شوند؛ `.env` محلی commit نمی‌شود.
- timestampها در PostgreSQL با `timestamptz` و به UTC نگهداری می‌شوند.

## موارد خارج از محدوده

ورود/کاربر/نقش، tenant و RLS، چندانباره‌بودن و مدیریت انبار فیزیکی، خرید و تأمین‌کننده، پرداخت/مانده‌حساب، حسابداری، تحویل، رزرو، ارزش‌گذاری، وفاداری، تخفیف‌های پیچیده، GPS و گزارش‌های پیشرفته خارج از Phase 5 هستند و جدول/API دامنه‌ای برایشان اضافه نشده است. Inventory فقط مقدار فعلی، حداقل و گردش‌های دستی مستقل را مدیریت می‌کند؛ سفارش موجودی را تغییر نمی‌دهد. `purchasePrice` فقط فیلد پایهٔ اختیاری محصول است و هیچ منطق خرید یا سودی ندارد. اعداد/فعالیت‌های باقی‌ماندهٔ داشبورد دادهٔ عملیاتی نیستند و KPI موجودی ندارد.
