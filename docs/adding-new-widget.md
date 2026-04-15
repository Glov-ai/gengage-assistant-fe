# Adding a New Widget

This guide walks through adding a completely new widget to the SDK. A "widget" is an
independent embeddable component (like Chat, QNA, SimRel, or SimBut) — it has its own
Shadow DOM, its own config, and its own UISpec registry.

> **Do you need a new widget, or a new mode?** If the new feature lives inside the
> chat drawer and uses chat streaming, you want a **mode** — see `docs/adding-new-mode.md`.
> A new widget is for a fundamentally different UI surface (e.g. a standalone product
> quiz, a floating review panel).

---

## Widget Anatomy

Every widget follows the same pattern:

```
src/<widget>/
  index.ts          # Public class extending BaseWidget
  types.ts          # Config interface + domain types
  catalog.ts        # Zod schemas for json-render (component contract)
  locales/          # i18n string files (tr.ts, en.ts)
  components/       # Vanilla TS renderers (one file per component)
    <widget>.css    # All widget styles (injected into Shadow DOM)
```

All widgets share `src/common/` for types, streaming, events, analytics, and the
renderer foundation.

---

## Step-by-Step

### 1. Create the Directory Structure

```bash
mkdir -p src/mywidget/components src/mywidget/locales
```

### 2. Define Types

**File:** `src/mywidget/types.ts`

```ts
import type { GengageWidgetConfig } from '../common/types.js';

export interface MyWidgetConfig extends GengageWidgetConfig {
  // Widget-specific config fields
  someSetting?: string;
}

export interface MyWidgetI18n {
  title: string;
  // ... all user-facing strings
}
```

### 3. Create the Widget Class

**File:** `src/mywidget/index.ts`

```ts
import { BaseWidget } from '../common/widget-base.js';
import type { MyWidgetConfig } from './types.js';
import styles from './components/mywidget.css?inline';

export class GengageMyWidget extends BaseWidget<MyWidgetConfig> {
  private _shadow: ShadowRoot | null = null;

  protected async onInit(config: MyWidgetConfig): Promise<void> {
    this._shadow = this.root.attachShadow({ mode: 'open' });
    const style = document.createElement('style');
    style.textContent = styles;
    this._shadow.appendChild(style);
    // Build DOM, set up event listeners
  }

  protected onUpdate(config: Partial<MyWidgetConfig>): void {
    // Handle config changes (e.g. SPA page navigation)
  }

  protected onShow(): void { /* widget becomes visible */ }
  protected onHide(): void { /* widget becomes hidden */ }
  protected onDestroy(): void { /* cleanup: abort controllers, remove listeners */ }
}

export type { MyWidgetConfig };
```

`BaseWidget` gives you `init()`, `update()`, `show()`, `hide()`, `destroy()`,
config storage, and the root element lifecycle.

### 4. Define the Catalog Schemas

**File:** `src/mywidget/catalog.ts`

```ts
import { z } from 'zod';

export const MyComponentSchema = z.object({
  type: z.literal('MyComponent'),
  props: z.object({
    title: z.string(),
    items: z.array(z.string()),
  }),
});

// Export all schemas for validation
export const MY_WIDGET_SCHEMAS = {
  MyComponent: MyComponentSchema,
};
```

These Zod schemas are the **contract** between backend and frontend. They define what
props each component type expects.

### 5. Create Component Renderers

**File:** `src/mywidget/components/MyComponent.ts`

```ts
import type { UIElement } from '../../common/types.js';

export function renderMyComponent(element: UIElement): HTMLElement {
  const wrapper = document.createElement('div');
  wrapper.className = 'gengage-mywidget-component';
  wrapper.dataset['gengagePart'] = 'mywidget-component';
  // Build DOM from element.props
  return wrapper;
}
```

### 6. Create the UISpec Registry

```ts
// In index.ts or a dedicated registry file:
import type { UISpecDomRegistry } from '../common/renderer/index.js';
import { renderMyComponent } from './components/MyComponent.js';

const MY_WIDGET_REGISTRY: UISpecDomRegistry<MyWidgetRenderContext> = {
  MyComponent: ({ element, context }) => renderMyComponent(element),
};
```

### 7. Add Styles

**File:** `src/mywidget/components/mywidget.css`

```css
/* All classes prefixed with gengage-mywidget- */
.gengage-mywidget-root { ... }
.gengage-mywidget-component { ... }
```

The CSS is imported as `?inline` in the widget's `index.ts` and injected into
Shadow DOM, so it won't leak into the host page.

### 8. Add Locales

```ts
// src/mywidget/locales/tr.ts
import type { MyWidgetI18n } from '../types.js';
export const MY_WIDGET_I18N_TR: MyWidgetI18n = {
  title: 'Turkce baslik',
};

// src/mywidget/locales/en.ts
import type { MyWidgetI18n } from '../types.js';
export const MY_WIDGET_I18N_EN: MyWidgetI18n = {
  title: 'English title',
};
```

