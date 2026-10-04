# Bazaria — Phase 0 repository audit and architecture baseline

**Audit date:** 2026-10-04 (UTC)
**Scope:** Phase 0 only — audit, architecture, UX principles, and roadmap.
**Status:** Recommendations for owner review; no application stack or product feature has been implemented.

> **Boundary:** This document is not a Phase 1 start signal. It records what exists, recommends a target, and identifies decisions that need owner confirmation. The working tree was clean before this documentation change. Existing Git history is preserved.

## 1. Executive summary

The checkout is an essentially empty project scaffold: the only tracked file is a ten-byte `README.md` containing `# Bazaria`. There is no frontend, backend, database, schema, dependency manifest, test suite, deployment configuration, or product code to reuse or deprecate. Consequently, the prompt's business requirements—not legacy implementation—are the source of truth for the proposed design.

The practical target is a **TypeScript monorepo and modular monolith**: a mobile-first React web application, a NestJS API, and PostgreSQL. This keeps the first release understandable and deployable as one product while leaving well-defined module boundaries for later growth. Tenant isolation, auditable order/stock changes, Persian-first localization, and a catalog-first order workflow are foundational constraints, not later UI polish.

No dependencies, schemas, routes, screens, services, or runtime configuration were added in Phase 0. The only changes are this architecture document and a README link to it.

## 2. Repository and Git audit

### Git snapshot

- Working branch: `arena/01a107e6-bazaria`.
- The branch starts at `b1f8b915bea13c2128d0705e526898830c441012` (`Initial commit`), also the locally visible `main` / `origin/main` tip at audit time.
- The checkout is shallow (`git rev-parse --is-shallow-repository` returned `true`); only the initial commit is visible locally. This limits historical audit claims; it does not prove that no other history exists outside this checkout.
- The working tree was clean before Phase 0 edits. No branch switch, history rewrite, or deletion was performed.
- `origin` points to `mqattaly/Bazaria` on GitHub.

### Exact repository inventory

| Area inspected | Finding in this checkout |
|---|---|
| Repository shape | One tracked root file; no source directories. Not currently a monorepo. |
| Package manager / runtime | No `package.json`, workspace file, lockfile, runtime pin, or alternate language manifest. No package manager can be identified. |
| Frontend | No language, framework, routing, state, data fetching, forms, styles, components, pages, PWA, or browser tests. |
| Backend | No language, runtime, framework, API, controllers, services, repositories, jobs, or server tests. |
| Database / ORM | No database configuration, ORM, schema, migrations, seeds, or database tests. |
| Authentication / authorization | Neither exists in the repository. No session/token configuration, user model, roles, permissions, or policies. |
| Validation / API contracts | No validation library, DTOs, OpenAPI specification, or error convention. |
| UI / state | No UI components, pages, state-management or server-state library. |
| Tests / quality | No test files or test/lint/type-check/build scripts or configuration. |
| Configuration / secrets | No `.env*`, environment schema, `.gitignore`, CI workflow, or application configuration. No secrets were present in tracked files. |
| Files / maps / GPS | No upload, object-storage, map, geolocation, or route integration. |
| Deployment / containers | No Dockerfile, Compose file, deployment manifest, hosting configuration, or CI/CD. |
| Documentation | `README.md` contains only the project heading. |

There are no existing test, lint, type-check, or build commands to execute. This is an absence of a runnable project, not a failing test result. Phase 0 verification is recorded in §17.

### Code disposition

| Classification | Audit conclusion |
|---|---|
| **Reusable** | The repository and Git history; the project name/title. There is no application implementation to carry forward. |
| **Reusable with modification** | The README as a documentation landing page. The original heading is retained and linked to this audit. |
| **Obsolete** | None identified. There is no old product code to label obsolete. |
| **Incompatible** | None identified. No existing framework or model conflicts with the requested business model. |
| **Unknown / needs verification** | All future deployment, identity-provider, data-retention, currency, map-provider, and detailed business-policy choices. The prompt supplies the requirements; this document flags choices the prompt does not settle. |

Do not delete or replace existing application code based on this audit: no such code is present.

## 3. Recommended technical direction (not installed)

The recommendations below favor a small number of familiar technologies, strong relational guarantees, and a modular monolith over microservices. Versions should be selected and pinned when Phase 1 is authorized, based on the then-supported releases and deployment constraints.

