# Adding a New Assistant Mode

This guide walks through adding a new assistant mode (like `beauty_consulting` or
`watch_expert`) to the chat widget. A "mode" changes the chat's behavior — different
input handling, custom UI components, backend-driven UI hints — without creating a
separate widget.

> **Prerequisite:** Read `docs/architecture.md` and `docs/wire-protocol.md` first.

---

## Architecture: Feature Modules

Mode-specific code lives in **feature modules** under `src/chat/features/<mode-name>/`.
Central files (`index.ts`, `ChatDrawer.ts`, `renderUISpec.ts`) contain only thin hooks
that delegate to these modules. This keeps the central files stable and makes each mode
independently reviewable.

```
src/chat/features/beauty-consulting/   <-- reference implementation
  registry.ts           # UISpec component registrations
  mode-controller.ts    # AssistantModeController (state, hints, redirect)
  stream-handler.ts     # Stream-time UISpec interception
  drawer-extensions.ts  # ChatDrawer DOM helpers
```

---

## Step-by-Step

### 1. Register the Mode String

**File:** `src/chat/assistant-mode.ts`

Add your mode to the `AssistantMode` union type and the `RECOGNISED_MODES` array:

```ts
export type AssistantMode = 'shopping' | 'booking' | 'beauty_consulting' | 'watch_expert' | 'your_mode';

const RECOGNISED_MODES: readonly AssistantMode[] = ['beauty_consulting', 'watch_expert', 'booking', 'your_mode'];
```

The backend sends this string in `context.panel.assistant_mode` and in redirect
metadata payloads. The `AssistantModeController` will automatically recognize it.

### 2. Create the Feature Module Directory

```bash
mkdir -p src/chat/features/your-mode
```

### 3. Add Mode-Specific UISpec Components

If your mode introduces new UISpec component types (e.g. `PhotoAnalysisCard` for
beauty, or a hypothetical `WatchFacePreview` for watch expert):

**a) Create the component renderer:**

```
src/chat/components/YourComponent.ts
```

Follow the existing pattern — export a `renderYourComponent(element, ctx)` function
that returns `HTMLElement`. Add props parsing if the stream handler needs structured
data from the component.

**b) Create a feature registry:**

```ts
// src/chat/features/your-mode/registry.ts
import type { UISpecDomRegistry } from '../../../common/renderer/index.js';
import type { ChatUISpecRenderContext } from '../../types.js';
import { renderYourComponent } from '../../components/YourComponent.js';

export const yourModeRegistry: Partial<UISpecDomRegistry<ChatUISpecRenderContext>> = {
  YourComponent: ({ element, context }) => renderYourComponent(element, context),
};
```

**c) Spread into the default registry:**

```ts
// src/chat/components/renderUISpec.ts — one-line addition
import { yourModeRegistry } from '../features/your-mode/registry.js';

const DEFAULT_CHAT_UI_SPEC_REGISTRY: ChatUISpecRegistry = {
  // ... existing entries ...
  ...beautyConsultingRegistry,
  ...yourModeRegistry,              // <-- add this
};
```

### 4. Add Stream Handling (if needed)

If your mode's UISpec components need special stream-time behavior (e.g. intercepting
a component before it reaches the panel, attaching data to the bot message):

```ts
// src/chat/features/your-mode/stream-handler.ts
import type { ChatMessage } from '../../types.js';

export interface YourModeStreamState {
  // per-stream state fields
}

export function createYourModeStreamState(): YourModeStreamState { ... }

export function handleYourModeUISpec(
  componentType: string,
  rootElementProps: Record<string, unknown>,
  state: YourModeStreamState,
  ctx: { drawer: ...; ... },
  botMsg: ChatMessage,
): boolean {
  // Return true if handled, false to fall through to generic handling
}

export function flushYourModeStreamComplete(state: YourModeStreamState, ctx: ...): void { ... }
export function flushYourModeStreamError(state: YourModeStreamState, ctx: ...): void { ... }
```

Then in `index.ts`, add a thin delegation call next to the existing beauty one:

```ts
// In _startStream's onUISpec handler:
const yourModeState = createYourModeStreamState();

// ... after beautyStreamState handling:
if (handleYourModeUISpec(componentType, rootElement?.props ?? {}, yourModeState, { ... }, botMsg)) {
  return;
}
```

### 5. Add Drawer Extensions (if needed)

If your mode needs custom DOM slots in the chat drawer (like the beauty photo step
slot above the input area):

