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

## Featured item and power

Click the small affiliation portrait to choose any existing character, faction, place, note, or lore item in the owner's world. The `connection` dialog saves a `cardConnection` reference; this is a presentation choice and does not change faction membership, citizenship, or relationships. Automatic affiliation restores the original faction/country fallback. Missing targets fall back automatically, while stable IDs keep renamed targets current. The name beside the picker remains a link to the featured item.

Power is derived in `public/characters/power.js` from all 20 equally weighted attribute ratings. With `x = sum(ratings) / (20 × 99)`, the score is `round(9999 × (exp(4x) − 1) / (exp(4) − 1))`, capped at 9999. All zeros score 0, all 99s score 9999, and gains increase exponentially toward the top. Missing ratings contribute zero to a provisional score marked with an asterisk and explained in the badge title and attributes dialog; no ratings show a dash. Power is never saved independently, so changing ratings cannot leave a stale stored score.
