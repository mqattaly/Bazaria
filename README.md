# بازاریا | Bazariya

پایهٔ توسعهٔ بازاریا برای مدیریت فروش میدانی. این مخزن در **Phase 0** قرار دارد: زیرساخت، پوستهٔ فارسی/RTL، API سلامت و اتصال PostgreSQL آماده می‌شوند؛ ورود واقعی و قابلیت‌های فروش هنوز پیاده‌سازی نشده‌اند.

## فناوری‌ها

- وب: React، TypeScript، Vite، React Router، TanStack Query، React Hook Form، Zod و Tailwind CSS
- API: Node.js، NestJS و TypeScript، با REST API زیر مسیر `/api/v1`
- داده: PostgreSQL با `node-postgres` (`pg`)، SQL و migrationهای نسخه‌بندی‌شده؛ بدون ORM
- ساختار: npm workspaces در `apps/`, `packages/` و `database/`

## شروع سریع

پیش‌نیازها: Node.js نسخهٔ `22.22.3` یا بالاتر، npm نسخهٔ `10.9` یا بالاتر، و Docker Compose برای PostgreSQL محلی.

```bash
npm install
cp .env.example .env
docker compose -f docker/compose.yml up -d
npm run db:migrate
npm run dev
```

وب در `http://localhost:5173` و API در `http://localhost:3001` اجرا می‌شود. سلامت API را می‌توان از `http://localhost:3001/api/v1/health` بررسی کرد. وب درخواست‌های `/api` را از طریق proxy توسعه به API می‌فرستد.

> صفحهٔ ورود فعلاً نمایشی است و هیچ احراز هویتی انجام نمی‌دهد. برای آن‌که وضعیت سلامت `ok` شود، PostgreSQL باید در دسترس باشد و migrationها اجرا شده باشند.

## دستورات توسعه

```bash
npm run dev:web       # فقط وب
npm run dev:api       # فقط API (برای توسعهٔ ترکیبی از npm run dev استفاده کنید)
npm run db:migrate    # اجرای migrationهای منتظر
npm run lint          # ESLint
npm run typecheck     # بررسی TypeScript در همهٔ workspaces
npm test              # تست‌های API و وب؛ بدون نیاز به PostgreSQL
npm run test:database # اتصال واقعی به PostgreSQL و اجرای تکرارپذیر migrationها
npm run build         # build پکیج مشترک، API و وب
npm run test:phase0   # lint، typecheck، تست‌ها، تست PostgreSQL و build
```

`npm run test:database` و `npm run test:phase0` به `DATABASE_URL` معتبر و یک PostgreSQL در دسترس نیاز دارند. برای محافظت از داده‌ها، تست دیتابیس را روی یک دیتابیس توسعه/آزمایشی جداگانه اجرا کنید. جزئیات در [`docs/development.md`](docs/development.md) آمده است.

## مستندات

- [معماری و قراردادها](docs/architecture.md)
- [راهنمای توسعه و تست](docs/development.md)

## محدودهٔ Phase 0

در این مرحله تنها پوستهٔ برنامه، صفحهٔ ورود نمایشی، صفحهٔ 404، endpoint سلامت، اعتبارسنجی پیکربندی، اتصال `pg` و schema پایه ساخته شده‌اند. جدول‌های کاربران، فروشگاه‌ها، محصولات، ویزیت‌ها و سفارش‌ها عمداً هنوز ایجاد نشده‌اند.
