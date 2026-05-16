# Paper Trail — TODO

Open work tracked here. Detailed writeups for security items live in
[`docs/SECURITY_REVIEW_2026_05.md`](docs/SECURITY_REVIEW_2026_05.md);
this file is the actionable checklist.

## Security — High (fail-open on misconfiguration)

- [ ] **H1. `CLERK_BYPASS` production guard.** Refuse the bypass when
  `APP_BASE_URL` isn't `localhost`, `127.0.0.1`, or `*.workers.dev`.
  `api/src/middleware/auth.ts:47-50`. ~10 min.
- [ ] **H2. `ENCRYPTION_KEY` fail-closed.** Reject requests in
  non-bypass mode when the key is unset, instead of silently storing
  plaintext. Apply in `clerkAuth` plus a sibling guard on
  `publicInvoiceRoutes` and `consentRoutes`. ~15 min.

## Security — Medium

- [ ] **M1. ZIP-bomb caps on `/import/zip`.** Cap request body (50 MB),
  total inflated size (200 MB), and entry count (5000).
  `api/src/routes/exportImport.ts:632-694`. ~30 min.
- [ ] **M2. Per-recipient consent-email throttle.** Add a second
  `(userId, lower(email))` daily budget so 30 sends/hour can't be
  sprayed across 30 different addresses. ~1 hour.
- [ ] **M3. Remove unused deps.** `pnpm remove stripe @tanstack/react-table summit-kit class-variance-authority` and run `pnpm knip`. ~5 min.

## Security — Low (defense in depth)

- [ ] **L1.** JWT verifier should pin `header.typ === "JWT"` and reject
  `iat` more than 60 s in the future. `api/src/lib/clerkJwt.ts`.
- [ ] **L2.** Allow 60 s clock-skew on `exp` to match the `nbf`
  allowance. `api/src/lib/clerkJwt.ts:238`.
- [ ] **L3.** `pickPrimaryEmail` should require a verified address;
  500 if none. `api/src/lib/clerkApi.ts:46-54`.
- [ ] **L4.** CSP rollout on public pages. Requires dropping or nonce-ing
  the inline `onclick="window.print()"` in `invoiceHtml.ts:126`. See
  also `docs/SECURITY_REMAINING.md`.
- [ ] **L5.** `timesheetImportSchema` uses `active`; the column is
  `closed`. Round-trip imports lose closed state.
  `api/src/routes/exportImport.ts:50`.
- [ ] **L6.** `/api/v1/export/transactions` binds `Number(uuid)`,
  which is NaN. Stale endpoint — fix or delete.
  `api/src/routes/exportImport.ts:768`.
- [ ] **L7.** Add `AND userId = ?` to chained-FK SELECTs that are
  currently safe-by-upstream-validation only.
  `invoices.ts:517`, `invoices.ts:720`, `publicInvoice.ts:119`.
- [ ] **L8.** Add `Cache-Control: no-store` + HSTS middleware to the
  `v1` router.
- [ ] **L9.** Cache the imported AES `CryptoKey` per isolate so
  `encrypt`/`decrypt` don't re-import on every call.
  `api/src/lib/crypto.ts:5-13`.
- [ ] **L10.** Split CSRF cookies so consent and revoke pages can
  coexist in one browser. `api/src/lib/csrf.ts:23`.
- [ ] **L11.** Gate the draft-invoice preview behind `clerkAuth` —
  serve drafts from `GET /api/v1/invoices/:id/preview` and make
  `/invoice/:id` 404 on null snapshot. `publicInvoice.ts:81-91`.

## Invoice-specific hardening

- [ ] **INV1.** Add `accessTokenExpiresAt` to invoices (e.g.
  `sentAt + 90 days`, `paidAt + 30 days`). Public route 404s after
  expiry. ~1 hour.
- [ ] **INV2.** Move per-invoice access token off the query string —
  signed-cookie + 302-to-bare-URL pattern. Doesn't break existing
  emailed links. ~half-day.
- [ ] **INV4.** Move `viewed` event logging from the GET handler to a
  confirmation beacon so email prefetchers don't poison the signal.
  `publicInvoice.ts:204-223`. ~1 hour.
- [ ] **INV5.** Document the "hosted URL is shareable + manual
  mark-paid is the reconciliation step" trust model in `CLAUDE.md`
  next to the Invoices & Email Delivery section. ~5 min.

## Invoice paid-state visualization

The hosted invoice page currently renders the frozen snapshot only, so
a customer revisiting the URL after the operator marks paid sees the
same "please pay" page they got originally. Fill this gap **without**
building a separate receipt system — the paid invoice IS the receipt.

- [ ] **Render a PAID banner on the hosted page when `row.status === 'paid'`.**
  Read `row.status` + `row.paidAt` at render time (sidecar to the
  immutable snapshot). Green banner with the paid date. Hide payment
  buttons when paid.
- [ ] **Send a payment-received email on `/api/v1/invoices/:id/pay`.**
  Reuses Resend + consent flag + rate limit. One-liner body:
  "Invoice $number for $amount has been marked paid as of $date.
  [View invoice]". Link to the existing hosted URL.
- [ ] **Document the snapshot-vs-status split in `CLAUDE.md`.** Note
  that the snapshot is byte-frozen but `status` / `paidAt` / `voidedAt`
  are mutable sidecar fields surfaced at render time.

## Files / attachments

- [ ] Drag-and-drop zone for file attachment.
- [ ] If file doesn't exist, allow reattach (user clicks and file is
  missing).

## Other open items considered but not tracked

These were surfaced during the May 2026 review and judged not worth
fixing right now. Re-evaluate if the product shape changes.

- **Closed-timesheet entries are still editable.** No `closed` check
  in `timesheetEntryRoutes.put`. Data-integrity issue (timesheet
  source-of-truth can drift from invoiced amount), not security.
- **Invoice numbering race.** Concurrent creates under one user/year
  can compute the same next number; UNIQUE catches it with an error.
  Rare.
- **JWKS thundering herd.** First requests after a cold start each
  fire a JWKS fetch. Coalesce with an in-flight Promise if it ever
  matters.

## Done

- [x] Encrypt `attachments.originalName` — see `docs/FILE_HANDLING.md`.
- [x] R2 cleanup on transaction delete — `ON DELETE SET NULL` orphans
  the attachment; cron sweep removes the R2 object + row after
  `ORPHAN_GRACE_HOURS`.
- [x] Drop the stale "connected Stripe account" copy from the Delete
  All Data confirmation.
- [x] May 2026 doc sweep — README, CLAUDE.md, COMPONENT_ORGANIZATION,
  TANSTACK_START_MIGRATION, db-table skill, code-reviewer agent.