### 9. Export from Package Entry Point

Add your widget to the package exports so consumers can import it:

```ts
// package.json "exports" field:
"./<widget>": {
  "types": "./dist/<widget>/index.d.ts",
  "import": "./dist/<widget>/index.js"
}
```

### 10. Add to the Build

Ensure Vite builds your widget. Check `vite.config.ts` for the entry point
configuration — each widget is a separate entry.

---

## Catalog Registration

The catalog is a separate app (`catalog/`) that renders every component with mock
data. It imports from `dist/` (the built npm package).

### a) Add Mock UISpec Data

**File:** `catalog/src/mock-data/mywidget-specs.ts`

```ts
export const MY_WIDGET_SPECS: Record<string, { spec: Record<string, unknown>; description: string }> = {
  MyComponent: {
    description: 'A brief description of the component.',
    spec: {
      root: 'root',
      elements: {
        root: {
          type: 'MyComponent',
          props: {
            title: 'Example Title',
            items: ['Item A', 'Item B'],
          },
        },
      },
    },
  },
};
```

### b) Create a Section Renderer

**File:** `catalog/src/sections/mywidget-components.ts`

Follow the pattern in `catalog/src/sections/chat-components.ts`:

```ts
import { MY_WIDGET_SPECS } from '../mock-data/mywidget-specs.js';

export const MY_WIDGET_COMPONENT_NAMES = Object.keys(MY_WIDGET_SPECS);

export function renderMyWidgetComponent(container: HTMLElement, name: string): void {
  const entry = MY_WIDGET_SPECS[name];
  if (!entry) { container.textContent = `Unknown: ${name}`; return; }
  // Use renderUISpecWithRegistry to render the component
  // Wrap in a frame that matches the widget's display context
}
```

### c) Add Routes

**File:** `catalog/src/router.ts`

```ts
export const ROUTES: Route[] = [
  // ... existing routes ...
  {
    path: '/mywidget',
    label: 'MyWidget Components',
    section: 'mywidget',
    children: [
      { path: '/mywidget/MyComponent', label: 'MyComponent' },
    ],
  },
  // ...
];
```

### d) Wire into Main

**File:** `catalog/src/main.ts`

Add a case for your section in the route handler switch statement.

### e) Verify

```bash
npm run build && npm run catalog
# Navigate to http://localhost:3002/#/mywidget/MyComponent
```

---

## Embedding Pattern

Document how customers embed the widget. Follow the existing patterns:

**Script tag (IIFE):**
```html
<script src="https://unpkg.com/@gengage/assistant-fe/dist/mywidget/index.iife.js"></script>
<script>
  const widget = new GengageMyWidget();
  widget.init({ accountId: 'store', mountTarget: '#widget-root' });
</script>
```

**ESM:**
```js
import { GengageMyWidget } from '@gengage/assistant-fe/mywidget';
const widget = new GengageMyWidget();
await widget.init({ accountId: 'store', mountTarget: '#widget-root' });
```

---

## Checklist

- [ ] Directory structure: `src/<widget>/index.ts`, `types.ts`, `catalog.ts`, `components/`, `locales/`
- [ ] Widget class extending `BaseWidget` with Shadow DOM
- [ ] Zod catalog schemas defining the component contract
- [ ] Component renderers (one file per component type)
- [ ] UISpec registry mapping type names to renderers
- [ ] CSS with `gengage-<widget>-` prefix, imported as `?inline`
- [ ] i18n locales (at minimum `tr.ts`)
- [ ] Package exports in `package.json`
- [ ] Vite build entry point
- [ ] Catalog mock specs in `catalog/src/mock-data/<widget>-specs.ts`
- [ ] Catalog section renderer in `catalog/src/sections/<widget>-components.ts`
- [ ] Catalog route in `catalog/src/router.ts`
- [ ] Catalog main.ts wiring
- [ ] `npm run typecheck` passes
- [ ] `npm run test` passes
- [ ] `npm run build && npm run catalog` — all components render correctly
- [ ] Demo page in `demos/` (optional, for integration testing)

---

## Existing Widgets (Reference)

| Widget | Directory | Class | Components |
|--------|-----------|-------|-----------|
| Chat | `src/chat/` | `GengageChat` | 18 types (ActionButtons, ProductCard, etc.) |
| QNA | `src/qna/` | `GengageQNA` | 4 types (ButtonRow, ActionButton, TextInput, QuestionHeading) |
| SimRel | `src/simrel/` | `GengageSimRel` | 6 types (ProductGrid, ProductCard, etc.) |
| SimBut | `src/simbut/` | `GengageSimBut` | PDP "Find Similar" pill button |