| Concern | Current state | Recommended direction | Why / constraint |
|---|---|---|---|
| Repository / package manager | No application packages | `pnpm` workspaces; a small monorepo (`apps/web`, `apps/api`, `packages/contracts`, `docs`) | One coordinated release and shared API contract. Do not add a task-orchestration layer until it earns its complexity. |
| Backend language / runtime | None | TypeScript on a supported Node.js LTS runtime | Same primary language across web and API; broad ecosystem and type support. Pin runtime and package manager in Phase 1. |
| Backend framework | None | NestJS modular monolith, initially using its standard Express adapter | Provides clear modules, dependency boundaries, guards, pipes, and test patterns without introducing distributed services. Profile before changing adapters for throughput. |
| Database | None | PostgreSQL, with PostGIS enabled for indexed distance checks and future spatial work | Relational constraints and transactions fit orders, ownership history, inventory, audit, and tenant isolation. Start with one database/shared schema; no evidence justifies per-tenant databases. |
| ORM / migrations | None | Prisma Client and Prisma Migrate; reviewed SQL migrations/raw SQL for PostGIS, row-level security, and locking-sensitive operations | Productive typed CRUD and repeatable migrations. Keep exceptional SQL in repository boundaries and integration-test it; do not pretend fuzzy geo queries or row locks are ordinary ORM CRUD. |
| API | None | Versioned REST JSON (`/api/v1`) with OpenAPI; generate/maintain a typed web client from the contract | Explicit, debuggable contracts work well for a future offline client and do not bind the browser to server internals. |
| Backend validation | None | Nest global validation using DTOs, `class-validator` and `class-transformer`; whitelist input and reject unknown fields | Validate at every trust boundary. Domain invariants and database constraints remain necessary; DTO validation is not authorization. |
| Authentication | None | Decide an OIDC-compatible provider or first-party credential policy before Phase 1. Prefer a maintained library/provider; use a same-origin, revocable server-side session in a `Secure`, `HttpOnly`, `SameSite` cookie. Do not store long-lived tokens in browser local storage or invent a token protocol. | Provider, login identifiers, MFA, and deployment constraints are not in the repository or prompt. Authentication proves identity; it does not provide tenant authorization. Add CSRF defenses for cookie-authenticated writes and rate-limit login. |
| Authorization | None | Tenant membership plus additive role/permission grants; server-side policy checks on every operation | A user can have Manager, Warehouse, and/or Sales Representative roles at once. UI hiding is never an access-control boundary. |
| Frontend language / framework | None | TypeScript, React, and Vite | A focused authenticated web/PWA-style app; no SEO or server rendering requirement has been established to justify a heavier framework. |
| Frontend routing | None | React Router with explicit representative, manager/warehouse, and platform route areas | Separate navigation and layouts while sharing the same primitives. Client route guards improve UX only; API authorization is authoritative. |
| Server state | None | TanStack Query | Caching, request cancellation, invalidation, and pagination for stores/catalog/orders; query keys must include tenant context. |
| Local order state | None | A small Zustand store for the active cart, persisted to IndexedDB when order entry is implemented | Keep transient cart state distinct from server state. Do not introduce a large global state framework for this workflow. |
| Forms / frontend validation | None | React Hook Form + Zod for ergonomic forms; the API remains the source of truth | Useful for quick product quantity entry and predictable field errors. Never rely on browser validation for security. |
| CSS / components | None | Tailwind CSS **4.x**, semantic CSS design tokens, and small reusable components; use accessible headless primitives only where needed | Tailwind is compatible with React/Vite. Pin a stable release during Phase 1 and validate RTL behavior before standardizing components. Avoid adopting a large visual system before UX testing. |
| Icons | None | One consistent icon set such as `lucide-react` | Consistency and familiar tree-shaking; icons need labels when meaning is not obvious. |
| Calendar / dates | None | Central Jalali date adapter (evaluate a maintained Jalali library such as `date-fns-jalali`) plus `Intl` formatting | Store timestamps as UTC instants; format and pick dates through one tested adapter in `Asia/Tehran`. Do not hand-roll calendar conversion across screens. |
| Map | None | MapLibre GL JS behind a provider/tile adapter; choose a licensed, reliable tile provider after coverage and data-residency review | Separates map rendering from provider choice. No navigation, live tracking, or active territory enforcement in early phases. |
| Tests | None | API: Jest + HTTP/integration tests against PostgreSQL (Testcontainers or equivalent); web: Vitest + React Testing Library; critical flows: Playwright | Cross-tenant, concurrency, Persian formatting, and order state transitions need integration/E2E coverage, not only mocks. |
| Background work | None | Start without a queue. Use a transactional outbox for durable post-commit work; add a worker/queue only when notifications or measured load require it. | Avoid Redis and queue operations as day-one infrastructure. Every job must carry tenant context and be safe to retry. |
| Cache | None | Browser/TanStack Query and HTTP/image caching first; no shared application cache initially | Add Redis only after measured need. Every future cache key must include tenant, permissions/visibility, and relevant data version. |
| File storage | None | Private S3-compatible object storage behind an adapter; use local-compatible storage only for development if useful | Keep binaries out of the database and ephemeral app disks. Tenant-scoped object keys are not a substitute for authorization. |
| Local development / deployment | None | Docker Compose for local PostgreSQL/PostGIS when the stack is created; production deployment and provider remain an owner decision | No container or hosting change is needed in Phase 0. Keep secrets out of Git and use a production secret manager. |

### Proposed repository shape after approval

```text
apps/
  api/                 NestJS modular monolith
  web/                 React + Vite application
packages/
  contracts/           generated API types/client (not domain DB models)
docs/
  architecture/
```

Keep UI components inside `apps/web` until a second frontend actually needs them. Avoid a shared package that exposes ORM models to the browser. Use OpenAPI as the API boundary; a generated client is not a license to trust client-submitted prices, tenant IDs, or role claims.

## 4. Product and system architecture

### 4.1 Architectural principles

1. **Fast, obvious flows:** optimize representative order entry and common manager actions before adding dashboard density or enterprise abstractions.
2. **Modular monolith first:** separate identity/platform, stores, catalog/pricing, orders, inventory, visits, and reporting by module and service boundary. Keep a single deployable API and transactional database initially.
3. **Server-authoritative business rules:** ownership, duplicate-store decisions, pricing, discounts, order transitions, inventory, license limits, and permissions are enforced by the API and database.
4. **Immutable evidence:** keep the submitted request, product/price snapshots, status events, ownership transfers, adjustments, stock movements, and actors. Do not erase history by overwriting current state alone.
5. **Tenant scope by construction:** tenant context is mandatory for tenant-domain reads and writes; missing context fails closed.
6. **Localization at the edge:** stable IDs and canonical values in APIs/storage; Persian labels, RTL layout, Jalali display, and localized digits in the UI.
7. **Offline-ready, not offline-built:** use idempotent commands and local draft persistence when order entry is implemented; defer the synchronization engine to its own phase.
8. **Measure before infrastructure:** paginate/index first; add search services, Redis, queues, or microservices only when load and operations justify them.

### 4.2 Multi-tenant isolation

**Recommended initial model:** one PostgreSQL database and shared schema, with `tenant_id` on every tenant-owned row. This is the simplest operational model consistent with the current unknown scale. A tenant-per-schema/database model is not recommended without a contractual isolation or regulatory reason.

- Authenticate a global `User`; select a tenant through an explicit tenant route/context. The API resolves the request's tenant and verifies that the authenticated user has an active `TenantMembership` for it. A client-supplied tenant ID is only a selector, never proof of access.
- Controllers establish an immutable `TenantContext` after authorization. Service and repository methods for tenant data require that context; avoid unscoped “find by ID” helpers.
- Scope every tenant query and unique key. Use composite foreign keys/constraints such as `(tenant_id, store_id)` so a row from tenant A cannot reference a store/product/order in tenant B even if application code is faulty.
- Add PostgreSQL Row-Level Security (RLS) as defense in depth for tenant tables if the Phase 1 team can implement and test it correctly. Set a transaction-local tenant value on the same connection before tenant queries; fail closed when it is missing. Use a non-superuser runtime role that does not bypass RLS, and force RLS where appropriate. Do not rely on connection-pool session state.
- Test cross-tenant reads, writes, nested references, exports, search, and background jobs with two tenants. A 404 for a foreign ID is generally safer than disclosing its existence.
- Namespace object keys, cache keys, idempotency records, search indexes, and job payloads by tenant. Purge local offline data on logout or tenant switch. Never place private data in a globally shared cache without a tenant-aware authorization key.

