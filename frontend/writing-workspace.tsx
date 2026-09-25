import {createRoot} from 'react-dom/client';
import {WritingWorkspace} from './writing/Workspace';
import './writing/workspace.css';

const host = document.getElementById('writing-workspace-root');
if (host) createRoot(host).render(<WritingWorkspace/>);
