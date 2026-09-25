import {createStoryCardAction,createStoryCardFrame,storyCardTone} from '../story-card/card.js?v=__WTF_ASSET_REVISION__';

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
 const href=section=>record.href+(section?'#'+section:'');
 const count=Number(record.connectionCount)||0;
 const pin=createStoryCardAction({href:href('identity-dashboard'),label:'Pin and feature settings for '+record.name,title:'Pin and feature settings',className:record.pinned?'lore-pinned':'',icon:icon('bookmark')});
 const connections=createStoryCardAction({href:href('connections'),label:`${count} connection${count===1?'':'s'} for ${record.name}`,title:'Connections',icon:icon('connections'),count});
 const story=createStoryCardAction({href:href('story'),label:'Story significance for '+record.name,title:'Story significance',icon:icon('story')});
 const menuItems=[['Open profile',href('')],['Overview',href('overview')],['Ratings',href('ratings')],['Story significance',href('story')],['Connections',href('connections')],['Pin and feature settings',href('identity-dashboard')]].map(([label,link])=>({label,href:link}));
 const eyebrow=[label,record.pinned&&'Pinned',record.featured&&'Featured'].filter(Boolean).join(' · ');
 const card=createStoryCardFrame(record,{tone:storyCardTone(record),eyebrow,badge,context:[mark,details],actions:[pin,connections,story],menuItems});
 card.classList.add('story-lore-card',species?'story-species-card':'story-jewel-card');card.dataset.loreId=record.id;return card;
}
