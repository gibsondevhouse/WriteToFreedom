import {createStoryCardAction,createStoryCardFrame,storyCardInitials,storyCardTone} from './card.js?v=__WTF_ASSET_REVISION__';

function el(tag,cls,text){const node=document.createElement(tag);if(cls)node.className=cls;if(text!==undefined)node.textContent=text;return node;}

/**
 * App-wide adapter for faction, location, and other profile-backed entities.
 * Section actions are duplicated in the overflow menu for compact and keyboard use.
 */
export function createProfileStoryCard(record,{headingLevel=3,tone,label=record.label||record.type||'Entry',contextLabel='About this '+String(label).toLowerCase(),contextText=record.summary||'Open this profile to add its story.',sections=[],menuItems=[],cardClass=''}={}){
 const badge=el('span','character-power');badge.append(el('strong','',label));
 const mark=el('a','affiliation-picker');mark.href=record.href+'#overview';mark.setAttribute('aria-label','Overview of '+record.name);
 const avatar=el('span','affiliation-avatar',storyCardInitials(label));avatar.setAttribute('aria-hidden','true');mark.append(avatar);
 const details=el('a','affiliation-copy');details.href=record.href+'#overview';details.title=contextText;details.append(el('span','affiliation-kind',contextLabel),el('strong','',contextText));
 const normalized=sections.map(section=>({...section,href:section.href||record.href+(section.hash?'#'+section.hash:'')}));
 const actions=normalized.slice(0,3).map(section=>createStoryCardAction({href:section.href,label:section.label+' for '+record.name,title:section.label,icon:section.icon||'overview',count:section.count}));
 const overflow=[{label:'Open profile',href:record.href},...normalized.map(section=>({label:section.label,href:section.href})),...menuItems];
 const card=createStoryCardFrame(record,{tone:storyCardTone(record,tone),headingLevel,eyebrow:label,badge,context:[mark,details],actions,menuItems:overflow,cardClass:'story-profile-card '+cardClass});
 card.dataset.entityId=record.id;card.dataset.entityType=record.kind||record.type||String(label).toLowerCase();return card;
}
