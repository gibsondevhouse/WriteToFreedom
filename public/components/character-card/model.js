const tones=['clay','jade','blue','violet','gold'];
export function characterTone(record,tone){if(tones.includes(tone))return tone;const seed={claude:0,gpt:1,deepseek:2,gemini:3};return tones[seed[record.id]??[...record.id].reduce((sum,c)=>sum+c.charCodeAt(0),0)%tones.length];}
export function normalizeCard(data){
 const record={...data},name=typeof data.name==='string'&&data.name.trim()?data.name.trim():'Untitled character';
 return {...record,id:String(data.id||''),name,href:data.href||'/characters/'+encodeURIComponent(data.id||'')+'/',image:data.image||data.portraitUrl||'',roles:Array.isArray(data.roles)?data.roles:typeof data.roles==='string'?data.roles.split(/\s*[·,;]\s*/).filter(Boolean):[],relationships:Array.isArray(data.relationships)?data.relationships:[],mentions:Array.isArray(data.mentions)?data.mentions:[],affiliationCard:data.affiliationCard||{name:data.affiliation||'Independent',label:data.affiliation?'Affiliation':'No affiliation',image:'',href:null}};
}