```ts
// src/chat/features/your-mode/drawer-extensions.ts
export function applyYourModeSlot(
  slotEl: HTMLElement | null,
  conversationEl: HTMLElement | null,
  options: { visible: boolean; ... },
): HTMLElement | null { ... }
```

Then add a thin method in `ChatDrawer.ts` that delegates:

```ts
setYourModeSlot(options: { visible: boolean }): void {
  this._yourModeSlotEl = applyYourModeSlot(this._yourModeSlotEl, this._conversationEl, options);
}
```

### 6. Add Mode-Specific Behavior to the Controller

The `AssistantModeController` in `src/chat/features/beauty-consulting/mode-controller.ts`
is currently shared across all non-shopping modes. If your mode needs different behavior
(e.g. different attachment routing, different thinking condensation), extend the
controller or create a mode-specific one:

```ts
// In mode-controller.ts:
resolveAttachmentActionType(): 'user_message' | 'findSimilar' | 'your_action' {
  if (this._mode === 'beauty_consulting') return 'user_message';
  if (this._mode === 'your_mode') return 'your_action';
  return 'findSimilar';
}
```

### 7. Add CSS

Add styles for your new components in `src/chat/components/chat.css`. Prefix all
class names with `gengage-chat-` and add `data-gengage-part` attributes for
customer-facing selectors:

```css
.gengage-chat-your-component { ... }
```

### 8. Add i18n Strings

Add translatable strings to the locale files:

```ts
// src/chat/locales/tr.ts
yourComponentTitle: 'Turk lokalizasyonu',

// src/chat/locales/en.ts
yourComponentTitle: 'English localization',
```

And add the keys to the `ChatI18n` interface in `src/chat/types.ts`.

### 9. Register in the Catalog

This makes your new components visible in the visual catalog (`npm run catalog`).

**a) Add mock UISpec data:**

```ts
// catalog/src/mock-data/chat-specs.ts
YourComponent: {
  description: 'Description of what this component does.',
  spec: {
    root: 'root',
    elements: {
      root: {
        type: 'YourComponent',
        props: { /* realistic mock props */ },
      },
    },
  },
},
```

**b) Add a route in the catalog sidebar:**

```ts
// catalog/src/router.ts — add to the Chat children array:
{ path: '/chat/YourComponent', label: 'YourComponent' },
```

**c) Verify:**

```bash
npm run build && npm run catalog
# Navigate to http://localhost:3002/#/chat/YourComponent
```

---

## Checklist

- [ ] Mode string added to `AssistantMode` type and `RECOGNISED_MODES`
- [ ] Feature module directory created under `src/chat/features/<mode-name>/`
- [ ] Component renderers in `src/chat/components/` (if new UISpec types)
- [ ] Feature registry spread into `DEFAULT_CHAT_UI_SPEC_REGISTRY`
- [ ] Stream handler with thin delegation in `index.ts` (if needed)
- [ ] Drawer extensions with thin delegation in `ChatDrawer.ts` (if needed)
- [ ] CSS classes added with `gengage-chat-` prefix
- [ ] i18n strings in locale files + `ChatI18n` type
- [ ] Mock specs in `catalog/src/mock-data/chat-specs.ts`
- [ ] Route in `catalog/src/router.ts`
- [ ] `npm run typecheck` passes
- [ ] `npm run test` passes (all 1300+ tests)
- [ ] `npm run build && npm run catalog` — component renders correctly
- [ ] No beauty/mode-specific logic added inline to central files

---

## Reference: Beauty Consulting (the first mode)

The beauty consulting mode is the reference implementation. Study these files:

| File | What it does |
|------|-------------|
| `src/chat/features/beauty-consulting/registry.ts` | Registers `PhotoAnalysisCard` + `BeautyPhotoStep` |
| `src/chat/features/beauty-consulting/mode-controller.ts` | `AssistantModeController` — state, hints, redirect |
| `src/chat/features/beauty-consulting/stream-handler.ts` | Intercepts beauty UISpec during streaming |
| `src/chat/features/beauty-consulting/drawer-extensions.ts` | Lazy photo step slot + analysis card rendering |
| `src/chat/components/PhotoAnalysisCard.ts` | Structured skin analysis card renderer |
| `src/chat/components/BeautyPhotoStep.ts` | Selfie upload prompt renderer |
| `src/chat/components/ConsultingStylePicker.ts` | Tabbed style variation picker |
| `src/chat/assistant-mode.ts` | Mode type + parsing utilities |
