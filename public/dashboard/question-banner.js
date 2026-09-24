// The outer banner never moves. Only the non-interactive slide contents roll up.
/**
 * Create interleaved profile-question slides using host-supplied DOM/art helpers.
 * Owns rotation timers, animations, visibility/media listeners and an observer.
 * @returns {{element: HTMLElement, destroy: Function}} Call destroy before replacing
 * the banner so background work and document/media subscriptions are released.
 */
export function createQuestionBanner(records,{el,tone,initial,idPrefix='',emptyState}={}){
 const prefix=idPrefix?idPrefix+'-':'';
 const slides=[];
 const prompts=records.map(record=>(record.prompts||[record.question]).filter(Boolean));
 // Alternate profiles between questions so long lists don't dominate the rotation.
 for(let round=0;round<Math.max(0,...prompts.map(list=>list.length));round++)records.forEach((record,i)=>{if(prompts[i][round])slides.push({...record,question:prompts[i][round]});});
 const section=el('section','rail-section question-section'),header=el('div','rail-header'),heading=el('div','rail-title'),title=el('h2','','Open questions');title.id=prefix+'open-questions-title';section.setAttribute('aria-labelledby',title.id);heading.append(title,el('span','rail-count',String(slides.length)));header.append(heading);section.append(header);
 if(!slides.length){
  const banner=el('div','question-banner question-banner-empty'),stage=el('div','question-stage'),slide=el('div','question-slide'),copy=el('div','question-copy');
  copy.append(el('p','question-kind','No open questions yet'),el('h3','question-text',emptyState?.title||'Keep your story’s mysteries in view.'),el('p','question-description',emptyState?.description||'Add unresolved questions in a profile. They’ll appear here as you build your world.'));
  slide.append(copy);stage.append(slide);banner.append(stage);
  if(emptyState?.action){const footer=el('div','question-controls'),button=el('button','question-profile-link',emptyState.action.label);button.type='button';button.addEventListener('click',emptyState.action.onClick);footer.append(button);banner.append(footer);}
  section.append(banner);return {element:section,destroy(){}};
 }
 const banner=el('div','question-banner'),stage=el('div','question-stage'),footer=el('div','question-controls'),link=el('a','question-profile-link','Open profile ↗'),transport=el('div','question-transport'),count=el('span','question-position'),live=el('span','sr-only');
 banner.setAttribute('role','region');banner.setAttribute('aria-roledescription','carousel');banner.setAttribute('aria-label','Open questions');stage.id=prefix+'question-stage';stage.setAttribute('aria-live','off');live.setAttribute('aria-live','polite');live.setAttribute('aria-atomic','true');
 const button=(name,glyph)=>{const node=el('button','question-control',glyph);node.type='button';node.setAttribute('aria-label',name);node.title=name;node.setAttribute('aria-controls',stage.id);return node;};
 const pause=button('Pause slideshow','Ⅱ'),prev=button('Previous question','‹'),next=button('Next question','›');
 transport.append(count);if(slides.length>1)transport.append(pause,prev,next);footer.append(link,transport);banner.append(stage,footer,live);section.append(banner);
 const reduced=matchMedia('(prefers-reduced-motion: reduce)');
 let index=0,paused=reduced.matches,hovered=false,visible=false,timer=null,animations=[],current=null,leaving=null,destroyed=false;
 const stopTimer=()=>{clearTimeout(timer);timer=null;};
 function cancelTransition(){animations.forEach(animation=>animation.cancel());animations=[];leaving?.remove();leaving=null;}
 function slideContent(record){
  const content=el('div','question-slide'),art=el('div','question-art '+tone(record),initial(record)),group=el('div','question-copy'),owner=el('div','question-owner'),avatar=el('span','owner-monogram '+tone(record),initial(record)),info=el('div');avatar.setAttribute('aria-hidden','true');art.setAttribute('aria-hidden','true');
  info.append(el('p','question-kind',record.label),el('p','question-name',record.name));owner.append(avatar,info);
  group.append(owner,el('h3','question-text',record.question));content.append(art,group);return content;
 }
 function canPlay(){return slides.length>1&&!paused&&!hovered&&visible&&!document.hidden&&!destroyed;}
 function schedule(){stopTimer();if(canPlay())timer=setTimeout(()=>show(index+1,false),8000);}
 function playback(){
  pause.textContent=paused?'▶':'Ⅱ';pause.setAttribute('aria-label',paused?'Play slideshow':'Pause slideshow');pause.title=paused?'Play slideshow':'Pause slideshow';banner.dataset.playing=String(canPlay());schedule();
 }
 function show(position,manual){
  if(destroyed)return;stopTimer();cancelTransition();index=(position+slides.length)%slides.length;
  const record=slides[index],incoming=slideContent(record),outgoing=current;current=incoming;stage.append(incoming);
  link.href=record.href;link.setAttribute('aria-label','Open '+record.name+' profile');count.textContent=`${index+1} / ${slides.length}`;banner.dataset.index=String(index);
  if(manual)live.textContent=`Question ${index+1} of ${slides.length}. ${record.name}.`;
  if(outgoing&&!reduced.matches){
   leaving=outgoing;outgoing.setAttribute('aria-hidden','true');outgoing.inert=true;
   const options={duration:1100,easing:'cubic-bezier(.3,0,.15,1)'};
   animations=[outgoing.animate([{transform:'translateY(0)',opacity:1},{transform:'translateY(-100%)',opacity:0}],options),incoming.animate([{transform:'translateY(100%)',opacity:0},{transform:'translateY(0)',opacity:1}],options)];
   const arriving=animations[1];arriving.finished.then(()=>{if(current!==incoming||destroyed)return;outgoing.remove();leaving=null;animations=[];schedule();}).catch(()=>{});
  }else{outgoing?.remove();schedule();}
 }
 function setPaused(value){paused=value;if(paused)cancelTransition();playback();}
 pause.addEventListener('click',()=>{hovered=false;setPaused(!paused);});
 prev.addEventListener('click',()=>{setPaused(true);show(index-1,true);});next.addEventListener('click',()=>{setPaused(true);show(index+1,true);});
 banner.addEventListener('pointerenter',event=>{if(event.pointerType!=='mouse')return;hovered=true;cancelTransition();playback();});
 banner.addEventListener('pointerleave',()=>{hovered=false;playback();});
 banner.addEventListener('focusin',event=>{if(event.target!==pause)setPaused(true);});
 const visibility=()=>{if(document.hidden)cancelTransition();playback();};document.addEventListener('visibilitychange',visibility);
 const preference=()=>{if(reduced.matches)setPaused(true);};reduced.addEventListener('change',preference);
 const observer=new IntersectionObserver(entries=>{visible=entries[0].isIntersecting&&entries[0].intersectionRatio>=.25;if(!visible)cancelTransition();playback();},{threshold:.25});observer.observe(banner);
 show(0,false);playback();
 return {element:section,destroy(){destroyed=true;stopTimer();cancelTransition();observer.disconnect();document.removeEventListener('visibilitychange',visibility);reduced.removeEventListener('change',preference);}};
}