**Super Admin is a separate platform identity, not a tenant user or tenant role.** Keep platform accounts/permissions and routes separate (for example `/api/v1/platform/...`) from tenant `User`/`TenantMembership` permissions; a platform admin has no implied tenant membership. A platform operator may manage tenant/license metadata and view authorized aggregate tenant-usage information; any access to tenant business data must be explicit, least-privilege, and audited. Do not grant platform access by adding a normal `Manager` role to a tenant membership.

### 4.3 License model

Model a platform-owned `License` associated with a tenant, with an auditable history of renewals/status changes. The initial entitlement is only:

- duration: one month, six months, or one year (store actual start/end instants/dates, not just a plan label);
- `store_limit`: configurable, with examples such as 20, 50, 100, or 200;
- status and renewal history.

The limit counts **registered stores**, not visits or representatives. Enforce it on the server during store creation, in the same transaction as duplicate checks and insertion. Serialize/check the entitlement so two concurrent registrations cannot both consume the last slot. Decide before Phase 2 whether inactive/archived stores continue to count and what expired/suspended tenants may do; do not let deactivation silently bypass the limit. Future entitlements can be represented as keyed limits/features, but do not implement users/products/representatives/orders/warehouses/features as active quotas now. No license UI is in scope.

### 4.4 User, membership, role, and permission model

Use a global identity plus tenant-scoped membership. Recommended relationships:

```text
User 1 ── * TenantMembership * ── 1 Tenant
TenantMembership * ── * Role * ── * Permission
Platform identity/permissions ── separate from tenant membership roles
```

`Manager`, `Warehouse`, and `Sales Representative` are assignable roles, not a single enum column on `User`. A membership may hold several roles simultaneously. Represent permissions as stable actions/resources (for example `orders.adjust`, `inventory.move`, `stores.transfer`) and check them in server policy/service boundaries. Seed initial roles and grants centrally; keep the model extensible for future roles. The tenant membership—not a client-provided role string—defines tenant authority. Detailed role-to-permission mapping should be reviewed in Phase 1.

### 4.5 Domain model proposal

This is a conceptual model, not a request to create tables in Phase 0. Tenant-owned rows should carry `tenant_id` and tenant-safe foreign keys; platform/global rows are explicitly called out.

| Entity | Scope and purpose | Important fields / relationships | Status |
|---|---|---|---|
| `Tenant` | Platform/global company boundary | ID, name/slug, lifecycle status, created time; owns memberships, licenses, stores, catalog, orders, warehouse, visits | Foundation |
| `License` | Platform/global entitlement for a tenant | Tenant, term start/end, duration/plan snapshot, `store_limit`, status, renewal actor/time; separate from operational roles | Current requirement; store-cap enforcement begins with store registration |
| `User` | Global login identity, not itself a tenant role | ID, normalized login identifiers, auth-provider subject/status; may have multiple memberships | Foundation |
| `TenantMembership` | Tenant-scoped relationship and lifecycle | Tenant, user, active/suspended dates; role grants; representative identity used by store/order/visit records | Foundation |
| `Role`, `Permission`, `MembershipRole`, `RolePermission` | RBAC catalog and joins | Role key/name/scope; permission key; many-to-many membership-role and role-permission links | Foundation; multiple roles per membership required |
| `PlatformAdmin` identity/permissions | Separate global Super Admin account, outside tenant `User`/`TenantMembership` | Platform permission set, strong authentication, platform audit; no implied tenant membership | Architecture now; UI later |
| `Store` | Tenant-owned selling location | Name, owner/contact, normalized phone, address, required WGS84 GPS, optional image key, current representative membership, status, creator/time; links visits/orders | Phase 2; active immediately after valid registration |
| `StoreOwnershipHistory` | Tenant-owned immutable ownership evidence | Store, previous/current representative membership, transfer actor, timestamp, reason; initial assignment is recorded too | Phase 2 |
| `Territory` (and future assignments) | Tenant-owned future geographic area | Name, polygon/circle geometry, enabled flag, assigned memberships | Model direction only; disabled, no enforcement in early phases |
| `Visit` | Tenant-owned representative visit | Store, representative, start/end instants, GPS points, accuracy, verification result, actor/device metadata as appropriate | Phase 7; GPS fields/privacy policy need review |
| `Category` | Tenant-owned product grouping | Name, sort order, active state; one-to-many products | Phase 3 |
| `Product` | Tenant-owned catalog item | Name, image key, category, active status, price/currency, sales unit; optional SKU, never mandatory by default | Phase 3; historical order snapshots survive product changes |
| `DiscountRule` | Tenant-owned pricing rule | Representative membership, product, minimum quantity, percentage, effective dates/status; one active rule must be selected deterministically | Phase 6; quantity-threshold percentage is the only active type initially |
| `Order` | Tenant-owned order aggregate | Store, representative membership, status, currency, totals, version, idempotency reference and timestamps | Phase 4 |
| `OrderItem` | Order line and price/request snapshot | Product reference plus submitted name/unit, requested quantity, approved quantity, unit-price and discount snapshots, line totals | Phase 4; submitted requested quantity is preserved |
| `OrderStatusHistory` | Append-only workflow trail | Order, from/to status, actor, timestamp, reason | Phase 4 |
| `OrderAdjustment` | Auditable manager changes | Order/item, before/after approved quantity, reason, actor, timestamp; zero approved quantity represents removal without erasing request | Phase 4 core; discount/availability automation later |
| `Warehouse` | Tenant-owned stock location | Tenant, name, active/primary flag; one initial warehouse, schema permits more | Phase 5 |
| `InventoryBalance` | Tenant + warehouse + product current projection | On-hand and, if reservation policy is approved, reserved quantities; unique warehouse/product | Phase 5; projection updated only by inventory service |
| `StockMovement` | Append-only inventory ledger | Product, warehouse, movement type, signed quantity, reason/reference, actor/time; reconciles the balance | Phase 5; orders do not directly mutate it |
| `Notification` | Tenant-scoped in-app notification | Recipient membership, type, reference/payload, created/read time | Phase 6+; use outbox for reliable delivery |
| `AuditLog` | Security/business audit evidence | Tenant or platform scope, actor, action, resource, request/correlation ID, redacted before/after data, time | Add with foundational mutations; do not store secrets or unnecessary raw GPS |
| `IdempotencyRecord` / `OutboxEvent` | API reliability infrastructure | Tenant, actor/operation, key and request hash; outbox event committed with domain change | Add alongside relevant APIs; not user-facing product features |
| Payment/settlement entities | Future accounting boundary | Cash/card/cheque/debt/settlement not specified | Not active; no payment tables/workflow until separately approved |

