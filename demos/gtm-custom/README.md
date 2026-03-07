# GTM Custom Integration Demo

Demonstrates a GTM-style integration with:

- **Custom theme** — brand colors, font, border radius via `theme` object
- **GA4 event tracking** — all widget interactions pushed to `window.dataLayer`
- **ATC tracking** — `gengage_add_to_cart` event with SKU, quantity, cart code
- **Product click tracking** — `gengage_product_click` on SimRel card navigation

## Run locally

```bash
npm run dev -- gtm-custom --sku=1000465056
```

## GA4 Events Tracked

| Event | Trigger |
|-------|---------|
| `gengage_chat_open` | User opens chat drawer |
| `gengage_chat_close` | User closes chat drawer |
| `gengage_add_to_cart` | User adds product via SimRel stepper |
| `gengage_product_click` | User navigates to product from SimRel |

The demo page includes a live event log at the bottom showing all `dataLayer.push()` calls.

## Production GTM Usage

Replace the ESM import with a CDN URL:

```html
<script type="module">
  import { initGengageClient } from 'https://cdn.jsdelivr.net/npm/@gengage/assistant-fe/dist/index.js';

  await initGengageClient({
    runtimeConfig: {
      version: '1',
      accountId: 'YOUR_ACCOUNT_ID',
      middlewareUrl: 'https://chat.gengage.ai',
      widgets: { chat: { enabled: true }, qna: { enabled: true }, simrel: { enabled: true } },
      mounts: { qna: '#gengage-qna', simrel: '#gengage-simrel' },
    },
  });
</script>
```
