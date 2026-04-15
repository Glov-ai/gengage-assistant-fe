# Live Testing

Verification checklist and testing patterns for Gengage widgets.

---

## Local Dev Server

The primary way to test widgets is the local dev server:

```bash
npm run dev -- koctascomtr --sku=1000465056
npm run dev -- arcelikcomtr --sku=ABC123 --port=3005
npm run dev -- n11com --sku=XYZ789 --port=3010
npm run dev -- --client=yatasbeddingcomtr --sku=1066800 --backend-url=https://staging.example.com
```

The dev server serves the corresponding `demos/<accountId>/index.html` with HMR.
Backend URL can come from demo defaults or be overridden with `--backend-url`.

---

## What to Verify

### Chat Widget

- Launcher renders with account-specific icon (bottom-right corner)
- Clicking launcher opens the chat drawer
- Header shows account title, badge, and close button
- Sending a message streams NDJSON response with typing indicator
- Product cards render in the left panel with images, prices, ratings
- Clicking a product card opens the full product detail view
- Suggestion chips appear below chat and scroll horizontally
- Consent/disclaimer banner shows on first session (if account requires it)
- Panel content is preserved per message — clicking a previous bot message restores its panel
- Back/forward arrows navigate the panel history
- Quantity stepper: Click [+] to increase quantity, then click "Sepete Ekle" or cart icon — verify quantity > 1 in dispatched event
- Share button: Click share icon on product detail panel — verify URL copied (desktop) or native share (mobile)
- Like sends to backend: Click heart on product card — verify "begenmenize sevindim" response in chat, panel stays intact
- ATC sends to backend: Click cart icon on product card — verify "sepete eklendi" response in chat, panel stays intact
- TTS audio: If backend sends voice event with audio_base64, verify audio plays (requires voice-enabled account)
- Session persistence: Send a message, navigate away, navigate back — verify messages restored from IndexedDB
- KVKK banner: On Turkish accounts, verify consent banner appears on first visit, dismisses, and does not reappear

### QNA Widget

- Action buttons and text input render on the product page
- Clicking a button sends the action and opens the chat drawer with the response

### Similar Products (SimRel) Widget

- Product grid renders in its mount point
- Cards show image, name, brand, price, rating
- Product links navigate to the correct product page
- "Add to Cart" buttons trigger the `onAddToCart` callback
- Quantity stepper on product cards: Verify [-][1][+][cart] stepper renders on each card
- Focus-visible outlines: Tab through product cards — verify blue outline ring

### SimBut Widget

- Pill renders over the configured PDP image wrapper, aligned to the top-right corner
- Clicking the pill opens the chat with a `findSimilar` action when chat is wired
- If `onFindSimilar` is supplied instead of chat, verify the callback receives `{ sku, imageUrl? }`
- Missing SKU disables the button instead of sending a broken action
- Mount wrapper remains layout-safe (`position: relative` is applied automatically when needed)

---

## Testing Against a Different Backend

Override the backend URL by editing `middlewareUrl` in the demo's `index.html`, using
`--backend-url=...`, or by setting `middlewareUrl` in the URL query:

```bash
http://localhost:3000/?sku=1000465056&middlewareUrl=https://your-staging-backend.example.com
```

This is useful for testing backend changes before they reach production.

---

## Component Catalog

For visual verification of all components without a backend:

```bash
npm run catalog    # http://localhost:3002 (builds first)
```

The catalog renders every Chat/QNA/SimRel component plus a live SimBut preview with mock
data inside realistic frames. Use the global theme selector to switch between 12 merchant color presets.

Useful for:
- Verifying UI changes across all component types at once
- Checking theme token application for all merchants
- Visual regression with `npx playwright test --project=catalog`

---

## Smoke Test Checklist

Run this after every significant change:

```bash
npm run format            # Prettier + ESLint + typecheck + typecheck:catalog
npm run build             # Clean Vite build
npm run test:e2e          # Playwright smoke tests
```

Then manually verify with the dev server:

```bash
npm run dev -- koctascomtr --sku=1000465056
```

1. Open the chat launcher
2. Wait for `launchSingleProduct` init to complete (product summary card appears in chat; full panel detail requires `productDetailsExtended: true`)
3. Type a product question — verify NDJSON stream renders text + suggestions
4. Click a suggested action — verify it dispatches and streams a response
5. Use back arrow to navigate panel history
6. Click a previous user message to rollback and verify branching

---

## Account Demo Reference

| Account ID | Notes |
|---|---|
| `koctascomtr` | Home improvement retail, Turkish locale, good for product search testing |
| `arcelikcomtr` | Consumer electronics, shows comparison table behavior |
| `n11com` | Marketplace, tests product grid with mixed categories |
| `hepsiburadacom` | High-traffic marketplace, tests performance |
| `yatasbeddingcomtr` | Furniture, tests large product images and variants |

Use real SKUs from each account's catalog. The dev server startup log prints demo,
SKU, backend, and local URL (including sticky query params).