**Data conventions:** use UTC `timestamptz` for instants; retain explicit currency code/unit and avoid floating-point money; decide the canonical Rial/Toman input/storage unit before product pricing. Keep product/price/unit/discount snapshots on submitted order lines so later catalog edits do not rewrite invoices. Preserve source request quantity separately from approved quantity. Decide quantity precision per sales unit (integer vs fractional) before order implementation. Use database constraints and tenant-scoped indexes for invariants that can be expressed relationally.

## 5. Store, duplicate, ownership, GPS, and territory design

### Store registration and duplicate prevention

Store registration is a representative action and requires a GPS position. A successfully registered store becomes active immediately; it does not wait for manager approval. Store create is a backend command, not a client-only duplicate warning.

Use several signals together:

- normalized phone (accept and normalize Persian/Arabic digits and country/local formats);
- geospatial distance between GPS points, including measured GPS accuracy;
- normalized name and address similarity.

Use PostGIS spatial indexes for proximity candidates and a Persian-aware normalization/similarity strategy for text. Do not make SKU-like identifiers or one phone field the only duplicate key; legitimate stores may share a contact number. A high-confidence likely duplicate owned by another representative must be blocked with a clear, non-silent conflict. Do not reassign it. Return a stable API error code and enough tenant-authorized context to explain the conflict without exposing unnecessary personal data. Duplicate thresholds, radius, similarity weights, and same-owner behavior are business decisions to validate before Phase 2.

The backend must be race-safe: run candidate checks and insertion in a transaction with a documented serialization/lock strategy; use ordinary unique constraints for exact identifiers where policy permits, and a tenant-scoped advisory/geospatial-cell lock or equivalent for fuzzy candidates. Recheck on the server even if the client ran a preview. A bypass/override, if ever allowed, must be a separate permissioned and audited policy—not a silent reassignment.

### Ownership transfer

`Store.current_owner_membership_id` identifies the current representative. Manager transfer is a dedicated command that verifies both memberships are active in the same tenant, writes `StoreOwnershipHistory`, changes current ownership atomically, records actor/time/reason, and emits an audit event. Previous orders and visits retain the representative who performed them; transfer never rewrites history. Ordinary representatives cannot normally access or visit another representative's store unless a future explicit policy says otherwise.

### GPS and visits

Store coordinates and visit coordinates are sensitive location data. Store coordinates use WGS84 and must validate latitude/longitude bounds; capture accuracy and capture time where available. The visit flow is `Start Visit → request/verify GPS → persist visit`. Visit start/end instants and coordinates should be stored with accuracy and verification outcome. The API must authorize that the representative owns/is assigned to the store and must not accept arbitrary client claims as proof of presence. GPS spoofing cannot be fully prevented by a browser coordinate alone; record evidence and consider anomaly handling rather than claiming cryptographic verification. Choose allowed distance/accuracy thresholds with field testing.

Initial map work displays stores and visit points. A provider adapter and a MapLibre renderer are recommended; tile licensing, regional coverage, and retention must be decided before provider integration. Navigation, live tracking, route history, work-duration analytics, and territory enforcement are future work. Territories remain represented but disabled; no warning/blocking rule is active in Phase 0 or the early feature phases.

## 6. Catalog, search, order, inventory, and discount design

### Products and Persian-friendly search

A tenant catalog item needs name, image, category, price, sales unit, and relevant seller-facing information. SKU remains optional. Products referenced by historical orders should be archived/deactivated rather than hard-deleted. Price edits affect future orders only.

Start search in PostgreSQL, not with a separate search cluster: tenant-scoped indexes, normalized search text, prefix/trigram search (`pg_trgm` where useful), category filters, and cursor/page limits. Normalize common Persian/Arabic variants such as `ي/ی`, `ك/ک`, digits, diacritics, whitespace, and zero-width non-joiner for matching while preserving the original display text. Cancel stale client requests and debounce input modestly; add a dedicated search service only if measured catalog size/latency requires it. Product images should be resized into thumbnails, lazy-loaded in the grid, and delivered from private/authorized object storage or a correctly scoped CDN URL.

### Catalog-first representative order entry

The representative opens a store (and starts the required visit where policy requires it), opens **Catalog**, taps a seller-facing product card, chooses quantity in a quick interaction, taps **Add to cart**, and returns immediately to the same catalog position/filter. The catalog shows product image, name, price, sales unit, and concise relevant details. Keep quantity entry touch-friendly, keyboard-ready, and available without a chain of modal confirmations.

Search remains a first-class alternative: a persistent, prominent search field; fast Persian-friendly results; tap product → quantity → add → return to results. Search and catalog both add to the same cart and retain scroll/query context.

### Cart and invoice review

The cart is persistent and easy to open. A compact cart bar/dock remains visible without obscuring content and shows distinct product/item count, total quantity, and estimated total. The cart/review lists product, quantity, unit, unit price, discount, and line total. Quantity can be stepped or typed inline; remove is immediate with a reversible undo affordance rather than a confirmation chain.

Before submission, show a clean invoice/review page with store, lines, notes if applicable, subtotal, discounts, total, and status context. The entire order remains editable: change a quantity, remove a line, add another product, or return to catalog/search. The cart is a client-side draft, not a series of per-item write requests. Persist the draft locally (IndexedDB) when Phase 4 is built so navigation or temporary connectivity loss does not discard it. The server calculates/validates authoritative price and discount snapshots in one submit operation; if a material price change is found, return a clear reviewable conflict rather than silently changing the displayed invoice.

Keep order draft/cart state separate from TanStack Query server data. Generate an idempotency key for submission, retry safely, and show pending/failed/synced states. Do not implement the offline synchronization engine in Phase 0.

### Order lifecycle and manager review

Use explicit transition commands, not arbitrary status patching. A recommended starting graph is:

```text
Draft --representative submits--> Submitted (pending approval)
Submitted --manager requests representative revision--> NeedsAdjustment
NeedsAdjustment --representative resubmits--> Submitted
Submitted --manager approves, optionally with audited quantity changes--> Approved
Approved --> Preparing --> Ready --> Delivered
```

