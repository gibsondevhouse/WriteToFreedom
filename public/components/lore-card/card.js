import {createStoryCardFrame} from '../character-card/frame.js';
import {characterTone} from '../character-card/model.js';

function el(tag,cls,text){const node=document.createElement(tag);if(cls)node.className=cls;if(text!==undefined)node.textContent=text;return node;}
const paths={
 species:'M12 21v-9M12 16C5 16 3 12 3 6c6 0 9 4 9 10ZM12 12c0-6 3-9 9-9 0 6-3 9-9 9Z',
 gem:'M12 2 22 8 12 22 2 8Z M2 8h20M7 3l5 19 5-19',
 bookmark:'M6 3h12v18l-6-4-6 4Z',
 connections:'M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-2 2M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l2-2',
 story:'M4 4h16v13H10l-5 4v-4H4ZM8 8h8M8 12h5'
};
function icon(kind){const svg=document.createElementNS('http://www.w3.org/2000/svg','svg'),path=document.createElementNS(svg.namespaceURI,'path');svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('aria-hidden','true');path.setAttribute('d',paths[kind]);svg.append(path);return svg;}
/** Uses the character card's frame with Lore metadata and navigation actions. */
export function createLoreCard(record){
 const species=record.type==='species',symbol=species?'species':'gem';
 const label=record.label||(species?'Species':'Jewel'),badge=el('span','character-power');badge.append(icon(symbol),el('strong','',label));
 const mark=el('a','affiliation-picker');mark.href=record.href+'#overview';mark.setAttribute('aria-label','Description of '+record.name);
 const avatar=el('span','affiliation-avatar');avatar.append(icon(symbol));mark.append(avatar);
 const summary=record.summary?.trim()||'Add a description',details=el('a','affiliation-copy');details.href=mark.href;details.title=summary;
 details.append(el('span','affiliation-kind','About this '+label.toLowerCase()),el('strong','',summary));
 const action=(section,description,kind,text,cls='')=>{const link=el('a',cls);link.href=record.href+(section?'#'+section:'');link.setAttribute('aria-label',description+' for '+record.name);link.title=description;if(kind)link.append(icon(kind));if(text!==undefined)link.append(el('span','',text));return link;};
 const pin=action('identity-dashboard','Pin and feature settings','bookmark',undefined,record.pinned?'lore-pinned':'');
 const count=Number(record.connectionCount)||0,connections=action('connections',`${count} connection${count===1?'':'s'}`,'connections',String(count));
 const story=action('story','Story significance','story');
 const more=action('','More details',null,'More ›','character-more');
 const eyebrow=[label,record.pinned&&'Pinned',record.featured&&'Featured'].filter(Boolean).join(' · ');
 const card=createStoryCardFrame(record,{tone:characterTone(record),eyebrow,badge,context:[mark,details],actions:[pin,connections,story,more]});
 card.classList.add('story-lore-card',species?'story-species-card':'story-jewel-card');card.dataset.loreId=record.id;return card;
}
