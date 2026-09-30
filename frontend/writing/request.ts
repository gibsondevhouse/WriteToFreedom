import {requestJSON} from '../../public/profiles/request.js';

/** The chapter profile and writing workspace share the same API response contract. */
export async function requestWritingJSON(path: string, options: RequestInit = {}): Promise<unknown> {
  return requestJSON(path, options, {sessionMessage: 'Your session may have expired. Copy your unsaved writing before reloading to sign in again.'});
}
