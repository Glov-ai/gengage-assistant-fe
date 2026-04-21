# API Reference

This is a high-level map of the supported public API surface. For exact TypeScript signatures, use the exported types from `@gengage/assistant-fe` and the source barrels in `src/index.ts` and `src/common/index.ts`.

## Package Entry Points

| Import | What It Exposes |
|--------|------------------|
| `@gengage/assistant-fe` | Full public barrel: widgets, overlay bootstrap, renderer helpers, config helpers, shared types |
| `@gengage/assistant-fe/chat` | `GengageChat`, chat renderer helpers, chat types |
| `@gengage/assistant-fe/qna` | `GengageQNA`, QNA renderer helpers, QNA types |
| `@gengage/assistant-fe/simrel` | `GengageSimRel`, SimRel renderer helpers, SimRel types |
| `@gengage/assistant-fe/simbut` | `GengageSimBut`, SimBut types |
| `@gengage/assistant-fe/native` | Native WebView bridge and native overlay bootstrap |
| `@gengage/assistant-fe/common` | Shared helpers for advanced integrations |

## Widget Classes

All widget classes implement the same lifecycle shape inherited from `BaseWidget`:

```ts
await widget.init(config);
widget.update(contextPatch);
widget.show();
widget.hide();
widget.destroy();
```

### Chat

- Class: `GengageChat`
- Config type: `ChatWidgetConfig`
- Import: `@gengage/assistant-fe/chat`
- Use when you need the assistant drawer, streaming replies, product cards, comparison flows, or assistant modes.

Key chat-only surface areas:

- `variant`, `mobileInitialState`, launcher options, header options
- `renderer` overrides for UISpec components
- `voiceEnabled`, `productDetailsExtended`, `pillLauncher`
- host callbacks such as `onScriptCall`, `onAddToCart`, `onFavoritesClick`

### QNA

- Class: `GengageQNA`
- Config type: `QNAWidgetConfig`
- Import: `@gengage/assistant-fe/qna`
- Use when you need contextual launcher buttons or free-text Q&A prompts on PDP or content pages.

Key surface areas:

- required `mountTarget`
- optional `inputPlaceholder`, `ctaText`, `headerTitle`
- `renderer` overrides for QNA UISpec components

### SimRel

- Class: `GengageSimRel`
- Config type: `SimRelWidgetConfig`
- Import: `@gengage/assistant-fe/simrel`
- Use when you need a similar-products rail or grid for a SKU.

Key surface areas:

- required `sku` and `mountTarget`
- `onAddToCart`, `onProductClick`, `onProductNavigate`
- `renderCard`, `renderCardElement`, `renderer`
- `discountType`, `gridColumns`, `pricing`

### SimBut

- Class: `GengageSimBut`
- Config type: `SimButWidgetConfig`
- Import: `@gengage/assistant-fe/simbut`
- Use when you need the lightweight PDP image-overlay pill that launches a `findSimilar` flow.

Key surface areas:

- `mountTarget` relative to the PDP image wrapper
- optional `sku`, `imageUrl`, `locale`, `i18n`
- either `chat` or `onFindSimilar` for click behavior

SimBut is a direct-DOM widget and does not expose UISpec renderer overrides.

## Overlay Bootstrap

Use `initOverlayWidgets(...)` when you want chat and optional PDP widgets managed as one runtime.

Primary helpers:

- `initOverlayWidgets`
- `getOverlayWidgets`
- `destroyOverlayWidgets`
- `buildOverlayIdempotencyKey`

Key overlay option groups:

- `chat`
- `qna`
- `simrel`
- `simbut`
- shared `locale`, `theme`, `session`, `pageContext`, `pricing`

The returned controller exposes:

- `openChat(...)`
- `closeChat()`
- `updateContext(...)`
- `updatePageContext(...)` — merge-only alias of `updateContext(...)` for SPA route changes
- `setPageContext(...)` — merge-only alias of `updateContext(...)`; it does not replace the full context
- `updateSku(...)`
- `destroy()`
- widget instances via `controller.chat`, `controller.qna`, `controller.simrel`, `controller.simbut`

## Runtime Config And Client Bootstrap

Use the runtime config layer when integrations are file-driven or GTM-driven:

- `AccountRuntimeConfigSchema`
- `parseAccountRuntimeConfig`
- `safeParseAccountRuntimeConfig`
- `createDefaultAccountRuntimeConfig`
- `initGengageClient`
- `preflightDiagnostics`

These APIs map account config into overlay options and host action wiring. See [config-files.md](./config-files.md) for the schema contract.

## Renderer Helpers

The public barrel exports renderer helpers for UISpec widgets:

- `renderChatUISpec`
- `createDefaultChatUISpecRegistry`
- `defaultChatUnknownUISpecRenderer`
- `renderQnaUISpec`
- `createDefaultQnaUISpecRegistry`
- `defaultQnaUnknownUISpecRenderer`
- `renderSimRelUISpec`
- `createDefaultSimRelUISpecRegistry`
- `defaultSimRelUnknownUISpecRenderer`
- `renderUISpecWithRegistry`
- `defaultUnknownUISpecRenderer`

Use these when you want partial component overrides without replacing the whole widget.

## Native WebView Support

Use `@gengage/assistant-fe/native` for in-app WebView overlays.

Main exports:

- `initNativeOverlayWidgets`
- `createNativeWebViewBridge`
- `detectNativeEnvironment`
- `applyNativeSession`
- `DEFAULT_NATIVE_TRACKED_EVENTS`

See [native-mobile-sdk.md](./native-mobile-sdk.md) for platform examples.

## IIFE Usage

The package also ships per-widget IIFE bundles such as:

- `dist/chat.iife.js`
- `dist/qna.iife.js`
- `dist/simrel.iife.js`
- `dist/simbut.iife.js`
- `dist/native.iife.js`

These extend `window.Gengage`, for example:

```html
<script src="https://unpkg.com/@gengage/assistant-fe/dist/chat.iife.js"></script>
<script>
  const chat = new window.Gengage.GengageChat();
  chat.init({
    accountId: 'mystore',
    middlewareUrl: 'https://YOUR_BACKEND_URL',
  });
</script>
```
