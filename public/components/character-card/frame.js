// Presentation shared by character cards and Lore's jewel cards.
function el(tag,cls,text){const node=document.createElement(tag);if(cls)node.className=cls;if(text!==undefined)node.textContent=text;return node;}
function initials(name){return name.replace(/^The /,'').trim().split(/\s+/).slice(0,2).map(word=>word[0]).join('').toUpperCase()||'?';}
export function storyCardPicture(record,cls){
 const frame=el('span',cls),mark=el('span','character-initials',initials(record.name));mark.setAttribute('aria-hidden','true');frame.append(mark);
 if(record.image){try{const url=new URL(record.image);if(url.protocol==='https:'&&!url.username&&!url.password){const img=el('img');img.src=url.href;img.alt='';img.loading='lazy';img.referrerPolicy='no-referrer';img.addEventListener('error',()=>img.remove(),{once:true});frame.append(img);}}catch{}}
 return frame;
}
/** Owns the visual frame only; adapters supply real metadata and action nodes. */
export function createStoryCardFrame(record,{tone,headingLevel=3,eyebrow,badge,profileLabel,context=[],actions=[]}){
 const card=el('article','story-character-card '+tone),profile=el('a','character-profile-link'),copy=el('div','character-card-copy');
 profile.href=record.href;profile.setAttribute('aria-label',profileLabel||'Open '+record.name+' profile');
 copy.append(el('p','character-role',eyebrow),el(headingLevel===2?'h2':'h3','character-name',record.name));
 profile.append(storyCardPicture(record,'character-card-art'));if(badge)profile.append(badge);profile.append(copy);
 const details=el('div','character-affiliation'),footer=el('div','character-actions');
 details.append(...context);footer.append(...actions);card.append(profile,details,footer);return card;
}
