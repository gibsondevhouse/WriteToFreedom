import {loreTypes,loreHref,loreTemplates} from '../public/lore/template.js';

export function loreCard(record){return {id:record.id,name:record.name,kind:'lore',label:loreTypes[record.type],type:record.type,href:loreHref(record),image:record.imageUrl||'',summary:record.summary||record.introduction||record.body||'',tags:record.tags||'',collections:record.collections,pinned:record.pinned,featured:record.featured,updatedAt:record.updatedAt||'',searchText:loreTemplates[record.type].fields.filter(k=>k!=='imageUrl').map(k=>record[k]).join(' '),connectionCount:record.connections.length};}
export function loreQuestions(records){return records.filter(r=>r.questions?.trim()).map(r=>{const prompts=r.questions.split(/\n+/).map(s=>s.trim()).filter(Boolean);return {...loreCard(r),href:loreHref(r)+(r.hiddenFields.includes('questions')?'':'#field-questions'),prompts,question:prompts[0],questionCount:prompts.length};});}
export function loreDashboardData(records,cast){
 const notes=cast.flatMap(c=>(c.notes||[]).map(n=>({id:'note-'+c.id+'-'+n.id,name:n.title||n.text.slice(0,70),kind:'note',label:(n.type==='lore'?'Character lore':'Character note'),type:'note',href:'/characters/'+encodeURIComponent(c.id)+'/#note-'+n.id,summary:n.text,parent:c.name||'Untitled character',image:'',collections:['notes'],tags:(n.tags||[]).join(' '),updatedAt:c.updatedAt||'',contextual:true,connectionCount:(n.links||[]).length})));
 return {entries:records.map(loreCard),notes,questions:loreQuestions(records)};
}
