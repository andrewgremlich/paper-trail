# Email setup (Resend)

Paper Trail sends invoices and consent requests through [Resend](https://resend.com).
The Worker fetches `https://api.resend.com/emails` with `RESEND_API_KEY`; no SDK
is bundled. Before you can send a single message in production you need to:

1. **Verify a sending domain in Resend.** Use a subdomain you control (e.g.
   `mail.example.com`), not `gmail.com` or any shared inbox provider — those
   will reject your DKIM record.

2. **Publish three DNS records** under that subdomain:

   | Type  | Host                              | Value (from Resend)        |
   | ----- | --------------------------------- | -------------------------- |
   | TXT   | `mail.example.com`                | `v=spf1 include:_spf.resend.com ~all` |
   | CNAME | `resend._domainkey.mail.example.com` | `resend._domainkey.resend.com` |
   | TXT   | `_dmarc.mail.example.com`         | `v=DMARC1; p=quarantine; rua=mailto:dmarc@example.com` |

   Start DMARC at `p=quarantine`. Move to `p=reject` once you've watched the
   `rua=` reports for a week and are sure no legitimate mail is misaligning.

3. **Verify in Resend.** In the dashboard, click "Verify DNS." All three rows
   must show green checks before the API will accept a `from` on this domain.

   You can spot-check from the terminal:

   ```bash
   dig +short txt mail.example.com
   dig +short cname resend._domainkey.mail.example.com
   dig +short txt _dmarc.mail.example.com
   ```

4. **Set the Worker secrets and vars:**

   ```bash
   wrangler secret put RESEND_API_KEY
   # vars in wrangler.jsonc:
   #   APP_BASE_URL  - public URL of the app (no trailing slash)
   #   RESEND_FROM_ADDRESS  - e.g. "Andrew <invoices@mail.example.com>"
   ```

5. **First send.** Run through the consent flow against a customer whose email
   you control:
   - Add the customer from the Customers tab.
   - Click "Request consent" → the customer gets a one-click confirmation
     email pointing to `${APP_BASE_URL}/consent/<token>`.
   - Click Agree.
   - Generate an invoice from a timesheet → click Send.

## When sending fails

The Worker maps Resend errors into specific codes the UI surfaces:

| Code                    | Cause                                           | Fix                                                       |
| ----------------------- | ----------------------------------------------- | --------------------------------------------------------- |
| `DOMAIN_NOT_VERIFIED`   | DKIM/SPF not yet green in Resend                | Re-run `dig`, wait for DNS, then hit "Verify DNS" again.  |
| `CUSTOMER_NOT_CONSENTED`| Consent flag is 0 on the linked customer        | Customers tab → "Request consent" → wait for them to agree.|
| `BUSINESS_INFO_MISSING` | `users.businessName` or `businessAddress` empty | Settings → Invoice profile → fill in both fields.         |
| `EMAIL_NOT_CONFIGURED`  | `APP_BASE_URL` or `RESEND_FROM_ADDRESS` missing | Set in `wrangler.jsonc` and redeploy.                     |
| `RATE_LIMITED`          | More than 30 sends in the last hour for this user| Wait it out; the `Retry-After` header tells you how long. |

## Local development

`.dev.vars` should hold:

```
RESEND_API_KEY=re_test_...
RESEND_FROM_ADDRESS=Andrew <invoices@mail.example.com>
APP_BASE_URL=http://localhost:5173
ENCRYPTION_KEY=<base64 32-byte key from `pnpm enc:key`>
CF_ACCESS_BYPASS=true
CF_ACCESS_DEV_EMAIL=dev@localhost
```

In dev you can either use a real Resend test key (which actually delivers to
verified recipient addresses) or temporarily comment out the `await sendEmail`
call in `api/src/routes/invoices.ts` for offline UI testing.

## Auditing what was sent

Every email-side state change writes a row to `invoice_events` (for invoices)
or `customer_events` (for consent). Query against the local D1 with:

```bash
wrangler d1 execute paper-trail-db --local \
  --command "SELECT * FROM invoice_events ORDER BY createdAt DESC LIMIT 20"
```

Payloads are encrypted; decrypt them with the same `ENCRYPTION_KEY`.