Cancellation/rejection actors and exact transition rules require owner confirmation. Each accepted transition creates `OrderStatusHistory` in the same transaction. Once submitted, original requested quantity and line snapshots are preserved. Manager decisions update a separate approved quantity and append `OrderAdjustment` with before/after value, reason, actor, and time. For a requested quantity of 10 with only 7 available, show **Requested 10 / Available 7 / Approved 7**; removing an unavailable line sets approved quantity to zero but retains the requested line/history. The representative does not need to cancel and recreate an order to fix one line.

The manager order detail prioritizes store, representative, status/history, requested vs approved quantities, prices/discounts/totals, and inventory availability. Use optimistic versioning (`If-Match`/version) so simultaneous edits do not silently overwrite each other.

### Inventory is independent from Orders

Start with one warehouse per tenant but keep `warehouse_id` in the model for future multi-warehouse support. Inventory is a stock-movement ledger plus a current balance projection. Receipts, adjustments, reservations/releases (if approved), and issues are inventory-service operations with actor/reason. Orders may read availability; **creating, submitting, approving, or changing an order must not directly decrement stock**. If the owner later decides to reserve stock at approval/preparation, do so through an explicit inventory reservation command and corresponding movement/ledger evidence.

Use a transaction with row locking or an atomic conditional update and a database check to prevent negative stock. Reconcile balances from movements. Define when a reservation is made/released, whether backorders exist, and how delivery affects stock before Phase 5. Payment, debt, cheque, and settlement are not active.

### Discounts

The first rule type is a percentage discount when a representative reaches a product quantity threshold. Scope it to tenant + representative membership + product; store threshold, percentage, effective period/status, and actor/audit information. Evaluate rules server-side and snapshot the applied rule, percent, amount, and unit price on the order. Establish deterministic precedence and rounding rules before Phase 6; do not silently stack overlapping rules. Future rule types should be added through a small pricing strategy boundary rather than a speculative general rules engine.

## 7. API, transactions, and reliability

- Use versioned REST resources and explicit command endpoints for important state changes (registration, transfer, submit, adjust, approve, stock movement); publish OpenAPI and stable machine-readable error codes.
- Resolve authentication, tenant membership, permission, and resource ownership before domain mutation. Tenant context must be derived/validated server-side; never trust a tenant, role, price, discount, total, or approved quantity from the browser.
- Validate and normalize every request at the boundary. Return consistent problem/error objects with field errors and stable codes; localize user-facing text in the web app rather than scattering Persian strings in server exceptions.
- Keep service methods as transaction boundaries for compound operations. Order creation atomically writes order, item snapshots, initial status history, and audit/idempotency records. Store registration atomically checks tenant license/duplicates and inserts store/ownership history. Ownership transfer atomically changes current owner and appends history. Adjustment atomically checks order version/permission, records before/after values, and transitions status as requested.
- Use an idempotency key for retryable creates/submits. Scope keys to tenant and actor/operation, persist a request hash/result, and reject reuse with a different payload. Do not treat a disabled submit button as duplicate prevention.
- Inventory mutation uses a serializable or locked/conditional update appropriate to the operation; enforce non-negative balances in the database as well as service code. Keep stock changes outside the order write path.
- Record audit events in the same transaction as the mutation. Do not call email/push providers inside a database transaction; write an outbox event and deliver after commit with retry and deduplication.
- Use cursor pagination and tenant-filtered queries for catalog, store, and order lists. Avoid N+1 product/price/inventory queries. Use server-generated prices and snapshots.
- Apply rate limits to authentication, store registration/duplicate probes, and other abuse-sensitive endpoints. Validate file uploads by actual content, size/dimensions, and ownership; do not trust extension or browser MIME type. Apply least privilege to GPS and contact data.

Representative endpoint shapes (illustrative only; none are implemented):

```text
POST /api/v1/tenants/{tenantId}/stores                   (idempotent; duplicate checked)
POST /api/v1/tenants/{tenantId}/stores/{id}/transfers
GET  /api/v1/tenants/{tenantId}/catalog/products?q=...
POST /api/v1/tenants/{tenantId}/orders                  (idempotent submit)
POST /api/v1/tenants/{tenantId}/orders/{id}/adjustments
POST /api/v1/tenants/{tenantId}/inventory/movements
POST /api/v1/platform/tenants/{id}/licenses/renewals     (separate platform permission)
```

## 8. Frontend and UX architecture

### Separate workspaces, shared design language

Use one React app with explicitly separated route/layout areas:

- **Representative:** mobile-first, assigned stores and visit/order tasks immediately accessible; minimal navigation; large touch targets; catalog/search and persistent cart optimized for one-handed phone use, then tablet.
- **Manager/Warehouse:** desktop-first with a compact sidebar, searchable/filterable tables, status and contextual actions; adapt to tablet and practical mobile use. Warehouse actions appear only where the signed-in membership has the matching permission.
- **Super Admin:** separate platform route/layout and permission boundary; no full UI in the current roadmap until separately approved.

Example route families are `/t/:tenant/rep/...`, `/t/:tenant/manage/...`, and `/platform/...`. These are navigation conveniences, not security boundaries. On tenant switch, clear or re-key query/cart/offline state and confirm any unsynced draft before changing context.

### State boundaries

- **Server state:** TanStack Query for catalog, store, visit, inventory availability, order, and dashboard data. Include tenant, role-sensitive visibility, query/filter, and relevant catalog version in cache keys. Cancel stale product-search requests.
- **Active order:** a focused cart store (Zustand or reducer) for local edits; batch the final write. Persist draft data to IndexedDB in Phase 4. Do not cache authoritative prices indefinitely.
- **Forms:** React Hook Form + Zod for client feedback; server DTOs/domain checks remain authoritative.
- **Offline later:** service worker for the app shell/static assets, IndexedDB for explicitly approved catalog/store/draft data, and a tenant-scoped outbox. Never precache authenticated API responses indiscriminately.
- **Maps:** a MapLibre component consuming authorized store/visit data via API; the browser must not contact a sandbox localhost service or embed provider secrets.

### Reusable UI components to build later

`Button`, `Input`, `SearchInput`, `ProductCard`, `ProductGrid`, `ProductQuickAdd`, `QuantitySelector`, `CartDrawer`, `CartItem`, `OrderSummary`, `InvoicePreview`, `StatusBadge`, `DataTable`, `FilterBar`, `EmptyState`, `LoadingState`, `ConfirmDialog`, `BottomSheet`, `MobileNavigation`, `DesktopSidebar`, and `MapView`.

This is a component vocabulary, not Phase 0 implementation. Components should expose loading/disabled/error/focus states, use semantic labels, support keyboard and screen-reader use, and avoid forcing every screen into a modal.

