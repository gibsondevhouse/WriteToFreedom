// Measurements remain authored strings. Number inputs sanitize accepted legacy
// representations (for example "+12" and "12.") before the author can save.
export const numericTextFields=['age','height','weight'];
export const numericTextError='Use a nonnegative number for age, height, and weight; age must be a whole number.';
export function validNumericText(key,value){
 if(typeof value!=='string')return false;
 if(value==='')return true;
 const number=Number(value);
 return Number.isFinite(number)&&number>=0&&(key!=='age'||Number.isInteger(number));
}
/** Keep untouched legacy text, including line breaks sanitized by a text input. */
export function bindNumericText(input,key,initialRaw=input.value){
 let edited=false;
 const read=()=>edited?input.value:initialRaw;
 const validate=()=>input.setCustomValidity(validNumericText(key,read())?'':numericTextError);
 input.addEventListener('input',()=>{edited=true;validate();});validate();
 return read;
}
