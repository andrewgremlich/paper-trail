# Paper Trail

A Paper Trail that integrates with Stripe in order to send invoices.

## BUGS

- Generate new timesheet doesn't update the homescreen.

## Setup

Create a `.env` file with the following variables. You will need to setup a Stripe Account and file the secret key in the developer dashboard.

```
URL=http://localhost:3000
DATABASE_URL="file:./dev.db"
STRIPE_SECRET_KEY=
```

This is also managed with Prisma SQLite, so the usual prisma commands are required to get the DB up and running.
