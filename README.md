# بازاریا | Bazariya

پایهٔ توسعهٔ بازاریا برای مدیریت فروش میدانی. مخزن، زیرساخت **Phase 0** را در کنار **Phase 1 UI Foundation** نگه می‌دارد: پوستهٔ فارسی و راست‌به‌چپ، طراحی واکنش‌گرا و داشبورد نمایشی آماده‌اند؛ API سلامت و اتصال PostgreSQL نیز از Foundation قبلی حفظ شده‌اند. داشبورد فقط دادهٔ نمونه دارد و هیچ ورود یا عملیات کسب‌وکاری واقعی انجام نمی‌شود.

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
npm run lint          # ESLint
npm run typecheck     # بررسی TypeScript در همهٔ workspaces
npm test              # تست‌های API و وب؛ بدون نیاز به PostgreSQL
npm run test:database # اتصال واقعی به PostgreSQL و اجرای تکرارپذیر migrationها
npm run build         # build پکیج مشترک، API و وب
npm run test:phase0   # بررسی کامل Foundation و تست PostgreSQL
```

`npm run test:database` و `npm run test:phase0` به `DATABASE_URL` معتبر و یک PostgreSQL در دسترس نیاز دارند. برای محافظت از داده‌ها، تست دیتابیس را روی یک دیتابیس توسعه/آزمایشی جداگانه اجرا کنید. جزئیات در [`docs/development.md`](docs/development.md) آمده است.

## مستندات

- [معماری و قراردادها](docs/architecture.md)
- [راهنمای توسعه و تست](docs/development.md)

## محدودهٔ فعلی

پوستهٔ واکنش‌گرا، ناوبری RTL، تم روشن/تیره، اجزای پایهٔ رابط کاربری و صفحهٔ داشبورد با mock data در Phase 1 پیاده‌سازی شده‌اند. ورود واقعی، کاربران و نقش‌ها، tenantها، فروشگاه، محصول، مشتری، موجودی، سفارش، حسابداری و دیگر جریان‌های کسب‌وکار، APIهای دامنه‌ای و جدول‌های آن‌ها خارج از محدوده‌اند. اعداد و فعالیت‌های داشبورد دادهٔ نمایشی‌اند و نباید به‌عنوان اطلاعات واقعی تفسیر شوند.
