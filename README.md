# Write to Freedom

A responsive novel-planning home page with an original African-inspired white SVG crest. Characters opens a searchable, sortable list of four fictional sample characters. Each entry links to a full encyclopedia-style profile with a contents menu, facts panel, biography, personality, attributes, tendencies, motivations, linked relationships, proposed story arc, and open planning questions. Other home-page sections, browsing, and global search remain disabled placeholders.

Serve `dist` with any static HTTP server. No dependencies or build step are required. The editable vector is `dist/crest.svg`; homepage markup and styling are in `dist/index.html` and `dist/styles.css`.

The character directory lives in `dist/characters/`. Its seed records are in `data.js` and additional profile material is in `profile-data.js`; all biographies, roles, affiliations, and relationships are fiction. No editing or persistence is implemented yet. Model family names are used without version numbers: [Claude](https://docs.anthropic.com/claude/docs), [GPT](https://openai.com/research), [DeepSeek](https://deepseek.com/en/index.html), and [Gemini](https://deepmind.google/models/gemini/).

After updating either seed file, run `node scripts/build-profiles.mjs` to regenerate all four profile pages. Profiles are real static routes (`/characters/claude/`, `/characters/gpt/`, `/characters/deepseek/`, and `/characters/gemini/`), so direct links and reloads work without JavaScript. The directory uses JavaScript for search and sorting.
