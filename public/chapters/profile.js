import {initProfileEditor} from '../profiles/editor.js?v=__WTF_ASSET_REVISION__';
import {resize} from '../profiles/controls.js?v=profile-reading-1';

const form=document.querySelector('#profile-form'),initial=JSON.parse(document.querySelector('#profile-data').textContent);
const arcs=new Map((initial.arcOptions||[]).map(arc=>[arc.id,arc])),connected=new Set(initial.connectedArcIds||[]);
const picker=document.querySelector('#chapter-arc-picker'),values=document.querySelector('#chapter-arc-values');
function paintArcs(){
 values.replaceChildren();
 for(const id of connected){
  const arc=arcs.get(id),name=arc?.name||'Unavailable arc',chip=document.createElement('span');
  chip.className='chapter-arc-chip';chip.dataset.chapterArc=id;chip.setAttribute('role','listitem');
  const label=document.createElement(arc?'a':'span');label.textContent=name;
  if(arc)label.href='/story-arcs/'+encodeURIComponent(id)+'/?novel='+encodeURIComponent(initial.novelId);
  const remove=document.createElement('button');remove.type='button';remove.textContent='×';remove.dataset.disconnectArc=id;remove.setAttribute('aria-label','Disconnect story arc: '+name);
  chip.append(label,remove);values.append(chip);
 }
 for(const option of picker.options)option.disabled=connected.has(option.value);
 picker.value='';picker.disabled=connected.size>=50;
}
function previewMetadata(){
 const number=form.elements.namedItem('chapterNumber').value,status=form.elements.namedItem('status');
 document.querySelectorAll('[data-chapter-number-value]').forEach(element=>element.textContent=number||'—');
 document.querySelectorAll('[data-chapter-number-label]').forEach(element=>element.textContent='Chapter '+(number?number.padStart(2,'0'):'—'));
 document.querySelector('#chapter-status-label').textContent=status.selectedOptions[0]?.textContent||'Draft';
}
const editor=initProfileEditor({
 fieldNames:['title','summary','status'],endpoint:'/api/chapters',type:'chapter',nameField:'title',
 readExtra(){return {chapterNumber:Number(form.elements.namedItem('chapterNumber').value),connectedArcIds:[...connected]};},
 onSaved(data){
  form.elements.namedItem('status').value=data.status;form.elements.namedItem('chapterNumber').value=data.chapterNumber;
  connected.clear();for(const id of data.connectedArcIds||[])connected.add(id);
  paintArcs();previewMetadata();resize(document.querySelector('#field-title'));
 }
});
picker.addEventListener('change',()=>{const id=picker.value;if(arcs.get(id)?.available&&connected.size<50)connected.add(id);paintArcs();});
values.addEventListener('click',event=>{const button=event.target.closest('[data-disconnect-arc]');if(!button||button.disabled)return;connected.delete(button.dataset.disconnectArc);paintArcs();form.dispatchEvent(new Event('change',{bubbles:true}));picker.focus();});
form.addEventListener('input',previewMetadata);form.addEventListener('change',previewMetadata);
paintArcs();previewMetadata();

// History can restore an old chapter presentation after its scenes changed.
// Keep a local profile draft intact; clean pages can load the saved article.
window.addEventListener('pageshow',event=>{
 if(event.persisted&&!editor.dirty&&document.querySelector('#chapter-scenes-editor')?.dataset.dirty!=='true')location.reload();
});