### Representative order-entry interaction budget

1. Open assigned store.
2. Start/verify visit when required.
3. Open catalog or search.
4. Tap a product and enter quantity in one quick interaction.
5. Add and return to the same browsing context.
6. Open persistent cart, review/edit, submit once.

Avoid page reloads, per-line server writes, unnecessary confirmations, forced form fields, and losing scroll/search state. Use optimistic local cart feedback, but show a clear syncing/pending state when server confirmation is outstanding. Catalog cards and invoice amounts must remain readable in outdoor light and at phone widths.

### Manager interaction priorities

Provide simple entry points to dashboard, orders, stores, representatives, products, inventory/warehouse, reports, and map. Do not show every metric or action at once. Orders need useful status filters, searchable tables, quick review, contextual approve/adjust actions, and visible audit/history. A requested-vs-available-vs-approved comparison should be legible without opening a chain of dialogs.

## 9. Visual system, accessibility, and localization

### Design system

Use Tailwind 4.x when implementation begins, with centralized CSS custom properties/semantic tokens (for example `primary`, `surface`, `text`, `muted`, `border`, `focus`, `success`, `warning`, `danger`). A professional commerce palette can use a deep blue/ink foundation, a restrained teal/green action color, and warm neutral surfaces; exact shades should be finalized with the first UI prototype, not assigned randomly per screen. Reusable tokens should drive buttons, inputs, cards, tables, badges, drawers, and states.

Prioritize clear hierarchy, consistent spacing/typography, subtle feedback, and restrained shadows. Avoid gradient-heavy decoration, cluttered dashboards, excessive animation, and excess controls. Prefer 44×44 CSS-pixel touch targets where practical, visible keyboard focus, semantic HTML, contrast suitable for outdoor use, and WCAG 2.2 AA as a design/test target. Self-host a properly licensed Persian-capable font (for example Vazirmatn) with system fallbacks after licensing review.

### Persian, RTL, Jalali, and time

- Persian is the primary UI language. Store user-facing text in translation/resource catalogs (for a single initial locale, `fa-IR` resources still avoid scattering literal copy through components). Do not hard-code copy throughout screens.
- Set document language and direction (`lang="fa"`, `dir="rtl"`) at the application boundary. Use CSS logical properties and RTL-aware component primitives instead of manually flipping margins/icons per screen. Directional icons should reflect meaning, not be blindly mirrored.
- Store timestamps as UTC instants and use the IANA zone `Asia/Tehran` for presentation/business-day boundaries. Store date-only business values as date-only values, not midnight timestamps. Centralize and test Jalali formatting, calendar input, and Gregorian conversion.
- Use Persian-friendly number/date formatting (`Intl.NumberFormat` / `Intl.DateTimeFormat` with `fa-IR` and a Persian calendar where supported); accept Persian/Arabic digit input and normalize it before validation. IDs and API values remain canonical, not localized strings.
- Test Nowruz/year boundaries, leap-year conversion, Tehran midnight boundaries, and any future daylight-saving/time-zone changes. Resolve Rial vs Toman canonical storage/input/display before pricing implementation; never use floating-point arithmetic for money.

## 10. Performance and security requirements

### Performance plan

- Load a bounded catalog page plus needed category/price data in few requests; use thumbnail variants, modern image formats when supported, lazy loading, and avoid downloading the full catalog on mobile.
- Keep search server-indexed and tenant-scoped, normalize Persian text once consistently, debounce/cancel queries, paginate, and profile real catalog sizes before adding a search service.
- Use indexed tenant filters and composite relation keys; check query plans for high-volume store/order/product lists. Avoid N+1 reads and unbounded exports.
- Submit a cart in one idempotent request and one server transaction; do not make a network round trip for each item. Keep local changes immediate and clearly distinguish estimated from server-confirmed totals.
- Use safe transactions/locks for last-store license slots, duplicate registration, order version transitions, and stock balances. Establish measurable mobile-network and API targets during implementation/QA, not by guessing now.
- Cache only data whose authorization and freshness are understood. Image/CDN cache keys and application cache keys must be tenant-safe.

### Security checklist for implementation

| Risk | Required control |
|---|---|
| Cross-tenant access | Membership-derived tenant context, mandatory tenant-scoped repositories, composite foreign keys, optional tested RLS defense in depth, two-tenant integration tests |
| Role escalation | Additive tenant membership grants, explicit permission checks on server, separate platform-admin boundary, audit grant/revoke events |
| Unauthorized transfer/order edits | Dedicated commands, actor/ownership/permission checks, optimistic versioning, immutable history and audit records |
| Inventory tampering/negative stock | Inventory-specific permission and service, transaction/locking, database constraint, append-only movement history |
| Session/token compromise | Maintained auth integration, secure cookie/session rotation/expiry, CSRF, XSS defenses/CSP, no persistent bearer token in local storage, rate limits |
| Untrusted inputs/uploads | Server validation, output encoding, parameterized SQL, upload type/size/dimension checks, private storage, authorization on every object URL |
| GPS/contact exposure | Minimize stored precision/access/retention, tenant/role scope, audited access; do not log raw sensitive values unnecessarily |
| Duplicate/replayed requests | Transactional duplicate checks, idempotency keys and payload hashes, safe retries |
| Audit gaps | Append-only domain history, actor and correlation ID, redaction of credentials/secrets, platform-vs-tenant audit separation |
| Cache/job leakage | Tenant in keys and job payloads, reauthorization at execution, no shared unscoped cache, purge local tenant data at logout/switch |

This is an architecture checklist, not a claim that any control exists today.

## 11. Offline and synchronization architecture (future)

Offline is a future requirement for catalog, stores, visits, and orders, but the engine is out of scope for Phase 0. Design APIs and Phase 4 drafts so offline can be added without changing the order domain:

- Cache only the signed-in representative's approved catalog and assigned stores in IndexedDB, partitioned by tenant/user; minimize offline PII and clear on logout/tenant change.
- Represent unsent actions in a durable outbox with client-generated IDs, idempotency keys, retry count/backoff, creation time, and tenant context. The server remains authoritative and supports safe repeat submission.
- Sync in small batches with cursors/revisions. Do not use last-write-wins for ownership, approved order quantities, inventory, or status transitions.
- A local draft order can be edited offline; on submit, server revalidates membership/ownership, active product, price/discount snapshot, and order version. Price changes, transferred ownership, duplicate stores, and other conflicts become explicit reconciliation states, not silent overwrites.
- Visits preserve device capture time, received time, coordinates/accuracy, and a clear pending/synced state; server policy validates stale/future events and GPS plausibility.
- A service worker may cache the app shell and static assets, but must not cache private API responses by default. Test logout on shared devices and tenant switching.

