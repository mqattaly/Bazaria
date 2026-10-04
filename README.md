# بازاریا | Bazariya

پایهٔ توسعهٔ بازاریا برای مدیریت فروش میدانی. مخزن زیرساخت **Phase 0**، بنیاد رابط کاربری **Phase 1**، دامنهٔ محدود کاتالوگ **Phase 2**، مدیریت مستقل مشتریان **Phase 3**، ایجاد/مدیریت سفارش در **Phase 4** و مدیریت مستقل موجودی/گردش در **Phase 5** را نگه می‌دارد: پوستهٔ فارسی و راست‌به‌چپ، داشبورد عمدتاً نمایشی، مدیریت واقعی محصول/دسته‌بندی، CRUD مشتریان و سفارش‌های snapshotمحور، و کنترل دستی موجودی. داشبورد KPI عملیاتی موجودی ندارد؛ ورود واقعی و دیگر جریان‌های کسب‌وکار پیاده‌سازی نشده‌اند.

## فناوری‌ها

- وب: React، TypeScript، Vite، React Router، TanStack Query، React Hook Form، Zod و Tailwind CSS
- قلم: Vazirmatn Variable به‌صورت محلی از `@fontsource-variable/vazirmatn`
- API: Node.js، NestJS و TypeScript، با REST API زیر مسیر `/api/v1`
- داده: PostgreSQL با `node-postgres` (`pg`)، SQL و migrationهای نسخه‌بندی‌شده؛ بدون ORM
- ساختار: npm workspaces در `apps/`, `packages/` و `database/`

## شروع سریع

پیش‌نیازها: Node.js نسخهٔ `22.22.3` یا بالاتر، npm نسخهٔ `10.9` یا بالاتر، و Docker Compose برای PostgreSQL محلی.

برای اجرای وب و API همراه با پایگاه داده:

```bash
npm install
cp .env.example .env
docker compose -f docker/compose.yml up -d
npm run db:migrate
NODE_ENV=development npm run db:seed  # اختیاری؛ دادهٔ نمونهٔ کاتالوگ، مشتری و موجودی
npm run dev
```

وب در `http://localhost:5173` و API در `http://localhost:3001` اجرا می‌شود. سلامت API را می‌توان از `http://localhost:3001/api/v1/health` بررسی کرد. وب درخواست‌های `/api` را از طریق proxy توسعه به API می‌فرستد.

برای دیدن پوسته و داشبورد به‌تنهایی، بدون PostgreSQL، اجرا کنید:

```bash
npm run dev:web
```

در این حالت نشانگر اتصال API ممکن است آفلاین باشد. صفحهٔ ورود صرفاً نمایشی است و هیچ احراز هویتی انجام نمی‌دهد.

## دستورات توسعه

```bash
npm run dev:web       # فقط وب
npm run dev:api       # فقط API (برای توسعهٔ ترکیبی از npm run dev استفاده کنید)
npm run db:migrate    # اجرای migrationهای منتظر
npm run db:seed       # seed نمونه در NODE_ENV=development
npm run lint          # ESLint
npm run typecheck     # بررسی TypeScript در همهٔ workspaces
npm test              # تست‌های API و وب؛ بدون نیاز به PostgreSQL
npm run test:database # اتصال واقعی به PostgreSQL و اجرای تکرارپذیر migrationها
npm run build         # build پکیج مشترک، API و وب
npm run test:phase0   # بررسی کامل Foundation و تست PostgreSQL
```

`npm run test:database` و `npm run test:phase0` به `DATABASE_URL` معتبر و یک PostgreSQL در دسترس نیاز دارند. تست دیتابیس migrationها و محدودیت‌های PostgreSQL کاتالوگ، مشتری، سفارش و Inventory را بررسی می‌کند؛ آن را روی دیتابیس توسعه/آزمایشی جداگانه اجرا کنید. seed نیز فقط برای `NODE_ENV=development` مجاز است. جزئیات در [`docs/development.md`](docs/development.md) و [`database/seeds/README.md`](database/seeds/README.md) آمده است.

## مستندات

- [معماری و قراردادها](docs/architecture.md)
- [راهنمای توسعه و تست](docs/development.md)

## محدودهٔ فعلی

پوستهٔ واکنش‌گرا، ناوبری RTL، تم روشن/تیره، اجزای پایهٔ رابط کاربری و داشبورد mock در Phase 1 پیاده‌سازی شده‌اند. Phase 2 مدیریت محصول و دسته‌بندی تخت را اضافه می‌کند: `/products`, `/products/:id`, `/categories` و APIهای `/api/v1/products` و `/api/v1/categories`. Phase 3 دامنهٔ مستقل Customer را اضافه می‌کند: `/customers`, `/customers/:id` و `/api/v1/customers`; ارتباط با سفارش فقط از طریق رابطهٔ اختیاری تحت مالکیت Order است. Phase 4 مدیریت سفارش را اضافه می‌کند: `/orders`, `/orders/new`, `/orders/:id` و `/api/v1/orders` با اقلام snapshotشده، قیمت فعلی سمت سرور، تخفیف صحیح و وضعیت‌های draft/confirmed/cancelled. Phase 5 دامنهٔ مستقل Inventory را اضافه می‌کند: `/inventory`, `/inventory/:productId` و `/api/v1/inventory` برای حداقل/مقدار موجودی، ورود/خروج/اصلاح اتمیک و تاریخچهٔ تغییرناپذیر؛ Order موجودی را کم نمی‌کند. داشبورد هنوز عمدتاً نمایشی است و KPI موجودی ندارد. ورود واقعی، کاربران و نقش‌ها، tenantها، چندانباره‌بودن، خرید، پرداخت/مانده‌حساب، تأمین‌کننده، تحویل، رزرو/ارزش‌گذاری، وفاداری، حسابداری، تخفیف‌های پیچیده و گزارش‌های پیشرفته خارج از محدوده‌اند.
