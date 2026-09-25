/** Exact multi-select values; joined strings remain a legacy/display projection. */
export const choiceSeparator=' · ';
export const splitLegacyChoices=value=>[...new Set(String(value||'').split(/\s*·\s*/).map(value=>value.trim()).filter(Boolean))];
export const joinChoices=values=>values.join(choiceSeparator);

/** Preserve a recorded label even when it contains the display separator. */
export function choicesFor(record,key){
 const values=record.choiceSelections?.[key];
 return Array.isArray(values)&&values.every(value=>typeof value==='string'&&value.trim())&&joinChoices(values)===(record[key]||'')?[...new Set(values)]:splitLegacyChoices(record[key]);
}

/**
 * Validate exact arrays and keep legacy strings synchronized. Old clients may
 * change a string while echoing unchanged arrays from their last GET; recognize
 * that case without discarding arrays during unrelated edits.
 */
export function validateChoiceSelections(input,current,document,allowed){
 const supplied=Object.hasOwn(input,'choiceSelections')?input.choiceSelections:{};
 if(!supplied||typeof supplied!=='object'||Array.isArray(supplied)||Object.keys(supplied).some(key=>!allowed.includes(key)))throw new Error('Choose values from this profile’s supported multi-select fields.');
 const result={};
 for(const key of allowed){
  const old=choicesFor(current,key),legacyChanged=Object.hasOwn(input,key)&&document[key]!==current[key];
  let values;
  if(Object.hasOwn(supplied,key)){
   values=supplied[key];
   if(!Array.isArray(values)||values.some(value=>typeof value!=='string'||!value.trim()||value.length>10000)||new Set(values).size!==values.length||joinChoices(values).length>10000)throw new Error('Use distinct, nonblank choices within the field’s 10,000-character limit.');
   if(Object.hasOwn(input,key)&&document[key]!==joinChoices(values)){
    if(legacyChanged&&JSON.stringify(values)===JSON.stringify(old))values=splitLegacyChoices(document[key]);
    else throw new Error('The selected choices do not match their text value. Reload before saving.');
   }
  }else values=legacyChanged?splitLegacyChoices(document[key]):choicesFor({...current,[key]:document[key]},key);
  result[key]=[...values];
  document[key]=joinChoices(values);
 }
 return result;
}