Implement a minimal local draft persistence with cart in Phase 4 for resilience; the full background synchronization, stale-data policy, conflict UI, and offline acceptance rules remain Phase 9.

## 12. Phase-by-phase roadmap

The ordering below is adjusted to this repository: foundational security and tenant boundaries precede data features; store GPS is needed for registration before the later visit/map workflow; core order editing is delivered with order entry, while automated inventory/discount behavior follows its own modules. Every phase requires owner authorization after review. **Only Phase 0 is performed by this change.**

### Phase 0 — Audit, architecture, UX foundation (this change)
- **Goal:** inventory the empty checkout; document target stack, domain/security boundaries, UX, open decisions, and roadmap.
- **Backend / frontend / database:** none added.
- **Tests:** no repository test/build scripts exist; verify documentation diff and Git state.
- **Exclusions:** all runtime code and product features; do not start Phase 1.

### Phase 1 — Engineering foundation, identity, tenant boundary, and roles
- **Goal:** create the approved monorepo and enforce identity, membership, authorization, platform separation, and database safety before tenant business data.
- **Backend:** Node/TypeScript, NestJS modules, authentication provider/session, permission guards, tenant context, REST/OpenAPI, health/config validation, audit primitives, rate limits. Define platform Super Admin separately. Model tenant, user, membership, roles/permissions, and license term/store entitlement records; do not build a license UI.
- **Frontend:** React/Vite scaffold, Persian/RTL shell, shared tokens/primitives, login/tenant selection and minimal role-aware shells only; no operational screens.
- **Database:** PostgreSQL/PostGIS setup, Prisma migrations, composite tenant conventions, RLS if tested, dev seed for non-production roles, secret-free `.env.example`.
- **Tests:** auth/session, permission matrix, two-tenant isolation/RLS, migration/bootstrap, configuration, OpenAPI and CI checks.
- **Explicit exclusions:** stores, catalog, orders/cart, inventory, visits/maps, dashboard, offline engine, payment.

### Phase 2 — Stores, representatives, ownership, duplicate checks, registration GPS
- **Goal:** representatives can see assigned stores and register a new active store with required GPS; managers can transfer ownership.
- **Backend:** store CRUD/search, assignment, normalized duplicate candidate checks and race protection, license store-cap enforcement, transfer command/history, permissions/audit.
- **Frontend:** representative assigned-store list/search and concise GPS-backed registration; manager transfer flow; no map/navigation required.
- **Database:** Store, ownership history, GPS point/index, normalized duplicate search fields; tenant-safe indexes and license-count transaction.
- **Tests:** duplicate phone/name/address/geo cases, cross-rep block, concurrent duplicate and last-license-slot races, immediate activation, transfer history, foreign-tenant IDs.
- **Explicit exclusions:** visit workflow/map routes, territory enforcement, product catalog, order creation.

### Phase 3 — Products, categories, images, catalog, and search
- **Goal:** manager/warehouse-authorized users maintain a tenant catalog; representatives browse and search it quickly.
- **Backend:** product/category APIs, tenant-safe image metadata/authorization, pagination, Persian normalization and indexed search.
- **Frontend:** manager catalog editing; responsive representative product grid, category filters, fast Persian-friendly search and seller-facing details.
- **Database:** Category/Product, optional SKU, image keys, active/version and price/unit fields; PostgreSQL search indexes.
- **Tests:** tenant isolation, search variants/digits, pagination, image authorization/upload validation, product archival with historical references, mobile UX checks.
- **Explicit exclusions:** order/cart, stock mutation, discount engine, public image buckets.

### Phase 4 — Fast order creation, cart, invoice, and editable review
- **Goal:** deliver the catalog-first/search-based flow and safe order lifecycle with request-preserving manager adjustments.
- **Backend:** order draft/submit, authoritative pricing snapshots, idempotent batched creation, status transition service, history, requested-vs-approved quantities, adjustment audit and optimistic versioning.
- **Frontend:** persistent local cart, quick product add/quantity, cart summary, invoice/review/edit, submit state; concise manager order list/detail and approve/adjust flow.
- **Database:** Order, OrderItem, status history, adjustments, idempotency; product/unit/price/discount snapshots and UTC timestamps. Persist local drafts to IndexedDB for resilience.
- **Tests:** workflow/state-transition tests, retry/double-submit, stale-price and concurrent-edit conflicts, quantity edit/removal without losing request, cart persistence/navigation, Persian totals.
- **Explicit exclusions:** order-driven stock decrement/reservation, payment/accounting, full offline synchronization, general reporting.

### Phase 5 — Warehouse and inventory ledger
- **Goal:** manage one tenant warehouse with trustworthy availability and auditable stock movements.
- **Backend:** inventory balance/movement services, receive/adjust/issue operations, negative-stock guard and permission checks; expose availability to manager order detail.
- **Frontend:** compact warehouse stock/search/movement screens and Requested/Available/Approved comparison; no dense ERP dashboard.
- **Database:** Warehouse, InventoryBalance projection, append-only StockMovement, tenant/product/warehouse constraints and indexes. Decide reservation policy before implementing reservations.
- **Tests:** concurrent issue/adjustment, no negative stock, ledger-to-balance reconciliation, tenant boundary, role permission, order mutation cannot write stock.
- **Explicit exclusions:** payments, multi-warehouse routing unless approved, automatic order stock mutation, advanced procurement.

### Phase 6 — Quantity discounts, availability adjustments, notifications
- **Goal:** add the confirmed percentage-threshold discount and integrate manager adjustment/availability policy with reliable notifications.
- **Backend:** representative/product quantity rules, deterministic selection/rounding, order price snapshots, approved-quantity flows and transactional outbox/in-app notifications.
- **Frontend:** clearly explain discount/threshold and show changes on cart/invoice; manager receives concise pending/adjusted status context.
- **Database:** DiscountRule, rule history/effective dates, applied rule snapshot, Notification/OutboxEvent; inventory reservation only if its timing/policy has been approved.
- **Tests:** threshold boundaries, multiple-rule precedence, rounding, snapshot stability, zero-approved lines, outbox retry/deduplication.
- **Explicit exclusions:** generic promotion engine, external push/email unless specified, payment/settlement.

