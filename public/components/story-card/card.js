function el(tag,cls,text){const node=document.createElement(tag);if(cls)node.className=cls;if(text!==undefined)node.textContent=text;return node;}

const iconPaths={
 power:'M13 2 4 14h7l-1 8 10-13h-7l1-7Z',
 notes:'M4 4h16v12H9l-5 4V4Zm4 4h8M8 12h5',
 relationships:'M8 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm8-1a2.5 2.5 0 1 0 0-5M2 20v-3a6 6 0 0 1 12 0v3m2-7a5 5 0 0 1 6 5v2',
 bookmark:'M6 3h12v18l-6-4-6 4Z',
 connections:'M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-2 2M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l2-2',
 story:'M4 4h16v13H10l-5 4v-4H4ZM8 8h8M8 12h5',
 overview:'M4 5h16M4 12h16M4 19h10',
 profile:'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM4 22v-2a8 8 0 0 1 16 0v2',
 more:'M12 5h.01M12 12h.01M12 19h.01'
};
const tones=['clay','jade','blue','violet','gold'];

export function storyCardTone(record,override){
 if(tones.includes(override))return override;const id=String(record.id||record.name||'');const seed={claude:0,gpt:1,deepseek:2,gemini:3};return tones[seed[id]??[...id].reduce((sum,char)=>sum+char.charCodeAt(0),0)%tones.length];
}

export function cardIcon(kind){
 const svg=document.createElementNS('http://www.w3.org/2000/svg','svg'),path=document.createElementNS(svg.namespaceURI,'path');
 svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('aria-hidden','true');path.setAttribute('d',iconPaths[kind]||iconPaths.profile);svg.append(path);return svg;
}

export function storyCardInitials(name){
 return String(name||'').replace(/^The /,'').trim().split(/\s+/).filter(Boolean).slice(0,2).map(word=>word[0]).join('').toUpperCase()||'?';
}

export function storyCardPicture(record,cls){
 const frame=el('span',cls),mark=el('span','character-initials',storyCardInitials(record.name));mark.setAttribute('aria-hidden','true');frame.append(mark);
 if(record.image){try{const url=new URL(record.image);if(url.protocol==='https:'&&!url.username&&!url.password){const img=el('img');img.src=url.href;img.alt='';img.loading='lazy';img.referrerPolicy='no-referrer';img.addEventListener('error',()=>img.remove(),{once:true});frame.append(img);}}catch{}}
 return frame;
}

/** Build one footer action as either a link or a button. */
export function createStoryCardAction({href,onClick,label,title=label,className='',icon,text,count,dialog=false}){
 const control=el(href?'a':'button',className);if(href)control.href=href;else{control.type='button';if(onClick)control.addEventListener('click',onClick);}
 control.setAttribute('aria-label',label);control.title=title;if(dialog)control.setAttribute('aria-haspopup','dialog');
 if(icon)control.append(typeof icon==='string'?cardIcon(icon):icon);if(text!==undefined)control.append(el('span','',text));if(count!==undefined)control.append(el('span','',String(count)));return control;
}

/** Native disclosure menu shared by every card family. */
export function createStoryCardMenu(record,items,{label='More actions'}={}){
 const menu=el('details','story-card-menu'),trigger=el('summary','story-card-menu-trigger'),popup=el('nav','story-card-menu-popup');
 trigger.setAttribute('aria-label',label+' for '+record.name);trigger.title=label;trigger.append(cardIcon('more'));popup.setAttribute('aria-label','Actions for '+record.name);
 for(const item of items){
  const control=el(item.href?'a':'button','story-card-menu-item',item.label);if(item.href)control.href=item.href;else{control.type='button';control.addEventListener('click',item.onClick);}
  if(item.dialog)control.setAttribute('aria-haspopup','dialog');control.addEventListener('click',()=>{menu.open=false;});popup.append(control);
 }
 menu.append(trigger,popup);
 let placement,elevated=[];
 const close=()=>{menu.open=false;};
 const resetPlacement=()=>{placement?.abort();placement=undefined;popup.style.cssText='';for(const node of elevated)node.classList.remove('story-card-menu-elevated');elevated=[];};
 const place=()=>{
  popup.style.position='fixed';popup.style.inset='auto';popup.style.visibility='hidden';popup.style.zIndex='1000';
  const anchor=trigger.getBoundingClientRect(),box=popup.getBoundingClientRect(),gap=6,pad=8;
  const below=anchor.bottom+gap,above=anchor.top-box.height-gap,top=below+box.height<=window.innerHeight-pad?below:Math.max(pad,above),left=Math.max(pad,Math.min(anchor.left,window.innerWidth-box.width-pad));
  popup.style.top=Math.round(top)+'px';popup.style.left=Math.round(left)+'px';
  // Some browsers retain a nested disclosure's positioning origin for fixed descendants.
  // Correct the measured result so rails and card overflow never clip the menu.
  const placed=popup.getBoundingClientRect();popup.style.top=Math.round(top+top-placed.top)+'px';popup.style.left=Math.round(left+left-placed.left)+'px';popup.style.visibility='visible';
 };
 menu.addEventListener('toggle',()=>{
  resetPlacement();if(!menu.open)return;elevated=[menu.closest('article'),menu.closest('.rail-section')].filter(Boolean);for(const node of elevated)node.classList.add('story-card-menu-elevated');placement=new AbortController();requestAnimationFrame(place);
  window.addEventListener('resize',close,{signal:placement.signal});document.addEventListener('scroll',close,{capture:true,signal:placement.signal});
  document.addEventListener('pointerdown',event=>{if(!menu.contains(event.target))close();},{signal:placement.signal});
 });
 menu.addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();close();trigger.focus();}});return menu;
}

/**
 * Complete reusable story card. The component owns all markup and interaction
 * chrome; adapters supply domain text, destinations, and optional callbacks.
 */
export function createStoryCardFrame(record,{tone='',headingLevel=3,eyebrow='',badge,profileLabel,context=[],actions=[],menuItems=[],cardClass=''}){
 const card=el('article',['story-character-card','story-card',tone,cardClass].filter(Boolean).join(' ')),profile=el('a','character-profile-link'),copy=el('div','character-card-copy');
 profile.href=record.href;profile.setAttribute('aria-label',profileLabel||'Open '+record.name+' profile');
 copy.append(el('p','character-role',eyebrow),el(headingLevel===2?'h2':'h3','character-name',record.name));
 profile.append(storyCardPicture(record,'character-card-art'));if(badge)profile.append(badge);profile.append(copy);
 const details=el('div','character-affiliation'),footer=el('div','character-actions');details.append(...context);
 const controls=[...actions];if(menuItems.length)controls.push(createStoryCardMenu(record,menuItems));footer.style.setProperty('--story-card-actions',String(Math.max(1,controls.length)));footer.setAttribute('role','group');footer.setAttribute('aria-label','Actions for '+record.name);footer.append(...controls);
 card.append(profile,details,footer);return card;
}
