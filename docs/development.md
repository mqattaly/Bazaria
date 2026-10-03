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
npm run dev
```

Vite روی `0.0.0.0:5173` و NestJS روی `0.0.0.0:3001` گوش می‌دهند. صفحهٔ وب را در `http://localhost:5173` و endpoint سلامت را در `http://localhost:3001/api/v1/health` ببینید. Vite درخواست‌های `/api/*` را به مقدار `VITE_API_PROXY_TARGET` می‌فرستد. برای مشاهدهٔ صرف پوستهٔ RTL و داشبورد mock، `npm run dev:web` کافی است و به PostgreSQL نیاز ندارد؛ نشانگر اتصال API بدون API در دسترس آفلاین می‌ماند.

API بدون اتصال اولیه به PostgreSQL می‌تواند بالا بیاید؛ endpoint سلامت یک `SELECT 1` می‌زند و هنگام در دسترس نبودن DB پاسخ `503` با قرارداد خطای مشترک می‌دهد.

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

## Migration و PostgreSQL

```bash
npm run db:migrate
```

دستور از `DATABASE_URL` می‌خواند، migrationهای مرتب‌شده را اجرا می‌کند و migrationهای انجام‌شده را رد می‌کند. اولین migration فقط schema پایهٔ `bazariya` را اضافه می‌کند.

تست دیتابیس نیز schema پایه را روی دیتابیس مقصد ایجاد/بررسی می‌کند. یک دیتابیس اختصاصی برای تست تنظیم کنید تا از تغییر ناخواستهٔ داده‌های شخصی جلوگیری شود:

```bash
DATABASE_URL=postgresql://USER:PASSWORD@localhost:5432/bazariya_test npm run test:database
```

## تست، lint و build

```bash
npm run lint
npm run typecheck
npm test
npm run test:database
npm run build
```

`npm test` شامل تست HTTP برای بالا آمدن NestJS، قرارداد health/error، routeهای وب و تست‌های Vitest/Testing Library برای اجزای رابط کاربری است؛ برای این تست‌ها PostgreSQL واقعی لازم نیست. `npm run test:database` اتصال واقعی با `pg`, اجرای migration و idempotency آن را بررسی می‌کند.

برای اجرای مجموعهٔ کامل Phase 0 (به‌همراه تست دیتابیس):

```bash
npm run test:phase0
```

## نکات توسعه

- قابلیت جدید را ابتدا در ماژول مربوطه بسازید؛ controller محل انباشتن business logic نیست.
- هر تغییر schema باید migration مستقل، نسخه‌بندی‌شده و قابل‌تکرار داشته باشد.
- ورودی کلاینت معتبر فرض نمی‌شود. queryهای متغیردار باید با placeholderهای `pg` پارامتری شوند.
- پوستهٔ فعلی Phase 1 شامل ورود واقعی یا جدول‌های کسب‌وکار نیست؛ فرم ورود فقط placeholder و داشبورد صرفاً حاوی mock data است.
- مؤلفه‌های رابط کاربری باید از توکن‌های معنایی، ویژگی‌های دسترس‌پذیری و جهت منطقی CSS استفاده کنند؛ دادهٔ نمونه را خارج از کامپوننت‌های ارائه نگه دارید.
