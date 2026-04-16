# Adding a New Widget

Use this guide when you are adding a new public widget surface to the SDK. If the feature lives inside the chat drawer and shares chat streaming lifecycle, add a mode instead. See [adding-new-mode.md](./adding-new-mode.md).

## Architectural Decision First

Choose the widget family before you scaffold files.

| Family | Use When | Required Deliverables |
|--------|----------|-----------------------|
| UISpec / json-render widget | The backend drives structured UI or the widget contains multiple component types | `catalog.ts`, renderer registry, mock UISpec data, catalog route, docs, tests |
| Direct DOM widget | The surface is intentionally small and host-driven, like a pill or overlay affordance | explicit rationale, live catalog preview, docs, tests |

Preferred rule: new backend-driven widgets should use UISpec plus json-render and must be individually previewable in `npm run catalog`.

Current reference points:

- Chat: UISpec widget with Shadow DOM
- QNA: UISpec widget in host DOM
- SimRel: UISpec widget in host DOM
- SimBut: direct-DOM exception for a tiny PDP overlay pill

## Non-Negotiable Rules

1. Keep business and recommendation rules on the backend.
2. Preserve `/chat/*` protocol compatibility unless the work is explicitly a breaking migration.
3. Register the widget in the catalog app with realistic mock data or a live preview frame.
4. Add docs and tests together with the widget.
5. If the widget participates in overlay bootstrap or runtime config, wire it through those shared layers rather than inventing a parallel path.

## Recommended File Layout

### UISpec widget

```text
src/<widget>/
  index.ts
  types.ts
  catalog.ts
  locales/
    tr.ts
    en.ts
    index.ts
  components/
    renderUISpec.ts
    <WidgetComponent>.ts
    <widget>.css
```

### Direct DOM widget

```text
src/<widget>/
  index.ts
  types.ts
  locales.ts or locales/
  <widget>.css
```

Use the direct-DOM shape only when the widget is intentionally simple and does not justify a backend UISpec contract.

## Step-By-Step

### 1. Define the Public Contract

Create `src/<widget>/types.ts` and extend `BaseWidgetConfig`.

Include:

- widget-specific config fields
- domain types used by callbacks or renderers
- i18n interface for user-facing strings

Keep shared types in `src/common/types.ts` only when they truly cross widget boundaries.

### 2. Implement the Widget Class

Create `src/<widget>/index.ts` and extend `BaseWidget<MyWidgetConfig>`.

`BaseWidget` gives you the common lifecycle:

- `init`
- `update`
- `show`
- `hide`
- `destroy`

Use Shadow DOM only when CSS isolation is necessary. Chat needs it; QNA, SimRel, and SimBut do not.

### 3. Add Locale Support

Ship at least Turkish and English unless there is a strong reason not to. Wire a locale resolver so `locale` plus partial `i18n` overrides behave like the existing widgets.

### 4. For UISpec Widgets, Define The Catalog Contract

Create `src/<widget>/catalog.ts` using Zod schemas. The schema file is the contract between backend payloads and frontend renderers.

Also add:

- `components/renderUISpec.ts`
- default registry creation helper
- unknown component fallback behavior

### 5. Add Styles And Part Hooks

Keep classes prefixed with `gengage-<widget>-` and expose stable `data-gengage-part` hooks for customization.

If the widget renders unsafe HTML, add explicit XSS warnings in both code and docs.

### 6. Export The Widget Publicly

Update:

- `src/index.ts`
- `package.json` exports
- `vite.config.iife.ts` if the widget needs its own IIFE bundle
- `scripts/build-iife.ts` if it should be built with the other IIFE targets

### 7. Register The Widget In The Catalog

Minimum catalog work:

1. add mock data under `catalog/src/mock-data/`
2. add a section renderer under `catalog/src/sections/`
3. add routes in `catalog/src/router.ts`
4. wire the section in `catalog/src/main.ts`
5. add any frame helpers needed for realistic preview

For a direct-DOM widget, add a live preview frame rather than pretending it is UISpec-driven.

### 8. Wire Overlay And Runtime Config If Needed

If the widget should participate in `initOverlayWidgets(...)` or file-driven account config, update:

- `src/common/overlay.ts`
- `src/common/config-schema.ts`
- `src/common/client.ts`
- `src/common/preflight.ts`

### 9. Add Documentation

Update the relevant docs, usually:

- [architecture.md](./architecture.md)
- [api-reference.md](./api-reference.md)
- [customization.md](./customization.md)
- [adding-new-widget.md](./adding-new-widget.md) if the general process changed

### 10. Add Tests And Verification

At minimum, cover:

- widget init and update behavior
- overlay/config integration if applicable
- catalog rendering path or preview wiring

Run:

```bash
npm run typecheck
npm run typecheck:catalog
npm run test
npm run build
npm run catalog
```

## Checklist

- [ ] Public widget class extends `BaseWidget`
- [ ] Widget config and i18n types are defined
- [ ] Locale resolution is implemented
- [ ] UISpec widgets include `catalog.ts` and renderer registry
- [ ] Direct-DOM widgets document why they are not UISpec-driven
- [ ] Package exports are updated
- [ ] Catalog section and route are registered
- [ ] Overlay/runtime config integration is wired when required
- [ ] Contributor docs are updated
- [ ] Tests and verification commands pass

## Existing Widgets (Reference)

| Widget | Path | Architecture | Notes |
|--------|------|--------------|-------|
| Chat | `src/chat/` | UISpec plus Shadow DOM | Richest widget and feature-module host |
| QNA | `src/qna/` | UISpec in host DOM | Launcher actions and text input |
| SimRel | `src/simrel/` | UISpec in host DOM | Product grid and grouping surfaces |
| SimBut | `src/simbut/` | Direct DOM exception | Tiny PDP image-overlay pill |

| Widget | Directory | Class | Components |
|--------|-----------|-------|-----------|
| Chat | `src/chat/` | `GengageChat` | 18 types (ActionButtons, ProductCard, etc.) |
| QNA | `src/qna/` | `GengageQNA` | 4 types (ButtonRow, ActionButton, TextInput, QuestionHeading) |
| SimRel | `src/simrel/` | `GengageSimRel` | 6 types (ProductGrid, ProductCard, etc.) |
| SimBut | `src/simbut/` | `GengageSimBut` | PDP "Find Similar" pill button |
