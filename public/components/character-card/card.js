import {characterPower,powerDescription} from '../../characters/power.js?v=__WTF_ASSET_REVISION__';
import {openCharacter} from './details.js?v=__WTF_ASSET_REVISION__';
import {normalizeCard,characterTone} from './model.js?v=__WTF_ASSET_REVISION__';
import {moralityIcons} from '../../characters/attributes.js?v=__WTF_ASSET_REVISION__';
import {cardIcon,createStoryCardAction,createStoryCardFrame,storyCardPicture as picture} from '../story-card/card.js?v=__WTF_ASSET_REVISION__';

function el(tag,cls,text){const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n;}
function button(text,cls,action){const n=el('button',cls,text);n.type='button';n.addEventListener('click',action);return n;}
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
 badge.append(cardIcon('power'),el('strong','',power.score===null?'—':power.score.toLocaleString('en-US')+(power.provisional?'*':'')));
 const affiliation=record.affiliationCard;
 const ownerText=el(affiliation.href?'a':'span','affiliation-copy');if(affiliation.href)ownerText.href=affiliation.href;ownerText.append(el('span','affiliation-kind',affiliation.label),el('strong','',affiliation.name));const choose=button('','affiliation-picker',()=>open('connection'));choose.setAttribute('aria-label','Change featured item for '+record.name);choose.title='Change featured item';choose.setAttribute('aria-haspopup','dialog');choose.append(picture(affiliation,'affiliation-avatar'));
 const faces=el('span','relationship-faces');for(const person of record.relationships.slice(0,3))faces.append(picture(person,'relationship-avatar'));
 const moralTitle=record.alignment||'Moral alignment not set';
 const moral=createStoryCardAction({label:`${record.name}: ${moralTitle}. Choose moral alignment`,title:moralTitle,className:'morality-action',onClick:()=>open('morality'),text:moralityIcons[record.alignment]||'?',dialog:true});
 const relations=createStoryCardAction({label:`${record.relationships.length} relationships for ${record.name}`,title:'Relationships',className:'relationships-action',onClick:()=>open('relationships'),icon:record.relationships.length?faces:'relationships',count:record.relationships.length,dialog:true});
 const notes=createStoryCardAction({label:`${record.mentions.length} notes mentioning ${record.name}`,title:'Notes mentioning '+record.name,className:'mentions-action',onClick:()=>open('mentions'),icon:'notes',count:record.mentions.length,dialog:true});
 const more=createStoryCardAction({label:'More about '+record.name,title:'More about '+record.name,className:'character-more',onClick:()=>open('attributes'),text:'More ›',dialog:true});
 const card=createStoryCardFrame(record,{tone,headingLevel:options.headingLevel,eyebrow:record.roles.join(' · ')||record.storyRole||'Character',badge,profileLabel:'Open '+record.name+' profile. '+powerDescription(power),context:[choose,ownerText],actions:[moral,relations,notes,more]});
 card.dataset.characterId=record.id;return card;
 }
 return card;
}
