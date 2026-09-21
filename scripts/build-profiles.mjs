import { mkdir, writeFile } from 'node:fs/promises';
import { characters } from '../public/characters/data.js';
import { profiles } from '../public/characters/profile-data.js';

const escape = value => String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const sections = [['overview','Overview'],['biography','Biography'],['personality','Personality & attributes'],['tendencies','Tendencies & voice'],['motivations','Motivations & conflicts'],['relationships','Relationships'],['story-arc','Story arc'],['open-questions','Open questions']];
const contents = () => sections.map(([id,title]) => `<li><a href="#${id}">${escape(title)}</a></li>`).join('');

for (const character of characters) {
 const p = profiles[character.id];
 if (!p) throw new Error(`Missing profile: ${character.id}`);
 const c = Object.fromEntries(Object.entries(character).filter(([,value])=>typeof value==='string').map(([key,value])=>[key,escape(value)]));
 const facts = [['Name', character.name], ['Known as', character.title], ['Story role', character.attributes['Story role']], ['Occupation', character.roles.join(' · ')], ['Affiliation', character.affiliation]];
 const relationships = character.relationships.map(r => {
   const target = characters.find(candidate=>candidate.id===r.id);
   if (!target) throw new Error(`Unknown relationship: ${r.id}`);
   return `<tr><th scope="row"><a href="../${escape(target.id)}/">${escape(target.name)}</a></th><td>${escape(r.type)}</td><td>${escape(r.text)}</td></tr>`;
 }).join('');
 const html = `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="color-scheme" content="dark"><title>${c.name} — Write to Freedom</title><meta name="description" content="${c.name}: ${c.title}. Character biography, attributes, motivations, and relationships."><link rel="icon" href="../../crest.svg" type="image/svg+xml"><link rel="stylesheet" href="../profile.css"></head>
<body>
<a class="skip-link" href="#profile">Skip to character profile</a>
<header class="site-header"><a class="brand" href="../../"><img src="../../crest.svg" width="35" height="40" alt=""><span>Write to Freedom<small>A Free Novelpedia</small></span></a><a href="../" class="back-link">← All characters</a></header>
<div class="page-layout">
<aside class="desktop-contents" aria-label="Profile contents"><nav><h2>Contents</h2><ol>${contents()}</ol><a class="back-top" href="#profile">Back to top ↑</a></nav></aside>
<main id="profile">
<nav class="breadcrumb" aria-label="Breadcrumb"><a href="../../">Home</a><span aria-hidden="true">/</span><a href="../">Characters</a><span aria-hidden="true">/</span><span aria-current="page">${c.name}</span></nav>
<div class="title-row"><h1>${c.name}</h1><span class="sample-badge">Sample character</span></div>
<div class="article-bar"><span class="current-view">Character profile</span><a href="#relationships">${character.relationships.length} relationships</a></div>
<p class="byline">From Write to Freedom, a free novelpedia.</p>
<details class="mobile-contents"><summary>Contents</summary><nav aria-label="Profile sections"><ol>${contents()}</ol></nav></details>
<article aria-label="${c.name} character profile">
<aside class="infobox" aria-label="${c.name} at a glance">
<h2>${c.name}</h2><p class="infobox-title">${c.title}</p>
<div class="identity-panel ${c.color}"><span class="monogram" aria-hidden="true">${c.initials}</span><span>${character.roles.map(escape).join(' · ')}</span></div>
<h3>Character information</h3><dl>${facts.map(([key,value])=>`<div><dt>${escape(key)}</dt><dd>${escape(value)}</dd></div>`).join('')}</dl>
<h3>At the core</h3><dl><div><dt>Strength</dt><dd>${escape(character.attributes.Strength)}</dd></div><div><dt>Flaw</dt><dd>${escape(character.attributes.Flaw)}</dd></div></dl>
<p class="inspiration">Name inspired by ${c.provider}’s ${c.name} model family. All story details are fictional.</p>
</aside>
<section id="overview" class="overview" aria-label="Overview"><p class="lead"><strong>${c.name}</strong>${escape(p.introduction.slice(character.name.length))}</p><p>${c.summary}</p></section>
<section id="biography"><h2>Biography</h2><p>${c.biography}</p><h3>Early life</h3><p>${escape(p.earlyLife)}</p><h3>Present circumstances</h3><p>${escape(p.presentDay)}</p></section>
<section id="personality" class="full-width"><h2>Personality &amp; attributes</h2><p>${escape(p.personality)}</p><dl class="attribute-list">${Object.entries(character.attributes).map(([key,value])=>`<div><dt>${escape(key)}</dt><dd>${escape(value)}</dd></div>`).join('')}</dl></section>
<section id="tendencies"><h2>Tendencies &amp; voice</h2><ul class="tendency-list">${character.tendencies.map(item=>`<li>${escape(item)}</li>`).join('')}</ul><h3>Voice &amp; manner</h3><p>${escape(p.voice)}</p></section>
<section id="motivations"><h2>Motivations &amp; conflicts</h2><p>${escape(p.contradiction)}</p><div class="motivation-pair"><div><h3>What they want</h3><p>${escape(character.attributes.Desire)}.</p></div><div><h3>What they fear</h3><p>${escape(character.attributes.Fear)}.</p></div></div></section>
<section id="relationships"><h2>Relationships</h2><div class="table-scroll" role="region" aria-label="Character relationships" tabindex="0"><table><caption class="sr-only">${c.name}’s relationships with the sample cast</caption><thead><tr><th scope="col">Character</th><th scope="col">Connection</th><th scope="col">Dynamic</th></tr></thead><tbody>${relationships}</tbody></table></div></section>
<section id="story-arc"><h2>Story arc</h2><p>${escape(p.arc)}</p></section>
<section id="open-questions"><h2>Open questions</h2><p class="section-note">Unresolved questions for developing this character.</p><ul>${p.questions.map(item=>`<li>${escape(item)}</li>`).join('')}</ul></section>
</article>
<footer class="profile-footer"><a href="../">← Back to characters</a><a href="#profile">Back to top ↑</a></footer>
</main>
</div>
</body></html>`;
 const directory = new URL(`../public/characters/${character.id}/`, import.meta.url);
 await mkdir(directory, {recursive:true});
 await writeFile(new URL('index.html',directory), html);
}
console.log(`Built ${characters.length} character profiles.`);
