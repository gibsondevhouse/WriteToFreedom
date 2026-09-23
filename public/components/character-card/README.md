# Character card

Use this component for character cards in rails or grids. The dashboard and character directory both use it. Keep the portrait/gradient, role, name, two-line summary, affiliation, and four-action footer together; container layout belongs to the consuming page.

```html
<link rel="stylesheet" href="/components/character-card/card.css">
<link rel="stylesheet" href="/components/character-card/details.css">
```

```js
import {createCharacterCard} from '/components/character-card/card.js';
const {characters} = await fetch('/api/characters?view=cards').then(r => r.json());
host.append(createCharacterCard(characters[0], {
  headingLevel: 2, // 3 by default; match the host's heading hierarchy
  onUpdate(record) { /* synchronize host state after an attribute/alignment save */ }
}));
```

The owner-scoped cards response includes the full search data plus `id`, `name`, `href`, `image`, `roles[]`, `storyRole`, `title`, `summary`, `alignment`, `affiliationCard {name,label,image,href}`, `relationships[]`, and `mentions[]`. `/api/dashboard` supplies the same card fields. Pass those rich records to preserve incoming relationships, affiliation artwork, and note counts; do not build a second card-data adapter in each page.

The component owns its visual markup, stable ID-based tone, HTTPS image fallback, action labels, focus states, and the four existing dialogs. Saves update the mounted card without a dashboard event listener. `onAction(view, record)` optionally replaces the built-in action handler for a different host; views are `morality`, `relationships`, `mentions`, and `attributes`. No request runs merely from rendering the card. Override `tone` only with `clay`, `jade`, `blue`, `violet`, or `gold`.

Default size is 340 × 440 px (310 px wide below 760 px). Set `--character-card-width:100%` on a grid cell to fill it. `--character-card-height` is available when a host needs more vertical room. Card styling is scoped to `.story-character-card` and does not require `.workspace`, dashboard CSS, or a generic `.card` class. Include `details.css` for the default dialogs. The old dashboard entry points remain compatibility shims.
