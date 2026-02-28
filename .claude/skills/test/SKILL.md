---
name: test
description: Run Vitest tests for the project
argument-hint: [optional file path to test]
user-invocable: true
allowed-tools: Bash
---

# Test

Run the project's test suite using Vitest.

If an argument is provided, run only that test file:
```bash
npx vitest run $ARGUMENTS
```

If no argument, run all tests:
```bash
npm run test
```

If tests fail, analyze the failures and suggest fixes.
