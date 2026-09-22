// Search only the current owner's dashboard catalog; nothing is stored locally.
export function searchCatalog(data, query) {
  const terms = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  if (!terms.length) return [];
  return [...data.characters, ...data.factions, ...data.locations].filter(record => {
    const text = [record.name, record.label, record.summary, record.title,
      record.parent, record.affiliation, record.storyRole, record.type,
      record.areaType, ...(record.roles || [])].filter(Boolean).join(' ').toLocaleLowerCase();
    return terms.every(term => text.includes(term));
  });
}
