import {createCharacterCard} from '../components/character-card/card.js?v=2';
import {initDirectoryShell,fetchDirectory} from '../directory/shell.js?v=1';
import {characters,selectCharacters} from './data.js';

const directory=initDirectoryShell({
 async load(options){
  const data=await fetchDirectory('/api/characters?view=cards',options);
  return data.characters.map(character=>({...character,provider:characters.find(sample=>sample.id===character.id)?.provider||''}));
 },
 select:(records,{query,sort,reversed})=>selectCharacters(query,sort,reversed,records),
 renderItem:character=>createCharacterCard(character,{headingLevel:2,onUpdate:updated=>Object.assign(character,updated)})
});

// Creation belongs to the page adapter; retries retain the same idempotency ID.
const newButton=document.querySelector('#new-character');
let pendingId,creating=false;
newButton.addEventListener('click',async()=>{
 if(creating)return;creating=true;newButton.disabled=true;newButton.textContent='Creating…';directory.clearError();pendingId??=crypto.randomUUID();
 try{
  const response=await fetch('/api/characters',{method:'POST',credentials:'same-origin',headers:{'content-type':'application/json'},body:JSON.stringify({id:pendingId})});
  if(!response.headers.get('content-type')?.includes('application/json'))throw new Error('Your session may have expired. Reload to sign in again.');
  const character=await response.json();if(!response.ok)throw new Error(character.error||'Unable to create your character.');
  location.assign('/characters/'+encodeURIComponent(character.id)+'/');
 }catch(error){directory.showError(error);creating=false;newButton.disabled=false;newButton.textContent='+ New character';}
});
function showLinkedCharacter(){const id=location.hash.slice(1);if(characters.some(character=>character.id===id))location.replace('/characters/'+id+'/');}
window.addEventListener('hashchange',showLinkedCharacter);showLinkedCharacter();
window.addEventListener('pageshow',event=>{if(event.persisted){creating=false;pendingId=undefined;newButton.disabled=false;newButton.textContent='+ New character';}});
