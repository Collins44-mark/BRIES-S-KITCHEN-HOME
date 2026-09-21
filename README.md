# BRIE'S HOME & KITCHEN — Retail Management System

Production-ready monorepo for a kitchenware retail business.

**Brand:** BRIE'S HOME & KITCHEN  
**Tagline:** Quality for a Better Home

## Stack

| Layer | Technology | Deploy target |
|-------|------------|---------------|
| Frontend | Next.js (App Router) + TypeScript + Tailwind | Vercel |
| Backend | NestJS + Prisma + JWT | Render |
| Database | PostgreSQL | Supabase |

## Requirements

- Node.js 20+
- pnpm 9+
- Docker (for local PostgreSQL) **or** a PostgreSQL connection string

## Installation

```bash
cd bries-home-kitchen
pnpm install
cp .env.example .env
```

Edit `.env` and set `DATABASE_URL`, JWT secrets, and `FRONTEND_URL`.

Frontend env (already scaffolded):

```bash
# apps/web/.env.local
NEXT_PUBLIC_API_URL=http://localhost:4000/api
```

## Local database (Docker)

```bash
docker compose up -d
```

Default local URL (port **5433** to avoid conflicts):

```
postgresql://postgres:postgres@localhost:5433/bries_home_kitchen?schema=public
```

## Prisma

```bash
pnpm db:generate
pnpm db:migrate
pnpm db:seed
pnpm db:studio
```

## Development

```bash
# both apps
pnpm dev

# or separately
pnpm dev:api   # http://localhost:4000/api  (Swagger: /api/docs)
pnpm dev:web   # http://localhost:3000
```

### Demo login

- **Email:** `collins@mark.local`
- **Password:** `Admin@12345`

## Scripts

| Script | Description |
|--------|-------------|
| `pnpm dev` | Start API + web |
| `pnpm build` | Build all packages |
| `pnpm lint` | Lint web + api |
| `pnpm test` | Run API tests |
| `pnpm typecheck` | TypeScript checks |
| `pnpm db:migrate` | Run Prisma migrations |
| `pnpm db:seed` | Seed demo data |
| `pnpm db:studio` | Open Prisma Studio |

## Architecture

```
bries-home-kitchen/
├── apps/web          Next.js UI (presentation only)
├── apps/api          NestJS business logic + APIs
├── packages/types    Shared TypeScript contracts
├── prisma            Schema, migrations, seed
└── docs              Additional documentation
```

Business rules (sales, discounts, profit, inventory, debt ledger) live in the **API**, never in React components.

### Key engines

- **Discount engine** — percentage/fixed, proportional line allocation
- **Profit engine** — net sales − COGS after discount (Decimal.js)
- **Inventory engine** — movements for PURCHASE / SALE / RETURN / ADJUSTMENT / DAMAGE / LOSS
- **Debt ledger** — `CustomerTransaction` entries (SALE +, PAYMENT −), not a mutable single field

## Production build

```bash
pnpm build
```

## Deploy — Vercel (frontend)

1. Import the repo in Vercel
2. Set root to `apps/web` (or monorepo filter)
3. Env: `NEXT_PUBLIC_API_URL=https://your-api.onrender.com/api`
4. Build command: `cd ../.. && pnpm --filter @bries/web build` (adjust to your setup)

## Deploy — Render (API)

1. Create a Web Service from this repo
2. Root directory: `apps/api`
3. Build: `cd ../.. && pnpm install && pnpm db:generate && pnpm --filter @bries/api build`
4. Start: `pnpm --filter @bries/api start:prod`
5. Env vars:
   - `DATABASE_URL` (Supabase)
   - `JWT_SECRET`
   - `JWT_REFRESH_SECRET`
   - `FRONTEND_URL` (Vercel URL)
   - `PORT` (Render sets this)

Run migrations on deploy:

```bash
pnpm db:migrate:deploy
```

## Deploy — Supabase PostgreSQL

1. Create a Supabase project
2. Copy the connection string (Transaction or Session pooler as needed)
3. Set `DATABASE_URL` in Render (and locally if desired)
4. Run `pnpm db:migrate:deploy` against that database

## API modules

Auth, Users, Products, Categories, Inventory, Sales, Payments, Customers, Debts, Purchases, Expenses, Reports, Dashboard, AuditLogs

Swagger: `http://localhost:4000/api/docs`

## License

Private — BRIE'S HOME & KITCHEN
