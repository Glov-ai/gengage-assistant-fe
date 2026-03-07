# Component Override Cookbook

Five recipes for common customization tasks. Each recipe is self-contained — copy, paste, adapt.

For a full reference of the override system, see [customization.md](./customization.md).

---

## Recipe 1: Replace Product Card with Brand Styling

**Problem:** Default product cards don't match your brand. You want your own card layout.

**Solution:** Override `ProductCard` in the renderer registry.

```ts
await chatWidget.init({
  accountId: 'mystore',
  middlewareUrl: 'https://chat.gengage.ai',
  renderer: {
    registry: {
      ProductCard: ({ element, context }) => {
        const product = element.props?.product as Record<string, unknown> | undefined;
        const card = document.createElement('article');
        card.className = 'my-brand-card';
        card.innerHTML = `
          <img src="${product?.imageUrl ?? ''}" alt="${product?.name ?? ''}" loading="lazy" />
          <div class="my-brand-card-info">
            <h4>${product?.name ?? ''}</h4>
            <span class="my-brand-card-price">${product?.price ?? ''}</span>
          </div>
        `;
        card.addEventListener('click', () => {
          const sku = product?.sku as string | undefined;
          const url = product?.url as string | undefined;
          if (sku && url) context.onProductClick?.({ sku, url });
        });
        return card;
      },
    },
  },
});
```

**Note:** Product card overrides accept raw HTML — sanitize any user-input fields to prevent XSS.

---

## Recipe 2: Add Custom Action Button with GA4 Tracking

**Problem:** You want to fire a GA4 event when a user clicks a suggested action.

**Solution:** Override `ActionButtons` and inject analytics before routing the action.

```ts
await chatWidget.init({
  renderer: {
    registry: {
      ActionButtons: ({ element, context }) => {
        const row = document.createElement('div');
        row.className = 'my-action-row';
        const buttons = (element.props?.buttons ?? []) as Array<{
          label: string;
          action: { title: string; type: string; payload?: unknown };
        }>;
        for (const btn of buttons) {
          const el = document.createElement('button');
          el.className = 'my-action-btn';
          el.textContent = btn.label;
          el.addEventListener('click', () => {
            // Track in GA4 before routing
            window.dataLayer?.push({
              event: 'gengage_action_click',
              action_label: btn.label,
              action_type: btn.action.type,
            });
            context.onAction(btn.action);
          });
          row.appendChild(el);
        }
        return row;
      },
    },
  },
});
```

---

## Recipe 3: Override Greeting Message

**Problem:** Default greeting doesn't match your brand tone. You want a custom welcome.

**Solution:** Use `i18n` to override the header title and input placeholder.

```ts
await chatWidget.init({
  accountId: 'mystore',
  middlewareUrl: 'https://chat.gengage.ai',

  // Custom header
  headerTitle: 'MyStore Asistanı',
  headerAvatarUrl: 'https://cdn.mystore.com/avatar.png',
  headerBadge: 'AI',

  // Override i18n strings
  i18n: {
    inputPlaceholder: 'Ürün ara veya soru sor...',
    sendButton: 'Gönder',
    errorMessage: 'Bir sorun oluştu. Tekrar deneyin.',
  },
});
```

---

## Recipe 4: Change Launcher Icon

**Problem:** Default launcher button doesn't fit your site's design.

**Solution:** Pass custom SVG via `launcherSvg`.

```ts
await chatWidget.init({
  accountId: 'mystore',
  middlewareUrl: 'https://chat.gengage.ai',

  // Custom launcher icon (SVG string)
  launcherSvg: `
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
    </svg>
  `,
  launcherTooltip: 'Yardım mı lazım?',
});
```

**Tip:** Use `currentColor` in your SVG so it adapts to the theme's primary color.

---

## Recipe 5: Apply a Full Brand Theme

**Problem:** You want all widgets to match your brand colors, fonts, and border styles.

**Solution:** Pass a `theme` object to `init()`. All widgets accept the same theme tokens.

```ts
const myTheme = {
  primaryColor: '#e63946',
  primaryForeground: '#ffffff',
  borderRadius: '8px',
  fontFamily: '"Inter", "Segoe UI", sans-serif',
  backgroundColor: '#1a1a2e',
  foregroundColor: '#eaeaea',
};

// Apply the same theme to all widgets
await chatWidget.init({ theme: myTheme, /* ... */ });
await qnaWidget.init({ theme: myTheme, /* ... */ });
await simrelWidget.init({ theme: myTheme, /* ... */ });
```

You can also set theme tokens directly in CSS:

```css
[data-gengage-widget="chat"] {
  --gengage-primary-color: #e63946;
  --gengage-primary-foreground: #ffffff;
  --gengage-border-radius: 8px;
  --gengage-font-family: "Inter", sans-serif;
  --gengage-background-color: #1a1a2e;
  --gengage-foreground-color: #eaeaea;
}
```

### Available Theme Tokens

| Token | Default | What it affects |
|-------|---------|----------------|
| `primaryColor` | `#f27a1a` | Buttons, links, accents |
| `primaryForeground` | `#ffffff` | Text on primary backgrounds |
| `borderRadius` | `8px` | Card and button corners |
| `fontFamily` | system stack | All widget text |
| `backgroundColor` | `#ffffff` | Widget backgrounds |
| `foregroundColor` | `#1a1a2e` | Primary text color |

See [customization.md](./customization.md#level-1--theme-tokens-css-custom-properties) for the complete token list.
