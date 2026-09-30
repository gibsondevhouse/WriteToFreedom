const uploadedCharacterPortrait=/^\/api\/characters\/(?:[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}|claude|gpt|deepseek|gemini)\/portraits\/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Accept remote HTTPS artwork and owner-scoped portrait routes for display. */
export function displayImageSource(value){
 if(typeof value!=='string'||!value)return '';
 if(uploadedCharacterPortrait.test(value))return value;
 try{const url=new URL(value);return url.protocol==='https:'&&!url.username&&!url.password?url.href:'';}catch{return '';}
}
