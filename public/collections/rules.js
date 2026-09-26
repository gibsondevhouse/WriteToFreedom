export const smartKinds=['character','faction','location','lore','story_arc','note'];
const fields=['entityType','subtype','linkedNovel','series','minNovelCount','unassigned'];
export function validateCollectionRules(input){
 if(!input||typeof input!=='object'||Array.isArray(input)||input.version!==1||!['all','any'].includes(input.mode)||!Array.isArray(input.predicates)||input.predicates.length<1||input.predicates.length>8)throw new Error('Use 1–8 supported criteria, matching all or any.');
 const predicates=input.predicates.map(rule=>{
  if(!rule||typeof rule!=='object'||Array.isArray(rule)||!fields.includes(rule.field))throw new Error('Choose a supported collection criterion.');
  if(rule.field==='unassigned')return {field:rule.field};
  if(rule.field==='minNovelCount'){
   if(!Number.isSafeInteger(rule.value)||rule.value<0||rule.value>1000)throw new Error('Use a linked-novel count from 0 to 1000.');
   return {field:rule.field,value:rule.value};
  }
  if(typeof rule.value!=='string'||!rule.value||rule.value.length>160)throw new Error('Choose a value for each criterion.');
  if(rule.field==='entityType'&&!smartKinds.includes(rule.value))throw new Error('Choose a supported entry type.');
  if(rule.field==='subtype'&&!['location','lore'].includes(rule.kind))throw new Error('Choose Location or Lore for a subtype criterion.');
  return {field:rule.field,value:rule.value,...(rule.field==='subtype'?{kind:rule.kind}:{})};
 });
 return {version:1,mode:input.mode,predicates};
}
export function collectionRuleSummary(rules,labels={}){
 const phrase=rule=>({entityType:'Type is '+rule.value,subtype:(rule.kind==='lore'?'Lore':'Location')+' subtype is '+rule.value,linkedNovel:'Linked to '+(labels[rule.value]||'a selected novel'),series:'Linked through '+(labels[rule.value]||'a selected series'),minNovelCount:'Linked to at least '+rule.value+' novels',unassigned:'Unassigned to any novel'}[rule.field]);
 return rules.predicates.map(phrase).join(rules.mode==='any'?' OR ':' AND ');
}
