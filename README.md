# بازاریا | Bazariya

پایهٔ توسعهٔ بازاریا برای مدیریت فروش میدانی. مخزن زیرساخت **Phase 0**، بنیاد رابط کاربری **Phase 1**، دامنهٔ محدود کاتالوگ **Phase 2**، مدیریت مستقل مشتریان **Phase 3**، سفارش‌های snapshotمحور **Phase 4**، موجودی/گردش مستقل **Phase 5** و **Suppliers & Purchasing در Phase 6** را نگه می‌دارد: پوستهٔ فارسی و RTL، CRUD محصول/دسته‌بندی/مشتری/تأمین‌کننده، سفارش و خرید با چرخهٔ محدود draft/confirmed/cancelled، و کنترل موجودی اتمیک. داشبورد عمدتاً نمایشی است؛ احراز هویت و قابلیت‌های مالی/حسابداری پیاده‌سازی نشده‌اند.

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
NODE_ENV=development npm run db:seed  # اختیاری؛ دادهٔ نمونهٔ کاتالوگ، مشتری، موجودی، تأمین‌کننده و پیش‌نویس خرید
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

`npm run test:database` و `npm run test:phase0` به `DATABASE_URL` معتبر و یک PostgreSQL در دسترس نیاز دارند. تست دیتابیس migrationها و محدودیت‌های PostgreSQL کاتالوگ، مشتری، سفارش، موجودی، تأمین‌کننده و خرید را بررسی می‌کند؛ آن را روی دیتابیس توسعه/آزمایشی جداگانه اجرا کنید. seed نیز فقط برای `NODE_ENV=development` مجاز است. جزئیات در [`docs/development.md`](docs/development.md) و [`database/seeds/README.md`](database/seeds/README.md) آمده است.

## مستندات

- [معماری و قراردادها](docs/architecture.md)
- [راهنمای توسعه و تست](docs/development.md)

## محدودهٔ فعلی

پوستهٔ واکنش‌گرا، ناوبری RTL، تم روشن/تیره، اجزای پایهٔ رابط کاربری و داشبورد mock در Phase 1 پیاده‌سازی شده‌اند. Phase 2 مدیریت Product و Category، Phase 3 Customer مستقل، Phase 4 سفارش‌های snapshotمحور و Phase 5 موجودی/گردش مستقل را اضافه می‌کنند. Phase 6 تأمین‌کنندگان و خرید را اضافه می‌کند: `/suppliers`, `/suppliers/:id`, `/purchases`, `/purchases/new`, `/purchases/:id` و APIهای `/api/v1/suppliers` و `/api/v1/purchases`. PurchaseItem نام/SKU/واحد Product را snapshot می‌کند؛ خرید فقط از draft به confirmed یا cancelled می‌رود. نهایی‌سازی draft به‌صورت اتمیک برای هر قلم یک گردش `IN` با مرجع خرید می‌سازد و موجودی Phase 5 را افزایش می‌دهد؛ Order همچنان موجودی را تغییر نمی‌دهد. داشبورد عمدتاً نمایشی است و KPI خرید/تأمین‌کننده ندارد. ورود واقعی، کاربران و نقش‌ها، tenantها، چندانباره‌بودن، پرداخت/مانده‌حساب، حسابداری/بهای تمام‌شده، برگشت خرید، تحویل جزئی، گردش‌های تأیید و گزارش‌های پیشرفته خارج از محدوده‌اند.