### Phase 7 — Visits, GPS verification, and store map
- **Goal:** representatives start/end auditable visits and managers see authorized store/visit locations.
- **Backend:** visit start/end, GPS/accuracy/time validation, ownership checks, retention/access policy, map-data API; territory fields remain disabled.
- **Frontend:** start-visit GPS prompt/status, visit history, manager MapLibre map using selected tile provider.
- **Database:** Visit and indexed geography points; optional visit points only if route history is explicitly approved.
- **Tests:** permission/ownership, GPS range/accuracy/stale cases, tenant-safe map data, privacy and retention behavior, graceful denied-location UX.
- **Explicit exclusions:** turn-by-turn navigation, live representative tracking, route optimization, active territory blocking.

### Phase 8 — Manager dashboard and reporting
- **Goal:** expose useful operational summaries without turning the app into a cluttered ERP.
- **Backend:** bounded aggregate/report endpoints for stores, sales, order states, top products, inventory, representative activity; permission-aware queries.
- **Frontend:** concise desktop-first dashboard, filters, accessible tables/cards, store map entry point.
- **Database:** verify/extend tenant-scoped reporting indexes; add derived/materialized data only after measured query need.
- **Tests:** aggregation correctness against domain events, timezone/day boundaries, tenant authorization, bounded query performance.
- **Explicit exclusions:** speculative KPI wall, route optimization/live tracking, unrestricted cross-tenant reports.

### Phase 9 — Offline and synchronization
- **Goal:** safely use approved catalog/stores, visits, and orders with intermittent connectivity.
- **Backend:** sync cursor/revision endpoints, idempotent batch processing, conflict responses and reconciliation; server remains final authority.
- **Frontend:** service worker/app shell, tenant/user-scoped IndexedDB cache/outbox, retry status, conflict/review UI and logout cleanup.
- **Database:** idempotency/sync metadata only where needed; no second source of truth for order/inventory.
- **Tests:** duplicate retries, reconnect/replay, stale price/ownership/order conflicts, tenant switching/logout, offline device restart and shared-device privacy.
- **Explicit exclusions:** offline Super Admin, silent last-write-wins, unrestricted offline manager stock changes.

### Phase 10 — Production hardening, performance, security, and QA
- **Goal:** validate operational readiness against real devices/catalog sizes/network conditions and threat model.
- **Backend:** load/query profiling, security review, rate-limit and upload review, backups/restore, observability, alerting, deployment runbooks.
- **Frontend:** phone/tablet/desktop accessibility, RTL and Jalali regression, bundle/image performance, offline/security review where enabled.
- **Database:** migration/rollback strategy, index plans, backup/restore and tenant isolation validation.
- **Tests:** full unit/integration/E2E suite, penetration/security checks, performance/load tests, recovery drills and release gate.
- **Explicit exclusions:** new product scope without separate approval; this phase hardens existing approved behavior.

## 13. Decisions to confirm before the relevant implementation phase

These are intentionally visible rather than guessed. They do not prevent Phase 0 completion.

| Decision | Needed by | Suggested validation |
|---|---|---|
| Deployment/hosting, supported identity provider, login identifier, MFA/session policy | Phase 1 | Confirm hosting, operational ownership, recovery and account lifecycle requirements. |
| Tenant switching/slug model and platform Super Admin account policy | Phase 1 | Verify whether users can belong to multiple companies and how platform access is provisioned/audited. |
| License expiry/grace behavior and whether inactive/archived stores count toward the registered-store cap | Phases 1–2 | Define server behavior, store-count definition, renewal timing, and audit rules. |
| Duplicate GPS radius, name/address similarity threshold, same-owner candidate behavior, exceptional override | Phase 2 | Pilot against real store data; define false-positive handling without silent ownership reassignment. |
| Store registration GPS accuracy requirement and visit proximity/stale-location policy | Phases 2 and 7 | Field-test phone GPS under realistic indoor/outdoor conditions. |
| Rial vs Toman canonical price/storage/input/display unit; quantity precision per sales unit; rounding | Phase 3–4 | Confirm business/accounting conventions and test printed/displayed totals. |
| Price changes between browsing, invoice review, and submit | Phase 4 | Choose a clear re-review/acceptance rule; never silently alter the displayed order. |
| Order cancellation/rejection authority and exact transition semantics | Phase 4 | Agree who can cancel/reject and whether a manager adjustment can be approved directly. |
| Discount overlap/priority, effective time zone, and rounding | Phase 6 | Confirm rule precedence and whether discounts stack (recommended initial default: no stacking). |
| Inventory reservation timing, negative-stock behavior, backorders, and reversal on cancellation | Phase 5 | Decide whether approval/preparation reserves stock; orders themselves must not directly mutate stock. |
| Map tile provider, licensing, regional coverage, and location retention | Phase 7 | Select a provider compatible with target geography and deployment/privacy policy. |
| Offline access scope, stale catalog/price handling, visit timestamp acceptance, shared-device policy | Phase 9 | Define allowed actions and conflict UX before enabling offline writes. |

## 14. Explicit Phase 0 exclusions

Nothing below has been built or configured: authentication, authorization, tenants, licenses, product/store/order/inventory/visit entities, APIs, services, repositories, user interfaces, cart, catalog, maps/GPS, storage, notification delivery, offline/PWA support, dashboard, Docker, deployment, database, migrations, seeds, or test infrastructure. All are future roadmap items. No Phase 1 work has started.

## 15. Phase 0 changed files

- `README.md` — retained the existing title and added a pointer to the Phase 0 architecture document.
- `docs/architecture/phase-0-audit.md` — this audit, recommendation, UX architecture, domain model, security/performance notes, open decisions, and phased roadmap.

## 16. Verification status

- Before changes: branch was `arena/01a107e6-bazaria`; worktree was clean; only `README.md` was tracked.
- No package manifest, lockfile, or test/build/lint/type-check script exists. Therefore the repository's application tests, lint, type-check, and build are **not applicable / not runnable**, not reported as passing.
- `git diff --check` passed for the documentation-only diff before commit; the changed-file review found only the README and this architecture document. No application test, lint, type-check, or build could be run because no project manifests or scripts exist.

## 17. Phase 0 completion gate

Phase 0 is complete only when the two documentation files are reviewed, the documentation diff is clean, and one commit exists on `arena/01a107e6-bazaria`. Stop after reporting the commit and Git status. Wait for the project owner; do not start Phase 1 automatically.
