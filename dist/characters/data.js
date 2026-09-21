// Fictional sample cast. Names refer to model families, not current model versions.
export const characters = [
  {
    id: 'claude', name: 'Claude', initials: 'CL', provider: 'Anthropic', color: 'clay',
    title: 'The keeper of promises', roles: ['Archivist', 'Diplomat'], affiliation: 'The House of Ember',
    summary: 'Claude preserves the treaties of a fractured kingdom, remembering every promise its rulers would rather forget. When a sealed accord disappears from the royal archive, this patient mediator must decide whether keeping the peace is worth protecting a lie.',
    biography: 'Raised among the scribes of Ember, Claude learned to listen before speaking and to read the margins before trusting the text. Years spent mediating border disputes earned them a reputation for fairness. Now a missing treaty points toward their own mentor, and their careful neutrality has become impossible to defend.',
    attributes: { 'Story role': 'Protagonist', 'Strength': 'Empathy and negotiation', 'Flaw': 'Hesitates when every choice causes harm', 'Desire': 'Restore trust between the houses', 'Fear': 'Becoming the keeper of a convenient lie' },
    tendencies: ['Asks one more question before making a judgment.', 'Keeps handwritten records of every promise.', 'Absorbs other people’s burdens and conceals their own.'],
    relationships: [{ id: 'gpt', type: 'Uneasy ally', text: 'Needs GPT’s inventions, but distrusts their appetite for shortcuts.' }, { id: 'deepseek', type: 'Trusted confidant', text: 'Exchanges hidden records for truths recovered beneath the city.' }, { id: 'gemini', type: 'Former apprentice', text: 'Taught Gemini to read old maps; now struggles to let them take risks.' }]
  },
  {
    id: 'gpt', name: 'GPT', initials: 'GP', provider: 'OpenAI', color: 'jade',
    title: 'The architect of possibilities', roles: ['Inventor', 'Strategist'], affiliation: 'The Lantern Guild',
    summary: 'GPT can turn almost any discarded object into a useful machine—and almost any conversation into a new alliance. Their latest invention could reconnect the kingdom’s isolated cities, provided nobody asks what powers it beneath the polished brass.',
    biography: 'Once an apprentice in the river workshops, GPT built their first bridge from salvage after a flood destroyed the old crossing. Success brought patrons, expectations, and a habit of promising more than they could safely deliver. The Lantern Guild now depends on their boldest design, while a hidden failure threatens everyone who believes in it.',
    attributes: { 'Story role': 'Deuteragonist', 'Strength': 'Resourcefulness and improvisation', 'Flaw': 'Confuses confidence with certainty', 'Desire': 'Build something that outlives them', 'Fear': 'Being remembered for one catastrophic mistake' },
    tendencies: ['Sketches solutions on any available surface.', 'Makes ambitious promises before checking the details.', 'Uses humor to deflect uncomfortable questions.'],
    relationships: [{ id: 'claude', type: 'Uneasy ally', text: 'Values Claude’s judgment, even when it slows the work.' }, { id: 'deepseek', type: 'Intellectual rival', text: 'Competes over whether elegant theories or practical inventions reveal more truth.' }, { id: 'gemini', type: 'Traveling partner', text: 'Builds the instruments Gemini carries into uncharted territory.' }]
  },
  {
    id: 'deepseek', name: 'DeepSeek', initials: 'DS', provider: 'DeepSeek', color: 'blue',
    title: 'The seeker beneath the surface', roles: ['Investigator', 'Scholar'], affiliation: 'The Subterranean Archive',
    summary: 'DeepSeek searches the abandoned chambers beneath the capital for histories erased from the official record. A pattern carved into the oldest foundations suggests that the kingdom’s founding legend is not a story of triumph, but a carefully preserved warning.',
    biography: 'DeepSeek grew up in a mining settlement where a collapsed tunnel exposed an older city. The discovery became an obsession: every answer seemed to conceal another room, another inscription, another question. Years later, their research has made powerful enemies. They trust evidence more readily than people, except for the archivist who first believed their findings.',
    attributes: { 'Story role': 'Truth-seeker', 'Strength': 'Pattern recognition and persistence', 'Flaw': 'Pursues answers beyond reasonable limits', 'Desire': 'Recover the kingdom’s buried history', 'Fear': 'Leaving the most important question unanswered' },
    tendencies: ['Tests an assumption from several angles.', 'Loses track of time when following a clue.', 'Says little until the evidence forms a complete picture.'],
    relationships: [{ id: 'claude', type: 'Trusted confidant', text: 'Relies on Claude to interpret the human cost of each discovery.' }, { id: 'gpt', type: 'Intellectual rival', text: 'Challenges GPT to prove that an invention works, not merely that it could.' }, { id: 'gemini', type: 'Research partner', text: 'Matches underground inscriptions to landmarks in Gemini’s maps.' }]
  },
  {
    id: 'gemini', name: 'Gemini', initials: 'GE', provider: 'Google', color: 'violet',
    title: 'The cartographer of two horizons', roles: ['Explorer', 'Interpreter'], affiliation: 'The Horizon Cartographers',
    summary: 'Gemini maps the kingdom twice: once as it stands, and once as it appears in the dreams of its people. When the two maps begin to converge, this restless explorer becomes the only person able to guide the others toward a place that should not exist.',
    biography: 'A childhood spent traveling with performers taught Gemini to understand places through their voices, colors, and stories. Claude later offered them a place in the archive, but the open road proved impossible to resist. They now return with maps that contradict the kingdom’s oldest records and memories of a city no one else admits to knowing.',
    attributes: { 'Story role': 'Catalyst', 'Strength': 'Observation and perspective', 'Flaw': 'Chases new horizons instead of finishing old commitments', 'Desire': 'Find the city shared by both maps', 'Fear': 'Being trapped in someone else’s version of the world' },
    tendencies: ['Collects songs and sketches alongside geographic notes.', 'Reframes disagreements by offering a different perspective.', 'Leaves without warning when a new trail appears.'],
    relationships: [{ id: 'claude', type: 'Former mentor', text: 'Still seeks Claude’s approval while resisting their caution.' }, { id: 'gpt', type: 'Traveling partner', text: 'Field-tests GPT’s inventions, sometimes before they are ready.' }, { id: 'deepseek', type: 'Research partner', text: 'Brings surface clues that make sense of DeepSeek’s buried discoveries.' }]
  }
];

export function selectCharacters(query = '', sort = 'order', reversed = false) {
  const needle = query.trim().toLocaleLowerCase();
  const result = characters.filter(character => JSON.stringify(character).toLocaleLowerCase().includes(needle));
  if (sort === 'name') result.sort((a, b) => a.name.localeCompare(b.name));
  if (sort === 'provider') result.sort((a, b) => a.provider.localeCompare(b.provider) || a.name.localeCompare(b.name));
  return reversed ? result.reverse() : result;
}
