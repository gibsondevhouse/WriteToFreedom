import {createRoot} from 'react-dom/client';
import {WritingWorkspace} from './writing/Workspace';
import '../public/components/story-card/card.css';
import './writing/workspace.css';

const host = document.getElementById('writing-workspace-root');
if (host) createRoot(host).render(<WritingWorkspace view={host.dataset.writingView==='chapters'?'chapters':'scenes'}/>);
