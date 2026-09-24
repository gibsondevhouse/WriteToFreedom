import {months,precisionNames,parseStoryDate,formatStoryDate,calendarCells,shiftMonth,daysInMonth,yearLabel} from './dates.js?v=date-picker-1';
const modes=Object.keys(precisionNames),minYear=-999999,maxYear=999999;
function node(tag,text,cls){const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;}
function button(text,label,action,cls){const b=node('button',text,cls);b.type='button';if(label)b.setAttribute('aria-label',label);b.addEventListener('click',action);return b;}
// Keep the picker beside its source card when there is room, inside the viewport otherwise.
export function datePickerPlacement(field,card,viewport,width,height){
 const leftEdge=viewport.left+12,topEdge=viewport.top+12,rightEdge=viewport.left+viewport.width-12,bottomEdge=viewport.top+viewport.height-12;
 const beside=card&&card.left-12-width>=leftEdge&&card.left-12<=rightEdge;
 const left=beside?card.left-12-width:Math.max(leftEdge,Math.min(field.right-width,rightEdge-width));
 const desiredTop=beside?field.top-16:field.bottom+9+height<=bottomEdge?field.bottom+9:field.top-height-9;
 return {left,top:Math.max(topEdge,Math.min(desiredTop,bottomEdge-height))};
}
/**
 * Mount the shared dialog once for this form's data-date-input controls.
 * Commit dispatches input/change into the profile draft; the owning editor saves.
 * Cancel preserves the source value. Owns focus, positioning, keyboard handling,
 * and document-lifetime listeners; there is no independent API write or teardown.
 */
