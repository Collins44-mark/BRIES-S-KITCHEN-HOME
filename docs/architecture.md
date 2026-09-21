# Architecture overview

## Request flow

Browser → Next.js (`apps/web`) → NestJS (`apps/api`) → PostgreSQL (Prisma)

## Money

All financial math uses `decimal.js` / Prisma `Decimal`. Never floating-point for money.

## Auth

1. `POST /auth/login` → access JWT + refresh token (hashed in DB)
2. Access token on `Authorization: Bearer …`
3. `POST /auth/refresh` rotates refresh token
4. Roles: ADMIN, MANAGER, CASHIER, INVENTORY_MANAGER (+ Permission table)

## Sale completion

1. Validate stock
2. Calculate line totals + proportional discount
3. Persist Sale + SaleItems + Payments
4. InventoryMovement SALE (−qty)
5. If customer: ledger SALE (+) then PAYMENT (−) as applicable
