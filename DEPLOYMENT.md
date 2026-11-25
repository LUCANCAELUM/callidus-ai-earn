# CALLIDUS EARN AI — Architecture, Security & Deployment Guide

## 1. Platform Configuration
- **Platform Name:** CALLIDUS EARN AI
- **Primary Market & Currency:** Kenya (`KES`)
- **Mandatory 80/20 Earnings Allocation:**
  - **80%** credited to User Available Balance (KES cents integer ledger)
  - **20%** recorded to Immutable Allocation Ledger for **M-PESA Paybill `522522`**, **Account Number `1355643775`**
- **Database:** Cloud SQL for PostgreSQL + Drizzle ORM (`src/db/schema.ts`)
- **Authentication:** Firebase Authentication (ID tokens verified server-side via `firebase-admin`)
- **AI Engine:** Server-side `@google/genai` (`gemini-4-hydrogen`) for adaptive task recommendations & evaluation checks

## 2. Safaricom Daraja API Activation Checklist
No simulated real-money transfers are ever executed. When Daraja credentials are absent, allocations record in `pending_daraja_settlement` and withdrawals queue in `pending_daraja_b2c`.

Before activating live M-PESA settlement & withdrawals:
1. Configure Safaricom Daraja production credentials in Cloud Run Secrets (`MPESA_CONSUMER_KEY`, `MPESA_CONSUMER_SECRET`, `MPESA_SHORTCODE`, `MPESA_PASSKEY`, `MPESA_INITIATOR_NAME`, `MPESA_SECURITY_CREDENTIAL`, `MPESA_B2C_SHORTCODE`, `MPESA_CALLBACK_URL`, `MPESA_ENV="production"`).
2. Confirm Paybill `522522` Account `1355643775` supports authorized Daraja B2B settlement (STK Push is customer-initiated C2B only).
3. Register `/api/mpesa/callback` as the HTTPS callback URL on Safaricom Developer Portal.

## 3. Cloud Run Autoscaling & Million-User Readiness
- Stateless Express + Vite production server (`npm run build && npm run start`).
- Separate workloads: Cloud Run horizontal autoscaling (`min-instances=2`, `max-instances=100+`), Cloud SQL connection pooling (`pg.Pool`), Cloud CDN for static PWA bundles, and Cloud Tasks / Pub/Sub for async Daraja batch reconciliation.
- Run progressive load verification before claiming production capacity:
  `k6 run -e BASE_URL=https://your-cloud-run-url tests/load/k6-scalability.js`

## 4. Kenya Data Protection Act Compliance
- Explicit user consent required prior to 80/20 earnings allocation and prior to African Voice Intelligence recording/licensing.
- Immutable audit logs (`audit_logs`) track profile updates, financial allocations, withdrawals, and admin actions.
