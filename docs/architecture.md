# معماری بازاریا

## محدودهٔ فعلی

مخزن زیرساخت Phase 0، بنیاد رابط کاربری Phase 1، کاتالوگ Phase 2، Customer در Phase 3، Order در Phase 4، Inventory در Phase 5 و Suppliers & Purchasing در Phase 6 را پیاده‌سازی می‌کند. **Product**، **Category تخت**، **Customer**، **Order/OrderItem**، **Inventory/StockMovement**، **Supplier** و **Purchase/PurchaseItem** دامنه‌های مستقل‌اند؛ داشبورد عمدتاً mock است و ورود واقعی یا احراز هویت وجود ندارد.

## Stack و مرزبندی

```text
apps/
  web/       React + TypeScript + Vite؛ پوستهٔ فارسی/RTL، کاتالوگ، مشتریان، سفارش‌ها، موجودی و خرید
  api/       NestJS + TypeScript؛ REST API ماژولار
packages/
  shared/    قراردادهای TypeScript و انواع مشترک
  config/    تنظیمات پایهٔ TypeScript
 database/
  migrations/ SQLهای نسخه‌بندی‌شده
  seeds/       دادهٔ توسعهٔ اختیاری برای کاتالوگ، مشتریان، موجودی و خرید
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
- `/suppliers` و `/suppliers/:id` مدیریت تماس و وضعیت تأمین‌کنندگان را با جستجو، فیلتر و صفحه‌بندی فراهم می‌کنند. `/purchases`, `/purchases/new` و `/purchases/:id` خریدها را در رابط فارسی/RTL ثبت و پیگیری می‌کنند؛ پیش‌نویس قابل ویرایش/لغو است و تأیید با هشدار افزایش موجودی انجام می‌شود. فیلتر تاریخ به‌وقت `Asia/Tehran` تبدیل می‌شود؛ snapshot محصول و مبالغ نهایی از API نمایش داده می‌شوند.
- داشبورد در `features/dashboard/` قرار دارد؛ میانبر موجودی به `/inventory` می‌رود. KPIها و فعالیت‌ها صرفاً mock/نمایشی‌اند؛ KPI عملیاتی موجودی، خرید یا تأمین‌کننده اضافه نشده است.
- `/login` placeholder است و هیچ احراز هویتی انجام نمی‌دهد.

## دامنه‌های Product، Category، Customer، Order، Inventory، Supplier، Purchase و REST API

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
- updateها فقط فیلدهای مجاز DTO را می‌پذیرند؛ فیلد ناشناخته رد می‌شود. شناسهٔ دسته باید به دستهٔ موجود اشاره کند. Product دارای سابقهٔ StockMovement یا PurchaseItem قابل حذف نیست؛ API خطای کنترل‌شدهٔ مربوط به تاریخچه را برمی‌گرداند.

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

### Supplier، Purchase و PurchaseItem (Phase 6)

- مسیرهای Supplier: `GET/POST /suppliers`, `GET/PATCH/DELETE /suppliers/:id`, و `PATCH /suppliers/:id/status`. `name` الزامی است؛ تلفن، ایمیل، آدرس و یادداشت اختیاری/nullable هستند. فهرست جستجوی نام/تلفن/ایمیل، فیلتر وضعیت فعال/غیرفعال و صفحه‌بندی را دارد. تأمین‌کننده دارای Purchase history hard-delete نمی‌شود و پاسخ `409 SUPPLIER_HAS_PURCHASE_HISTORY` می‌گیرد؛ غیرفعال‌سازی مسیر حفظ سابقه است.
- مسیرهای Purchase: `GET/POST /purchases`, `GET/PATCH /purchases/:id`, `PATCH /purchases/:id/status`. فهرست از جستجوی شمارهٔ خرید/نام تأمین‌کننده، `supplierId`, `status`, `from`, `to`, `page` و `pageSize` پشتیبانی می‌کند. `from` و `to` باید ISO-8601 با timezone صریح باشند و در PostgreSQL به‌صورت `timestamptz` مقایسه می‌شوند.
- شمارهٔ یکتای `PUR-...` با sequence سرور ساخته می‌شود. وضعیت‌ها فقط `draft`, `confirmed`, `cancelled` هستند: draft ویرایش‌پذیر است و می‌تواند confirmed یا cancelled شود؛ هر دو وضعیت نهایی immutable هستند. endpoint حذف Purchase وجود ندارد و trigger دیتابیس hard-delete را نیز رد می‌کند. لغو draft هیچ StockMovement ایجاد نمی‌کند؛ confirmed قابل لغو نیست.
- تأمین‌کننده باید فعال و محصولات در زمان ایجاد/ویرایش قلم و تأیید فعال باشند. `PurchaseItem` نام، SKU و واحد Product را هنگام افزودن همان محصول برای نخستین‌بار snapshot می‌کند؛ ویرایش پیش‌نویس snapshot قلم موجود را حفظ می‌کند و فقط محصول تازه‌افزوده‌شده snapshot تازه می‌گیرد. قیمت واحد و تخفیف ورودی عدد صحیح safe و نامنفی تومان‌اند؛ قیمت/تعداد/مبالغ ردیف، subtotal، total و purchase number سمت سرور اعتبارسنجی/محاسبه می‌شوند. تخفیف از subtotal بیشتر نیست و کل مبالغ تا `Number.MAX_SAFE_INTEGER` محدودند.
- ردیف تکراری Product با قیمت یکسان به یک قلم و تعداد تجمیع‌شده تبدیل می‌شود؛ قیمت‌های متفاوت برای یک Product در یک درخواست با `DUPLICATE_PRODUCT_PRICE_MISMATCH` رد می‌شوند. قید یکتای `(purchase_id, product_id)` نیز این قاعده را در PostgreSQL پشتیبانی می‌کند.
- تأیید draft در همان transaction دیتابیس قفل ردیف Purchase را می‌گیرد، Supplier و Productهای فعال را اعتبارسنجی می‌کند، از مسیر اتمیک Phase 5 برای هر قلم یک `IN` می‌سازد و یادداشت را با شمارهٔ `PUR-...` مرجع می‌دهد، سپس Purchase را confirmed می‌کند. failure هر حرکت کل transaction را rollback می‌کند؛ درخواست تکراری/هم‌زمان پس از قفل وضعیت نهایی را می‌بیند و نمی‌تواند موجودی را دوباره افزایش دهد. ایجاد و ویرایش Purchase به سیستم Inventory دوم متصل نیست؛ Order همچنان مستقل است و موجودی را تغییر نمی‌دهد.
- `purchase_items.product_id` و `purchases.supplier_id` با `ON DELETE RESTRICT` تاریخچه را نگه می‌دارند؛ حذف Product دارای Purchase history با `409 PRODUCT_HAS_PURCHASE_HISTORY` گزارش می‌شود. قیود و triggerهای دیتابیس draft-only بودن تغییر اقلام، immutability وضعیت نهایی، subtotal و مبالغ سازگار را محافظت می‌کنند.

### قرارداد پاسخ و خطا

- پاسخ موفق: `{ "data": ... }` و برای فهرست‌های صفحه‌بندی‌شدهٔ محصولات، مشتریان، سفارش‌ها، موجودی، Supplier، Purchase و StockMovement، `items` و `pagination` درون `data` قرار دارند.
- پاسخ خطا: `{ "error": { "code": "...", "message": "...", "details": [...] } }`.
- خطاهای تکراری نام/SKU، دستهٔ وابسته، سابقهٔ حذف‌ناپذیر Product/Supplier، وضعیت نامعتبر خرید، اعتبارسنجی و not-found به status/code مشخص و پیام امن نگاشت می‌شوند؛ SQL، stack trace و جزئیات اتصال به کلاینت نشت نمی‌کند.
- اعتبارسنجی HTTP با `ValidationPipe` و گزینه‌های `whitelist`, `forbidNonWhitelisted`, `transform` انجام می‌شود. CORS با `WEB_ORIGIN` محدود است و Helmet headerهای امنیتی را تنظیم می‌کند.

## PostgreSQL و migrationها

اتصال برنامه از `DATABASE_URL` و `pg.Pool` می‌آید؛ ORM استفاده نمی‌شود. migrationها در `database/migrations/` با الگوی `NNNN_description.sql` نگهداری می‌شوند. اجراکننده برای اجرای هم‌زمان advisory lock می‌گیرد و هر migration/ثبت نسخه را در transaction اعمال می‌کند.

- `0001_foundation_schema.sql` schema برنامهٔ `bazariya` و جدول پیگیری migrationها را ایجاد می‌کند.
- `0002_product_categories.sql` جدول‌های `categories` و `products`، UUIDها، محدودیت یکتایی نام case-insensitive و SKU canonical، checkهای واحد و قیمت صحیح غیرمنفی، کلید خارجی RESTRICT و indexهای دسته/وضعیت/جستجوی prefix را می‌سازد.
- `0003_customers.sql` جدول مستقل `customers` را با UUID، فیلدهای nullable، وضعیت پیش‌فرض فعال، timestampهای `timestamptz`، checkهای نام/شماره و indexهای وضعیت/شماره ایجاد می‌کند؛ شماره تماس unique نیست.
- `0004_orders.sql` sequence شمارهٔ سفارش و جدول‌های `orders`/`order_items`، snapshotهای محصول، FKهای `SET NULL`/`RESTRICT`/draft-only cascade، checkهای وضعیت و مبالغ صحیح، triggerهای immutability و subtotal، و indexهای فهرست سفارش را ایجاد می‌کند.
- `0005_inventory.sql` جدول مستقل `inventory` با PK/FK یکتای Product و حداقل/موجودی صحیح نامنفی، backfill صفر برای محصولات موجود، جدول snapshotمحور `stock_movements` با checkهای نوع/مقدار سازگار، indexهای محدود، trigger تاریخچهٔ immutable و FKهای نگهدارندهٔ تاریخچه را می‌سازد.
- `0006_suppliers_purchases.sql` sequence شمارهٔ خرید، Supplier، Purchase و PurchaseItem را می‌سازد؛ مبالغ و snapshotها check می‌شوند، Purchase حذف‌ناپذیر/چرخهٔ عمر محدود دارد، اقلام فقط در draft تغییر می‌کنند و triggerهای deferred جمع اقلام را با subtotal تطبیق می‌دهند. FKهای Supplier/Product تاریخچه را با RESTRICT حفظ می‌کنند.
- اجرای migration: `npm run db:migrate`.
- seed توسعهٔ اختیاری و idempotent: `NODE_ENV=development npm run db:seed`. runner کاتالوگ، مشتری، Inventory/گردش نمونه، دو Supplier و یک پیش‌نویس Purchase را در transaction بار می‌کند؛ هیچ seedای در محیط غیرتوسعه‌ای اجرا نمی‌شود.
- تست واقعی محدودیت‌ها و migrationها: `npm run test:database` با PostgreSQL مجزا و `DATABASE_URL` معتبر؛ تست Inventory defaults/یکتایی، مرزهای stock، immutability، Supplier/Purchase snapshots، status guards و سازگاری جمع اقلام را نیز بررسی می‌کند.

نقش دیتابیس اجراکننده به مجوز ساخت schema و جدول tracking نیاز دارد؛ تست یکپارچه را روی دیتابیس اختصاصی/آزمایشی اجرا کنید.

## قراردادهای مشترک

- TypeScript با strict mode؛ typeهای مشترک در `@bazariya/shared` قرار می‌گیرند.
- نام‌گذاری: کلاس/کامپوننت `PascalCase`، متغیر و تابع `camelCase`، نام route/file در UI `kebab-case` و نام جدول/ستون SQL `snake_case` است.
- متغیرهای موردنیاز در `.env.example` مستند می‌شوند؛ `.env` محلی commit نمی‌شود.
- timestampها در PostgreSQL با `timestamptz` و به UTC نگهداری می‌شوند.

## موارد خارج از محدوده

ورود/کاربر/نقش، tenant و RLS، چندانباره‌بودن و مدیریت انبار فیزیکی، پرداخت/تسویه، حسابداری/بهای تمام‌شده، FIFO/LIFO/میانگین موزون، برگشت خرید، دریافت جزئی، backorder، تأیید چندمرحله‌ای، پرتال تأمین‌کننده، اعلان، GPS و گزارش‌های پیشرفته خارج از Phase 6 هستند و برایشان دامنه یا چارچوب عمومی اضافه نشده است. Purchase فقط خرید ساده با قیمت ثبت‌شده، سه وضعیت محدود و ثبت ورود موجودی در تأیید را مدیریت می‌کند؛ Order همچنان موجودی را تغییر نمی‌دهد. اعداد/فعالیت‌های داشبورد دادهٔ عملیاتی نیستند و KPI موجودی/خرید/تأمین‌کننده ندارد.
