// A heading becomes current only when its top reaches the sticky bar's lower edge.
export function sectionAtHeader(tops,edge){
 let index=-1;for(let i=0;i<tops.length;i++)if(Number.isFinite(tops[i])&&tops[i]<=edge)index=i;return index;
}

export function initProfileViewport(form){
 const bar=form.querySelector('.article-bar'),current=bar?.querySelector('.current-view'),content=form.querySelector('.profile-content'),identity=form.querySelector('.infobox');
 if(!bar||!current||!content||!identity)return;
 const headings=[...content.querySelectorAll('.profile-section > .section-header h2')],original=current.textContent.trim();
 const label=document.createElement('span');label.className='current-view-label';label.textContent=original;current.replaceChildren(label);
 const reduced=matchMedia('(prefers-reduced-motion: reduce)');let frame=0,last=original,animations=[],previous=null,headerHeight=0;
 function clearAnimation(){animations.forEach(animation=>animation.cancel());animations=[];previous?.remove();previous=null;}
 function show(title){
  if(title===last)return;clearAnimation();const old=last;last=title;label.textContent=title;
  if(reduced.matches||typeof label.animate!=='function')return;
  const outgoing=document.createElement('span');outgoing.className='current-view-previous';outgoing.textContent=old;outgoing.setAttribute('aria-hidden','true');current.append(outgoing);previous=outgoing;
  const timing={duration:260,easing:'cubic-bezier(.22,.65,.25,1)'};
  const leave=outgoing.animate([{transform:'translateY(0)',opacity:1,filter:'brightness(1)'},{offset:.45,opacity:.3,filter:'brightness(.65)'},{transform:'translateY(-110%)',opacity:0,filter:'brightness(.8)'}],timing);
  const enter=label.animate([{transform:'translateY(110%)',opacity:0,filter:'brightness(.6)'},{offset:.5,opacity:.5,filter:'brightness(.75)'},{transform:'translateY(0)',opacity:1,filter:'brightness(1)'}],timing);
  animations=[leave,enter];leave.finished.then(()=>outgoing.remove(),()=>outgoing.remove());
 }
 function update(){
  frame=0;const bounds=bar.getBoundingClientRect(),height=bounds.height;
  if(height!==headerHeight){headerHeight=height;form.style.setProperty('--profile-header-height',height+'px');}
  const index=bounds.top<=0?sectionAtHeader(headings.map(heading=>heading.getClientRects().length?heading.getBoundingClientRect().top:Infinity),bounds.bottom):-1;
  form.classList.toggle('profile-reading',index>=0);
  show(index<0?original:headings[index].textContent.trim());
 }
 function schedule(){if(!frame)frame=requestAnimationFrame(update);}
 window.addEventListener('scroll',schedule,{passive:true});window.addEventListener('resize',schedule);window.addEventListener('hashchange',schedule);
 form.addEventListener('click',schedule);form.addEventListener('input',schedule);form.addEventListener('change',schedule);form.addEventListener('toggle',schedule,true);
 const observer=new ResizeObserver(schedule);observer.observe(bar);observer.observe(content);observer.observe(identity);content.querySelectorAll('.profile-section').forEach(section=>observer.observe(section));
 reduced.addEventListener('change',()=>{if(reduced.matches)clearAnimation();});
 update();
}
