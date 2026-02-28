---
name: new-component
description: Scaffold a new React component following Paper Trail conventions
argument-hint: <category>/<ComponentName> (e.g., features/settings/NewSection or ui/Toggle)
user-invocable: true
allowed-tools: Read, Write, Glob, Grep
---

# New Component Scaffolding

Create a new component following the project's file structure conventions.

The argument should be a path like `features/settings/NewSection` or `ui/Toggle`.

## Component Structure

Create these files:
```
src/app/components/<path>/
├── index.tsx
├── styles.module.css
└── ComponentName.test.tsx
```

## Rules

1. **CSS Module**: Always name `styles.module.css`, import as `import styles from "./styles.module.css"`
2. **Test file**: Name `ComponentName.test.tsx` (matching the folder name)
3. **Use existing primitives**: Import from `@/components/ui/` and `@/components/layout/` - never recreate them
4. **Icons**: Use `lucide-react` for icons
5. **Theme support**: Ensure component works in both light and dark themes
6. **Accessibility**: Follow WCAG 2.1 AA - semantic HTML, keyboard accessible, proper ARIA attributes
7. **Code style**: Tab indentation, double quotes, async/await, arrow functions in predicates
8. **Tests**: Use `renderToStaticMarkup` from `react-dom/server` with Vitest

## Test Template

```tsx
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ComponentName } from "./index";

describe("ComponentName", () => {
	it("renders correctly", () => {
		const html = renderToStaticMarkup(<ComponentName />);
		expect(html).toContain("expected content");
	});
});
```

## Arguments

$ARGUMENTS - The component path (e.g., `features/invoices/InvoiceSummary`)
