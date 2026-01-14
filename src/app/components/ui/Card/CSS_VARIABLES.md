# Card Component CSS Variables

This document lists the CSS variables used by the Card component. These variables are defined in `src/app/globals.css`.

## Required CSS Variables

The Card component uses the following CSS variables for styling:

### `--card`
- **Purpose**: Background color of the card
- **Light mode default**: `#ffffff` (white)
- **Dark mode default**: `#0a0a0a` (near black)

### `--card-foreground`
- **Purpose**: Text color inside the card
- **Light mode default**: `#171717` (dark gray)
- **Dark mode default**: `#ededed` (light gray)

### `--border`
- **Purpose**: Border color for the card and hover state
- **Light mode default**: `#e2e8f0` (light blue-gray)
- **Dark mode default**: `#334155` (dark blue-gray)

## Usage

These variables are automatically applied through the Card.module.css file:

```css
.card {
	background-color: var(--card);
	color: var(--card-foreground);
	border: 1px solid var(--border);
}
```

The variables are defined in `src/app/globals.css` and automatically switch between light and dark mode based on the user's system preference via the `@media (prefers-color-scheme: dark)` media query.
