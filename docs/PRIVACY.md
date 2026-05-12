# Privacy notes

This document records what Paper Trail stores about customers, why, and how
long. It exists so the design choices around the Resend overhaul can be
re-examined later without re-discovering them from code.

## Personal data we store

| Field                                | Where                | Encrypted at rest? | Why we need it |
| ------------------------------------ | -------------------- | ------------------ | ------------- |
| Customer name                        | `customers.name`     | Yes (AES-256-GCM)  | Addressing invoices |
| Customer email                       | `customers.email`    | Yes                | Sending invoices via Resend |
| Customer postal address              | `customers.address`  | Yes                | "Bill to" block on the invoice; mail-a-check option |
| Consent flag + timestamps            | `customers.consent*` | No (operational)   | Proof of opt-in for electronic invoicing |
| Consent IP hash                      | `customers.consentIpHash` | No (SHA-256, salted with ENCRYPTION_KEY) | Pseudonymous fingerprint of who clicked Agree |
| Consent UA hash                      | `customers.consentUaHash` | No (SHA-256, salted) | Same as above |
| Invoice snapshot (frozen on send)    | `invoices.snapshot`  | Yes                | Tamper-evident copy of what was emailed |
| Audit log payloads                   | `*_events.payload`   | Yes                | Diagnostics + consent provenance |
| Viewer IP/UA hashes (hosted page)    | inside `invoice_events.payload` | Yes (and pre-hashed) | Tells the user "your customer opened the invoice" without storing raw IPs |
| Sender Venmo / PayPal handles        | `users.venmo/paypalHandle` | Yes        | Used to build payment links on the rendered invoice |
| Sender business name + address       | `users.businessName/businessAddress` | Yes | Required invoice fields |

## What we do **not** store

- Raw IP addresses or User-Agent strings. Only `SHA-256(ENCRYPTION_KEY || value)`
  is ever written, so the column is a stable pseudonym you can match against
  but can't reverse without the encryption key.
- Payment instrument details (card numbers, bank accounts). Venmo and PayPal
  handle the money; we just produce a deep link.
- Marketing or behavioural data. No analytics SDK.
- The body of any invoice or email in the application log. Logs reference
  invoice IDs and event types only.

## Lawful basis

- **Contract performance.** Customers are people the user is already invoicing
  through some out-of-band engagement; storing their contact info is necessary
  to perform that contract.
- **Explicit consent for electronic invoicing.** A customer cannot receive a
  Paper Trail invoice by email unless they have clicked Agree on a per-customer
  consent page. Consent provenance is logged to `customer_events`. The user can
  also still mail an invoice as a physical document (browser print-to-PDF) or
  pass a hosted URL by any channel.

## Retention

- **Invoices and audit events are never hard-deleted.** Soft-delete via
  `invoices.archivedAt`. This matches US tax-record norms (the IRS asks for
  3–7 years; we keep indefinitely until the user explicitly purges).
- **Customer delete** is allowed only when no invoices reference them. The
  app's customer-delete route blocks otherwise with `CUSTOMER_HAS_INVOICES`.
- **User account delete** (Settings → Delete all data) wipes invoices,
  invoice_events, customers, customer_events, timesheets, transactions,
  projects, and R2 files for that user, then keeps the bare `users` row so
  Cloudflare Access can still resolve it on the next login.

## Customer rights

Paper Trail is a small single-tenant application; rights requests are
serviced by the operator manually:

- **Access** — export the user's view of their own data from
  Settings → Export/Import.
- **Erasure** of a single customer — first void/archive their invoices, then
  delete the customer from the Customers tab.
- **Revoke consent** — open the customer in the Customers tab and edit the
  `consentToEmailInvoices` flag back to false (UI checkbox to be added; for
  now run a SQL `UPDATE customers SET consentToEmailInvoices = 0 WHERE id = ?`).
  This blocks future sends; past invoices remain (legal record).

## Sub-processors

- **Cloudflare** — hosts the Worker, D1, R2 bucket, and Cloudflare Access.
- **Resend** — delivers the consent and invoice emails. Resend has a public
  DPA and is SOC 2 Type II. Email bodies contain customer-identifying data;
  the Resend account is the second place this data lives at rest.

If the operator needs to drop Resend, the `api/src/lib/resend.ts` wrapper is
the only place to swap.
