export async function requestJSON(path,options={}, {
 errorMessage='This request could not be completed. Please try again.',
 sessionMessage='Your session may have expired. Copy your changes before reloading to sign in again.'
}={}){
 const response=await fetch(path,{credentials:'same-origin',cache:'no-store',...options});
 if(response.status===204)return null;
 const type=response.headers.get('content-type')?.split(';',1)[0].trim().toLowerCase();
 if(type!=='application/json')throw Object.assign(new Error(sessionMessage),{status:response.status});
 const data=await response.json();
 if(!response.ok){
  const message=data&&typeof data==='object'&&typeof data.error==='string'&&data.error?data.error:errorMessage;
  throw Object.assign(new Error(message),{status:response.status});
 }
 return data;
}