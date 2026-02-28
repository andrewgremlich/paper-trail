---
name: check
description: Run TypeScript type checking and Biome linting/formatting
user-invocable: true
allowed-tools: Bash
---

# Check

Run the project's type checking and formatting pipeline.

```bash
npm run check
```

This runs:
1. `tsc --noEmit` - TypeScript type checking
2. `npx @biomejs/biome check --write ./src` - Biome linting and formatting (auto-fixes)

If errors are found, analyze and fix them. Re-run until clean.
