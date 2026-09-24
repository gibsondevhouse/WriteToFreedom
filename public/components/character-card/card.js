import {characterPower,powerDescription} from '../../characters/power.js';
import {openCharacter} from './details.js';
import {normalizeCard,characterTone} from './model.js';
import {moralityIcons} from '../../characters/attributes.js?v=section-attributes-1';
import {createStoryCardFrame,storyCardPicture as picture} from './frame.js';

function el(tag,cls,text){const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n;}
function button(text,cls,action){const n=el('button',cls,text);n.type='button';n.addEventListener('click',action);return n;}
function icon(type){
 const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('aria-hidden','true');
 const path=document.createElementNS(svg.namespaceURI,'path');path.setAttribute('d',type==='power'?'M13 2 4 14h7l-1 8 10-13h-7l1-7Z':type==='notes'?'M4 4h16v12H9l-5 4V4Zm4 4h8M8 12h5':'M8 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm8-1a2.5 2.5 0 1 0 0-5M2 20v-3a6 6 0 0 1 12 0v3m2-7a5 5 0 0 1 6 5v2');svg.append(path);return svg;
}
/**
 * Create a reusable article from a rich card record; host owns placement/layout.
 * No API fetch on construction (image elements may load remotely). Built-in
 * actions open dialogs and refresh this article's children after successful saves.
 * onAction replaces that behavior; onUpdate observes built-in saves only.
 * @param {object} data From dashboard.characters or /api/characters?view=cards.
 * @param {object} options headingLevel (2 or default 3), tone, onAction, onUpdate.
 * @returns {HTMLElement} Mounted-state owner; no public update/destroy methods.
 */
export function createCharacterCard(data,options={}){
 const record=normalizeCard(data),tone=characterTone(record,options.tone);
 const card=build();
 function open(view){if(options.onAction){options.onAction(view,record);return;}openCharacter(record,view,updated=>{Object.assign(record,updated);const next=build();card.replaceChildren(...next.childNodes);options.onUpdate?.(record);});}
 function build(){
 const power=characterPower(record.attributeRatings),badge=el('span','character-power');
 badge.title=powerDescription(power);badge.setAttribute('aria-label',badge.title);
 badge.append(icon('power'),el('strong','',power.score===null?'—':power.score.toLocaleString('en-US')+(power.provisional?'*':'')));
 const affiliation=record.affiliationCard;
 const ownerText=el(affiliation.href?'a':'span','affiliation-copy');if(affiliation.href)ownerText.href=affiliation.href;ownerText.append(el('span','affiliation-kind',affiliation.label),el('strong','',affiliation.name));const choose=button('','affiliation-picker',()=>open('connection'));choose.setAttribute('aria-label','Change featured item for '+record.name);choose.title='Change featured item';choose.setAttribute('aria-haspopup','dialog');choose.append(picture(affiliation,'affiliation-avatar'));
 const moral=button(moralityIcons[record.alignment]||'?', 'morality-action',()=>open('morality'));moral.title=record.alignment||'Moral alignment not set';moral.setAttribute('aria-label',`${record.name}: ${moral.title}. Choose moral alignment`);
 const relations=button('', 'relationships-action',()=>open('relationships'));relations.title='Relationships';relations.setAttribute('aria-label',`${record.relationships.length} relationships for ${record.name}`);
 const faces=el('span','relationship-faces');for(const person of record.relationships.slice(0,3))faces.append(picture(person,'relationship-avatar'));
 relations.append(record.relationships.length?faces:icon('relationships'),el('span','',String(record.relationships.length)));
 const notes=button('', 'mentions-action',()=>open('mentions'));notes.title='Notes mentioning '+record.name;notes.setAttribute('aria-label',`${record.mentions.length} notes mentioning ${record.name}`);notes.append(icon('notes'),el('span','',String(record.mentions.length)));
 const more=button('More ›','character-more',()=>open('attributes'));more.setAttribute('aria-label','More about '+record.name);more.setAttribute('aria-haspopup','dialog');for(const control of [moral,relations,notes])control.setAttribute('aria-haspopup','dialog');
 const card=createStoryCardFrame(record,{tone,headingLevel:options.headingLevel,eyebrow:record.roles.join(' · ')||record.storyRole||'Character',badge,profileLabel:'Open '+record.name+' profile. '+powerDescription(power),context:[choose,ownerText],actions:[moral,relations,notes,more]});
 card.dataset.characterId=record.id;return card;
 }
 return card;
}
