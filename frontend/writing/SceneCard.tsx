import {useEffect, useLayoutEffect, useRef, useState} from 'react';
import type {SceneRecord} from './contracts';

export type SceneBook = {id: string; title: string; coverUrl: string};
type SceneDetails = Pick<SceneRecord, 'title' | 'summary'>;

/** The parent novel supplies the cover; scene metadata stays in its own draft. */
export function SceneCard({book, scene, disabled = false, readOnly = false, onChange, onCreate}: {book: SceneBook; scene?: SceneDetails; disabled?: boolean; readOnly?: boolean; onChange?: (change: Partial<SceneDetails>) => void; onCreate?: () => void}) {
  const [coverFailed, setCoverFailed] = useState(false), card = useRef<HTMLDivElement>(null), title = useRef<HTMLTextAreaElement>(null);
  const monogram = book.title.replace(/^The\s+/i, '').trim().split(/\s+/).slice(0, 2).map(word => word[0] || '').join('').toUpperCase() || '?';
  function resizeTitle() {if (title.current) {title.current.style.height = 'auto'; title.current.style.height = title.current.scrollHeight + 2 + 'px';}}
  useLayoutEffect(resizeTitle, [scene?.title]);
  useEffect(() => {
    const observer = new ResizeObserver(resizeTitle);
    if (card.current) observer.observe(card.current);
    window.addEventListener('resize', resizeTitle);
    return () => {observer.disconnect(); window.removeEventListener('resize', resizeTitle);};
  }, []);
  useEffect(() => setCoverFailed(false), [book.coverUrl]);
  return <div ref={card} className="chapter-scene-card chapter-scene-image" role="group" aria-label={scene ? 'Scene card: ' + (scene.title || 'Untitled scene') : 'New scene card'}>
    <div className="chapter-scene-cover-well"><div className="chapter-scene-book-cover">
      <div className="chapter-scene-cover-placeholder" role="img" aria-hidden={Boolean(book.coverUrl && !coverFailed)} aria-label={'Book cover placeholder for ' + book.title}><span className="chapter-scene-cover-monogram" aria-hidden="true">{monogram}</span><span className="chapter-scene-cover-title" aria-hidden="true">{book.title}</span></div>
      {book.coverUrl && !coverFailed && <img src={book.coverUrl} alt={'Book cover for ' + book.title} referrerPolicy="no-referrer" onError={() => setCoverFailed(true)}/>}
    </div></div>
    <div className="chapter-scene-card-copy">{scene ? <>
      <label className="chapter-inline-title"><span className="writing-sr-only">Scene title</span><textarea ref={title} className="chapter-scene-title" aria-label="Scene title" rows={1} maxLength={160} value={scene.title} disabled={disabled} readOnly={readOnly} onChange={event => onChange?.({title: event.target.value})}/></label>
      <label className="chapter-scene-card-summary-field"><span>Scene summary</span><textarea className="chapter-scene-card-summary" aria-label="Scene summary" rows={3} maxLength={10000} placeholder="What changes in this scene?" disabled={disabled} readOnly={readOnly} value={scene.summary} onChange={event => onChange?.({summary: event.target.value})}/></label>
    </> : <><h3 className="chapter-scene-card-heading">Your next scene</h3><p className="section-note">Add a scene to start writing here.</p>{onCreate && <button type="button" className="writing-button" disabled={disabled} onClick={onCreate}>Add scene</button>}</>}</div>
  </div>;
}
