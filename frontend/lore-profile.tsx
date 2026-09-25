import {createRoot} from 'react-dom/client';
import {LoreNoteProfile} from './lore/LoreNoteProfile';
import {readProfileData} from './lore/contracts';

const host = document.getElementById('lore-profile-root');
const initial = document.getElementById('profile-data');
if (host && initial) {
  try {const data = readProfileData(JSON.parse(initial.textContent || '')); createRoot(host).render(<LoreNoteProfile {...data}/>);}
  catch (error) {const message = document.createElement('p'); message.setAttribute('role', 'alert'); message.textContent = error instanceof Error ? error.message : 'This note could not be opened. Reload to try again.'; host.replaceChildren(message);}
}