export function initDatePicker(form){
 const fields=[...form.querySelectorAll('[data-date-input]')];if(!fields.length)return;
 const today=new Date(),now={year:today.getFullYear(),month:today.getMonth()+1,day:today.getDate()};
 let active=null,mode='day',view={...now},focused={...now},parsed=null,needsSelection=false,approximate=false,restoreFocus=true;
 const dialog=node('dialog',undefined,'date-dialog');dialog.id='profile-date-picker';dialog.setAttribute('aria-labelledby','date-picker-title');
 const heading=node('div',undefined,'date-picker-heading'),title=node('h2');title.id='date-picker-title';
 heading.append(title,button('×','Cancel date selection',()=>dialog.close(),'date-dismiss'));
 const entry=node('div',undefined,'date-entry'),draft=node('input');draft.type='text';draft.maxLength=10000;draft.placeholder='YYYY-MM-DD or a story date';draft.setAttribute('aria-label','Selected date');
 entry.append(draft,button('×','Clear date',()=>commit(''),'date-clear'));
 const tabs=node('div',undefined,'date-tabs');tabs.setAttribute('role','tablist');tabs.setAttribute('aria-label','Date precision');
 const panel=node('div',undefined,'date-picker-panel');panel.id='date-picker-panel';panel.setAttribute('role','tabpanel');
 for(const key of modes){const tab=button(precisionNames[key],null,()=>setMode(key));tab.id='date-tab-'+key;tab.setAttribute('role','tab');tab.setAttribute('aria-controls',panel.id);tab.dataset.mode=key;tabs.append(tab);}
 const navigation=node('div',undefined,'date-navigation');
 const previous=button('‹','Previous month',()=>navigate(-1),'date-arrow'),next=button('›','Next month',()=>navigate(1),'date-arrow');
 const month=node('select');month.setAttribute('aria-label','Calendar month');months.forEach((name,index)=>{const option=node('option',name);option.value=index+1;month.append(option);});
 const year=node('input');year.type='number';year.min='1';year.max='999999';year.step='1';year.setAttribute('aria-label','Calendar year');
 const era=node('select');era.setAttribute('aria-label','Calendar era');for(const label of ['CE','BCE']){const option=node('option',label);option.value=label;era.append(option);}
 navigation.append(previous,month,year,era,next);
 const grid=node('div',undefined,'date-picker-grid'),navigationError=node('p',undefined,'date-error');navigationError.hidden=true;navigationError.setAttribute('role','alert');
 panel.append(navigation,navigationError,grid);
 const options=node('div',undefined,'date-options'),approxLabel=node('label'),approx=node('input');approx.type='checkbox';approxLabel.append(approx,document.createTextNode(' Approximate'));options.append(approxLabel);
 const note=node('p',undefined,'date-note');note.id='date-picker-note';draft.setAttribute('aria-describedby',note.id);
 const footer=node('div',undefined,'date-picker-footer'),cancel=button('Cancel',null,()=>dialog.close()),apply=button('Use date',null,applyDraft,'date-apply');footer.append(cancel,apply);
 dialog.append(heading,entry,tabs,panel,options,note,footer);document.body.append(dialog);
 function describe(){
  apply.disabled=needsSelection;
  approx.disabled=Boolean(draft.value.trim()&&!parsed);approx.checked=!approx.disabled&&approximate;approxLabel.title=approx.disabled?'For custom dates, enter any approximation directly in the date text.':'';
  if(needsSelection)note.textContent='Choose a '+precisionNames[mode].toLowerCase()+' above, or enter a date.';
  else if(draft.value.trim()&&!parseStoryDate(draft.value))note.textContent='This custom date will be saved as entered and remain unplaced on the timeline. Enter any approximation in the text.';
  else note.textContent='Choose a date or enter your own. Save changes on the profile to keep it.';
 }
 function position(){if(!dialog.open||!active)return;const box=active.getBoundingClientRect(),viewport=window.visualViewport,w=viewport?.width||innerWidth,h=viewport?.height||innerHeight,ox=viewport?.offsetLeft||0,oy=viewport?.offsetTop||0;
  dialog.style.maxHeight=Math.max(120,h-24)+'px';dialog.style.width=Math.min(354,w-24)+'px';
  const point=datePickerPlacement(box,active.closest('.infobox')?.getBoundingClientRect(),{left:ox,top:oy,width:w,height:h},dialog.offsetWidth,dialog.offsetHeight);
  dialog.style.left=point.left+'px';dialog.style.top=point.top+'px';
 }
 function selected(date){return parsed&&parsed.year===date.year&&parsed.month===date.month&&parsed.day===date.day&&parsed.precision==='day';}
 function choose(parts){if(!readYear())return;try{commit(formatStoryDate({...parts,approximate,precision:mode}));}catch(error){navigationError.textContent=error.message;navigationError.hidden=false;}}
 function render(){
  for(const tab of tabs.children){const on=tab.dataset.mode===mode;tab.setAttribute('aria-selected',String(on));tab.tabIndex=on?0:-1;}
  panel.setAttribute('aria-labelledby','date-tab-'+mode);month.hidden=mode!=='day';month.value=view.month;year.value=view.year<=0?1-view.year:view.year;era.value=view.year<=0?'BCE':'CE';year.max=era.value==='BCE'?'1000000':'999999';
  previous.setAttribute('aria-label',mode==='day'?'Previous month':mode==='year'?'Previous 12 years':'Previous year');next.setAttribute('aria-label',mode==='day'?'Next month':mode==='year'?'Next 12 years':'Next year');
  previous.disabled=view.year<=minYear&&(mode!=='day'||view.month===1);next.disabled=view.year>=maxYear&&(mode!=='day'||view.month===12);
  approx.checked=approximate;grid.replaceChildren();grid.className='date-picker-grid '+(mode==='day'?'date-days':'date-periods');
  if(mode==='day'){
   grid.setAttribute('role','grid');grid.setAttribute('aria-label',months[view.month-1]+' '+yearLabel(view.year));
   const header=node('div',undefined,'date-week');header.setAttribute('role','row');['Su','Mo','Tu','We','Th','Fr','Sa'].forEach((day,index)=>{const label=node('span',day);label.setAttribute('role','columnheader');label.setAttribute('aria-label',['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][index]);header.append(label);});grid.append(header);
   const cells=calendarCells(view.year,view.month);if(!cells.some(c=>sameDay(c,focused)))focused={year:view.year,month:view.month,day:1};
   for(let week=0;week<6;week++){const row=node('div',undefined,'date-week');row.setAttribute('role','row');for(const date of cells.slice(week*7,week*7+7)){
    const cell=node('div');cell.setAttribute('role','gridcell');cell.setAttribute('aria-selected',String(Boolean(selected(date))));const day=button(String(date.day),`${months[date.month-1]} ${date.day}, ${yearLabel(date.year)}`,()=>choose(date));
    day.dataset.day=String(date.day);day.dataset.month=String(date.month);day.dataset.year=String(date.year);day.className=(date.outside?'outside ':'')+(selected(date)?'selected ':'');day.tabIndex=sameDay(date,focused)?0:-1;
    day.disabled=date.year<minYear||date.year>maxYear;if(sameDay(date,now))day.setAttribute('aria-current','date');day.addEventListener('keydown',event=>dayKey(event,date));day.addEventListener('focus',()=>focused=date);cell.append(day);row.append(cell);
   }grid.append(row);}
  }else{
   grid.removeAttribute('role');grid.setAttribute('aria-label',precisionNames[mode]+' choices');
   const entries=mode==='month'?months.map((label,i)=>({label,month:i+1})):mode==='quarter'?Array.from({length:4},(_,i)=>({label:'Q'+(i+1),detail:months[i*3].slice(0,3)+' – '+months[i*3+2].slice(0,3),quarter:i+1})):mode==='half-year'?[{label:'First half',detail:'January – June',half:1},{label:'Second half',detail:'July – December',half:2}]:Array.from({length:12},(_,i)=>({label:yearLabel(Math.floor(view.year/12)*12+i),year:Math.floor(view.year/12)*12+i}));
   for(const entry of entries){const parts={year:view.year,...entry};const choice=button(entry.label,null,()=>choose(parts));if(entry.detail)choice.append(node('small',entry.detail));choice.disabled=parts.year<minYear||parts.year>maxYear;
    const on=parsed&&parsed.precision===mode&&parsed.year===parts.year&&(mode==='year'||parsed[mode==='half-year'?'half':mode]===parts[mode==='half-year'?'half':mode]);choice.setAttribute('aria-pressed',String(Boolean(on)));if(on)choice.classList.add('selected');grid.append(choice);}
  }
  describe();if(dialog.open)requestAnimationFrame(position);
 }
 function sameDay(a,b){return a.year===b.year&&a.month===b.month&&a.day===b.day;}
 function readYear(){const number=Number(year.value),limit=era.value==='BCE'?1000000:999999;if(!year.value||!Number.isInteger(number)||number<1||number>limit){navigationError.textContent='Enter a year from 1 to '+limit+'.';navigationError.hidden=false;year.focus();return false;}navigationError.hidden=true;view.year=era.value==='BCE'?1-number:number;return true;}
 function setMode(key){if(!readYear())return;mode=key;needsSelection=parsed?.precision!==mode;render();}
 function navigate(direction){if(!readYear())return;view=mode==='day'?{...view,...shiftMonth(view.year,view.month,direction)}:{...view,year:view.year+direction*(mode==='year'?12:1)};view.year=Math.max(minYear,Math.min(maxYear,view.year));focused={year:view.year,month:view.month,day:1};render();}
 function dayKey(event,date){
  let nextDate={...date},delta=0;if(event.ctrlKey||event.metaKey||event.altKey)return;
  if(event.key==='ArrowLeft')delta=-1;else if(event.key==='ArrowRight')delta=1;else if(event.key==='ArrowUp')delta=-7;else if(event.key==='ArrowDown')delta=7;
  else if(event.key==='Home')delta=-calendarCells(date.year,date.month).findIndex(c=>sameDay(c,date))%7;
  else if(event.key==='End')delta=6-calendarCells(date.year,date.month).findIndex(c=>sameDay(c,date))%7;
  else if(event.key==='PageUp'||event.key==='PageDown'){nextDate={...date,...shiftMonth(date.year,date.month,(event.key==='PageUp'?-1:1)*(event.shiftKey?12:1))};nextDate.day=Math.min(date.day,daysInMonth(nextDate.year,nextDate.month));}
  else return;
  event.preventDefault();if(delta){nextDate.day+=delta;if(nextDate.day<1){const previous=shiftMonth(nextDate.year,nextDate.month,-1);nextDate={...previous,day:daysInMonth(previous.year,previous.month)+nextDate.day};}else if(nextDate.day>daysInMonth(nextDate.year,nextDate.month)){nextDate.day-=daysInMonth(nextDate.year,nextDate.month);nextDate={...nextDate,...shiftMonth(nextDate.year,nextDate.month,1)};}}
  if(nextDate.year<minYear||nextDate.year>maxYear)return;focused=nextDate;view={...nextDate};render();grid.querySelector('button[tabindex="0"]')?.focus();
 }
 function commit(value){if(!active)return false;if(value.length>10000){draft.reportValidity();return false;}const target=active;dialog.close();if(target.value!==value){target.value=value;target.dispatchEvent(new Event('input',{bubbles:true}));target.dispatchEvent(new Event('change',{bubbles:true}));}return true;}
 function applyDraft(){if(needsSelection||!draft.reportValidity())return false;return commit(draft.value.trim());}
 function open(input){if(input.disabled||input.closest('fieldset:disabled'))return;active=input;restoreFocus=true;parsed=parseStoryDate(input.value);draft.value=input.value;mode=parsed?.precision||'day';approximate=parsed?.approximate||false;needsSelection=false;navigationError.hidden=true;
  view={year:parsed?.year??now.year,month:parsed?.month||(parsed?.quarter?(parsed.quarter-1)*3+1:parsed?.half?(parsed.half-1)*6+1:parsed?1:now.month),day:parsed?.day||1};focused={...view,day:parsed?.day||(!parsed?now.day:1)};
  title.textContent=input.getAttribute('aria-label')||'Choose date';document.querySelectorAll('.field-menu[open]').forEach(menu=>menu.open=false);render();dialog.showModal();document.body.classList.add('date-picker-open');position();draft.focus();draft.select();
 }
 for(const input of fields){input.addEventListener('click',()=>open(input));input.addEventListener('keydown',event=>{if(['Enter',' ','ArrowDown'].includes(event.key)){event.preventDefault();open(input);}});}
 draft.addEventListener('input',()=>{parsed=parseStoryDate(draft.value);needsSelection=false;approximate=parsed?.approximate||false;if(parsed){mode=parsed.precision;view={year:parsed.year,month:parsed.month||(parsed.quarter?(parsed.quarter-1)*3+1:parsed.half?(parsed.half-1)*6+1:1),day:parsed.day||1};focused={...view};}render();});
 draft.addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();applyDraft();}});
 month.addEventListener('change',()=>{if(readYear()){view.month=Number(month.value);focused={year:view.year,month:view.month,day:1};render();}});
 year.addEventListener('input',()=>{const value=Number(year.value);if(year.value&&Number.isInteger(value)&&value>=1&&value<=(era.value==='BCE'?1000000:999999)){view.year=era.value==='BCE'?1-value:value;navigationError.hidden=true;render();}});
 year.addEventListener('change',readYear);era.addEventListener('change',()=>{if(readYear())render();});
 year.addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();if(readYear()){render();grid.querySelector('button[tabindex="0"],button:not(:disabled)')?.focus();}}});
 approx.addEventListener('change',()=>{approximate=approx.checked;if(parsed){draft.value=formatStoryDate({...parsed,approximate});parsed=parseStoryDate(draft.value);}describe();});
 tabs.addEventListener('keydown',event=>{const current=modes.indexOf(mode);let index;if(event.key==='ArrowRight')index=(current+1)%modes.length;else if(event.key==='ArrowLeft')index=(current+modes.length-1)%modes.length;else if(event.key==='Home')index=0;else if(event.key==='End')index=modes.length-1;else return;event.preventDefault();setMode(modes[index]);tabs.children[index].focus();});
 dialog.addEventListener('click',event=>{const rect=dialog.getBoundingClientRect();if(event.target===dialog&&(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom))dialog.close();});
 dialog.addEventListener('close',()=>{document.body.classList.remove('date-picker-open');if(restoreFocus)active?.focus({preventScroll:true});});
 document.addEventListener('keydown',event=>{if(dialog.open&&(event.metaKey||event.ctrlKey)&&event.key.toLowerCase()==='s'){event.preventDefault();event.stopImmediatePropagation();restoreFocus=false;if(applyDraft())form.requestSubmit();else restoreFocus=true;}},true);
 window.addEventListener('scroll',position,{passive:true,capture:true});window.addEventListener('resize',position);window.visualViewport?.addEventListener('resize',position);window.visualViewport?.addEventListener('scroll',position);
}
