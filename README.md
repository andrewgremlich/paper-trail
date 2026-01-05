# Paper Trail

A Paper Trail that integrates with Stripe in order to send invoices.

## Reference

[Stripe SDK Invoice Doc](https://docs.stripe.com/api/invoices?lang=node)

## Setup

Create a `.env` file with the following variables. You will need to setup a Stripe Account and file the secret key in the developer dashboard.

```
URL=http://localhost:3000
DATABASE_URL="file:./dev.db"
STRIPE_SECRET_KEY=
```

This is also managed with Prisma SQLite, so the usual prisma commands are required to get the DB up and running.

## Grid Usage

The Grid component provides a Tailwind-powered CSS Grid with explicit class mappings so classes are statically detected. It supports columns, rows, auto-flow, and optional template definitions via inline styles.

- **cols**: number of columns (1–12) → `grid-cols-N`
- **rows**: number of rows (1–12) → `grid-rows-N`
- **flow**: auto-flow direction → `grid-flow-row|col|row-dense|col-dense`
- **gap**: inline gap (number interpreted as px or string)
- **templateCols**: inline `grid-template-columns`
- **templateRows**: inline `grid-template-rows`
- **inline**: toggles `inline-grid`
- **fullWidth**: applies `w-full` (default `true`)

Example:

```tsx
import { Grid, GridHeader, GridRow } from "src/app/components/Grid";

export function Example() {
	return (
		<div>
			<GridHeader
				headers={["A", "B", "C"]}
				cols={3}
				flow="row"
				gap={8}
			/>

			<Grid cols={3} rows={2} flow="row-dense" templateCols="1fr 2fr 1fr" templateRows="auto auto">
				<div>Item 1</div>
				<div>Item 2</div>
				<div>Item 3</div>
				<div>Item 4</div>
			</Grid>

			<GridRow cols={2} rows={3} flow="col">
				<div>Left</div>
				<div>Right</div>
			</GridRow>
		</div>
	);
}
```
