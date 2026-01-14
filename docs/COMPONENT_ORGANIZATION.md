# Component Organization

This document describes the recommended organization structure for React components in the Paper Trail application.

## Directory Structure

```
src/app/components/
├── ui/                          # Base/primitive UI components
│   ├── Button/
│   ├── Card/
│   ├── Dialog/
│   ├── Input/
│   ├── Select/
│   ├── Spinner/
│   ├── Table/
│   └── Grid/
├── layout/                      # Layout components
│   ├── Flex/
│   ├── Nav/
│   ├── PageWrapper/
│   └── HtmlElements/
├── features/                    # Feature-specific components
│   ├── projects/
│   │   ├── ProjectEditForm/
│   │   ├── ProjectModal/
│   │   └── GenerateProject/
│   ├── timesheets/
│   │   ├── TimesheetEditForm/
│   │   ├── TimesheetModal/
│   │   ├── TimesheetTable/
│   │   ├── GenerateTimesheet/
│   │   └── CreateTimesheetRecord/
│   ├── transactions/
│   │   ├── TransactionEditRow/
│   │   └── TransactionViewRow/
│   ├── invoices/
│   │   ├── GenerateInvoice/
│   │   └── PayVoidButtons/
│   └── settings/
│       ├── SettingsModal/
│       ├── StripeSecretSection/
│       ├── SyncSettings/
│       └── ExportImportSection/
├── shared/                      # Shared utility components
│   ├── EditToggleButton/
│   ├── DeleteItem/
│   ├── CardPreview/
│   └── ErrorBoundary/
└── index.ts                     # Barrel export (optional)
```

## Category Descriptions

### UI Components (`ui/`)

Primitive, reusable UI components that form the building blocks of the application. These components:

- Are highly reusable across different features
- Have no business logic or feature-specific knowledge
- Can be used in isolation or composed together
- Should have CSS modules and corresponding test files
- Examples: Button, Input, Select, Dialog, Spinner, Table, Grid

**Characteristics:**
- Generic and configurable via props
- No direct integration with application state or API calls
- Can be exported and used in any part of the application

### Layout Components (`layout/`)

Components responsible for page structure and layout patterns. These components:

- Handle visual arrangement and spacing
- Provide consistent layout patterns across pages
- May wrap other components to provide structure
- Examples: Flex, Nav, PageWrapper, HtmlElements

**Characteristics:**
- Focus on positioning and layout logic
- May include responsive behavior
- Often act as container components

### Feature Components (`features/`)

Business-logic-heavy components organized by feature domain. These components:

- Implement specific application features
- May integrate with APIs, database queries, or global state
- Are often composed of multiple UI and shared components
- Organized by feature area (projects, timesheets, invoices, etc.)

**Characteristics:**
- Feature-specific and less reusable across domains
- Contain business logic and data fetching
- May manage local state for complex interactions

#### Feature Subdirectories

**`features/projects/`**
- Components related to project management
- Includes project creation, editing, and viewing

**`features/timesheets/`**
- Components for timesheet functionality
- Handles time tracking, entry management, and timesheet display

**`features/transactions/`**
- Components for transaction management
- Separate transaction viewing and editing concerns

**`features/invoices/`**
- Components related to invoice generation and management
- Integration with Stripe for payments

**`features/settings/`**
- Application settings and configuration components
- Includes Stripe configuration, sync settings, and data import/export

### Shared Components (`shared/`)

Utility components that are reused across multiple features but don't fit into the UI primitive category. These components:

- Have some level of application-specific knowledge
- Are reused across multiple feature areas
- May have light business logic or feature awareness
- Examples: EditToggleButton, DeleteItem, CardPreview, ErrorBoundary

**Characteristics:**
- More specific than UI components but more generic than feature components
- Reusable across multiple feature domains
- May have some awareness of application patterns

## File Structure Within Component Directories

Each component directory should follow this structure:

```
ComponentName/
├── index.tsx                    # Main component file
├── ComponentName.module.css     # CSS module styles
├── ComponentName.test.tsx       # Component tests
└── README.md                    # Optional: complex component documentation
```

## Benefits

### 1. Clear Separation of Concerns
- UI primitives are clearly separated from business logic
- Feature components are organized by domain
- Easy to understand component hierarchy

### 2. Scalability
- New features can be added without cluttering the root
- Each feature area can grow independently
- Easy to identify which components belong to which feature

### 3. Discoverability
- Related components are grouped together
- Clear naming conventions make components easy to find
- New developers can quickly understand the codebase structure

### 4. Maintenance
- Easy to locate components for updates
- Feature-based organization aligns with typical development tasks
- Reduced cognitive load when working on specific features

### 5. Code Splitting
- Feature-based organization enables easy lazy loading
- Can optimize bundle size by loading features on demand
- Clear boundaries for code splitting decisions

## Migration Strategy

When migrating to this structure:

1. Start with UI components - move primitive components to `ui/`
2. Move layout components to `layout/`
3. Group feature components by domain into `features/`
4. Move remaining shared components to `shared/`
5. Update all import paths throughout the application
6. Verify tests still pass after migration
7. Update path aliases in `tsconfig.json` if needed

## Import Examples

```tsx
// UI components
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

// Layout components
import { PageWrapper } from "@/components/layout/PageWrapper";
import { Nav } from "@/components/layout/Nav";

// Feature components
import { ProjectEditForm } from "@/components/features/projects/ProjectEditForm";
import { TimesheetTable } from "@/components/features/timesheets/TimesheetTable";

// Shared components
import { EditToggleButton } from "@/components/shared/EditToggleButton";
import { ErrorBoundary } from "@/components/shared/ErrorBoundary";
```

## Barrel Exports (Optional)

You may optionally create barrel exports for cleaner imports:

```tsx
// src/app/components/ui/index.ts
export { Button } from "./Button";
export { Input } from "./Input";
export { Select } from "./Select";
// ... other UI components

// Usage
import { Button, Input, Select } from "@/components/ui";
```

**Note:** Be cautious with barrel exports as they can impact tree-shaking and bundle size. Only use them when the benefits outweigh the costs.

## Guidelines

### When to Create a New Component

**Create in `ui/`** when:
- The component is a generic UI primitive
- It has no business logic
- It could be used in multiple different contexts
- It could theoretically be extracted into a component library

**Create in `layout/`** when:
- The component primarily handles layout and positioning
- It provides consistent structural patterns
- It's used across multiple pages or features

**Create in `features/`** when:
- The component is specific to a particular feature domain
- It contains business logic or data fetching
- It's unlikely to be reused outside its feature area

**Create in `shared/`** when:
- The component is reused across multiple features
- It has some application-specific knowledge
- It doesn't fit cleanly into UI or feature categories

### Naming Conventions

- Use PascalCase for component directories and files
- Be descriptive with names (e.g., `ProjectEditForm` not `EditForm`)
- Prefix feature-specific components with their domain when exported
- Keep CSS module names matching the component name

## Future Considerations

As the application grows, consider:

- **Storybook integration** for UI component documentation
- **Component composition patterns** documentation
- **Shared hooks** directory for feature-specific hooks
- **Component versioning** strategy for breaking changes
- **Design system** documentation for UI components
