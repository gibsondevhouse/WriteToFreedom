import {memo, useEffect, useLayoutEffect, useRef, useState, type FocusEvent, type KeyboardEvent, type ReactNode} from 'react';
import {EditorContent, useEditor, useEditorState, type Editor} from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import {TextSelection} from '@tiptap/pm/state';
import type {WritingContent} from './contracts';

// Keep editor extensions and the persisted schema in public/writing/document.js aligned.
const extensions = [StarterKit.configure({heading: {levels: [1, 2, 3]}, codeBlock: false, link: false, trailingNode: false})];

/** Schema parsing keeps supported formatting; non-document pasted elements never enter the editor. */
function cleanPastedHTML(html: string): string {
  const document = new DOMParser().parseFromString(html, 'text/html');
  document.querySelectorAll('script,style,template,iframe,object,embed,meta,link').forEach(node => node.remove());
  // Limit list attributes to the same representation the storage validator accepts.
  document.querySelectorAll('ol').forEach(list => {
    const start = Number(list.getAttribute('start') || 1);
    if (!Number.isSafeInteger(start) || start < 1 || start > 1000000) list.removeAttribute('start');
    if (list.hasAttribute('type') && !['1', 'a', 'A', 'i', 'I'].includes(list.getAttribute('type')!)) list.removeAttribute('type');
  });
  return document.body.innerHTML;
}

interface EditorProps {
  sceneId: string;
  initialContent: WritingContent;
  editable: boolean;
  active?: boolean;
  inlineScene?: boolean;
  saveState?: 'saved' | 'dirty' | 'saving' | 'error' | 'unavailable';
  saveError?: string;
  saveDisabled?: boolean;
  onSave?: () => void;
  onUpdate: (content: WritingContent) => void;
}

/** The mounted editor owns selection/history; parent saves never call setContent. */
export const WritingEditor = memo(function WritingEditor({sceneId, initialContent, editable, active = true, inlineScene = false, saveState = 'saved', saveError = '', saveDisabled = false, onSave, onUpdate}: EditorProps) {
  const update = useRef(onUpdate); update.current = onUpdate;
  const initial = useRef(initialContent), failed = useRef(false), [error, setError] = useState(''), [toolsOpen, setToolsOpen] = useState(false), [editing, setEditing] = useState(false);
  const toolbarId = 'chapter-scene-toolbar-' + sceneId;
  const editor = useEditor({
    extensions,
    content: initial.current,
    editable,
    shouldRerenderOnTransaction: false,
    enableContentCheck: true,
    editorProps: {
      attributes: {class: 'writing-prose', role: 'textbox', 'aria-label': 'Scene text', 'aria-multiline': 'true', 'data-scene-editor': sceneId, spellcheck: 'true', ...(inlineScene ? {id: 'chapter-scene-prose-' + sceneId} : {})},
      transformPastedHTML: cleanPastedHTML,
    },
    onUpdate: ({editor}) => {if (!failed.current) {if (inlineScene) setEditing(true); update.current(editor.getJSON() as WritingContent);}},
    onContentError: () => {failed.current = true; setError('This scene contains formatting the editor cannot read. Your saved writing has not been changed.');},
  }, [sceneId]);

  const restoreAfterSave = useRef(false);
  useEffect(() => {
    if (!editor || editor.isDestroyed) return;
    if (!editable && editor.isEditable) restoreAfterSave.current = editor.view.dom.contains(document.activeElement);
    editor.setEditable(editable && !failed.current, false);
    let frame = 0;
    if (editable && restoreAfterSave.current) {
      restoreAfterSave.current = false;
      if (active && (document.activeElement === document.body || editor.view.dom.contains(document.activeElement))) frame = requestAnimationFrame(() => {if (!editor.isDestroyed) editor.commands.focus(undefined, {scrollIntoView: false});});
    }
    return () => cancelAnimationFrame(frame);
  }, [editor, editable, active, error]);
  // Hidden visited scenes stay mounted, retaining their own undo stacks and selection.
  const previouslyActive = useRef(active);
  useLayoutEffect(() => {
    // Restore the current selection before input resumes. Tiptap's focus
    // command defers selection restoration and can overwrite a newer edit.
    if (editor && !editor.isDestroyed && active && !previouslyActive.current) editor.view.focus();
    previouslyActive.current = active;
  }, [active, editor]);

  const previousSaveState = useRef(saveState);
  useEffect(() => {
    // The editing controls are transient. A successful save ends the editing
    // session, but a response to an older revision leaves a newer draft open.
    if (inlineScene && previousSaveState.current !== 'saved' && saveState === 'saved') {
      setEditing(false);
      setToolsOpen(false);
    }
    previousSaveState.current = saveState;
  }, [inlineScene, saveState]);
  const showEditingDock = inlineScene && (editing || saveState !== 'saved');
  const leaveEditor = (event: FocusEvent<HTMLDivElement>) => {
    if (event.currentTarget.contains(event.relatedTarget as Node | null) || saveState !== 'saved') return;
    setEditing(false);
    setToolsOpen(false);
  };

  if (!editor) return <p role="status">Opening scene…</p>;
  return <div className={'writing-editor' + (inlineScene ? ' writing-editor-inline' : '')} onFocusCapture={inlineScene ? () => setEditing(true) : undefined} onBlurCapture={inlineScene ? leaveEditor : undefined}>
    {inlineScene ? <section className="profile-section chapter-scene-manuscript" aria-label="Scene manuscript">
      <div className="collapsible-region chapter-scene-manuscript-body">
        {error && <p role="alert">{error}</p>}
        <div className="chapter-scene-writing-area">
          <OpeningHeadingPrompt editor={editor} disabled={!editable || Boolean(error)}/>
          <EditorContent editor={editor}/>
        </div>
        {showEditingDock && <div className="chapter-scene-editing-dock" role="group" aria-label="Scene editing controls">
          <FormattingToolbar editor={editor} disabled={!editable || Boolean(error)} id={toolbarId} hidden={!toolsOpen}/>
          <div className="chapter-scene-editing-dock-main">
            <EditorStatistics editor={editor} inlineScene/>
            <div className="chapter-scene-editor-actions">
              <button type="button" className="chapter-scene-format-toggle" aria-label="Formatting tools" aria-expanded={toolsOpen} aria-controls={toolbarId} disabled={!editable || Boolean(error)} onMouseDown={event => event.preventDefault()} onClick={() => setToolsOpen(open => !open)}>{toolsOpen ? 'Hide formatting' : 'Formatting'}</button>
              <span className="chapter-scene-save-state" data-state={saveState} role="status" title={saveState === 'error' ? saveError : undefined}><span>{saveState === 'saving' ? 'Saving…' : saveState === 'unavailable' ? 'Deleted — unsaved draft retained' : saveState === 'error' ? 'Not saved — ' + (saveError || 'your writing is still here') : saveState === 'dirty' ? 'Unsaved changes' : 'Saved'}</span></span>
              <button type="button" className="writing-button writing-primary chapter-scene-save-button" aria-keyshortcuts="Control+S Meta+S" disabled={saveDisabled || Boolean(error)} onClick={onSave}>{saveState === 'saving' ? 'Saving…' : 'Save scene'}</button>
            </div>
          </div>
        </div>}
      </div>
    </section> : <><FormattingToolbar editor={editor} disabled={!editable || Boolean(error)}/>{error && <p role="alert">{error}</p>}<EditorContent editor={editor}/><EditorStatistics editor={editor} inlineScene={false}/></>}
  </div>;
});

function OpeningHeadingPrompt({editor, disabled}: {editor: Editor; disabled: boolean}) {
  const hasHeading = useEditorState({editor, selector: ({editor}) => editor.state.doc.firstChild?.type.name === 'heading'});
  if (hasHeading) return null;
  const addHeading = () => {
    if (disabled || editor.isDestroyed || !editor.isEditable) return;
    const {state, view} = editor;
    const heading = state.schema.nodes.heading.create({level: 1});
    const transaction = state.tr.insert(0, heading);
    transaction.setSelection(TextSelection.create(transaction.doc, 1));
    view.dispatch(transaction);
    view.focus();
  };
  return <h2 className="chapter-scene-opening-heading" data-placeholder="true"><button type="button" disabled={disabled} onClick={addHeading}>Opening heading</button></h2>;
}

const FormattingToolbar = memo(function FormattingToolbar({editor, disabled, id, hidden = false}: {editor: Editor; disabled: boolean; id?: string; hidden?: boolean}) {
  const state = useEditorState({editor, selector: ({editor}) => ({
    bold: editor.isActive('bold'), italic: editor.isActive('italic'), underline: editor.isActive('underline'), strike: editor.isActive('strike'),
    paragraph: editor.isActive('paragraph'), h1: editor.isActive('heading', {level: 1}), h2: editor.isActive('heading', {level: 2}), h3: editor.isActive('heading', {level: 3}),
    bullet: editor.isActive('bulletList'), ordered: editor.isActive('orderedList'), quote: editor.isActive('blockquote'),
    undo: editor.can().undo(), redo: editor.can().redo(),
  })});
  function moveFocus(event: KeyboardEvent<HTMLDivElement>) {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    const buttons = [...event.currentTarget.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')], index = buttons.indexOf(document.activeElement as HTMLButtonElement);
    if (index < 0) return;
    event.preventDefault();
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + buttons.length) % buttons.length;
    buttons[next]?.focus();
  }
  const button = (label: string, children: ReactNode, command: () => void, pressed?: boolean, unavailable = false) => <button key={label} type="button" title={label} aria-label={label} aria-pressed={pressed} disabled={disabled || unavailable} onMouseDown={event => event.preventDefault()} onClick={command}>{children}</button>;
  return <div className="writing-toolbar" role="toolbar" aria-label="Text formatting" id={id} hidden={hidden} onKeyDown={moveFocus}>
    <span className="writing-toolbar-group">
      {button('Bold', <strong>B</strong>, () => {editor.chain().focus().toggleBold().run();}, state.bold)}
      {button('Italic', <em>I</em>, () => {editor.chain().focus().toggleItalic().run();}, state.italic)}
      {button('Underline', <u>U</u>, () => {editor.chain().focus().toggleUnderline().run();}, state.underline)}
      {button('Strikethrough', <s>S</s>, () => {editor.chain().focus().toggleStrike().run();}, state.strike)}
    </span>
    <span className="writing-toolbar-group">
      {button('Paragraph', '¶', () => {editor.chain().focus().setParagraph().run();}, state.paragraph)}
      {button('Heading 1', 'H1', () => {editor.chain().focus().toggleHeading({level: 1}).run();}, state.h1)}
      {button('Heading 2', 'H2', () => {editor.chain().focus().toggleHeading({level: 2}).run();}, state.h2)}
      {button('Heading 3', 'H3', () => {editor.chain().focus().toggleHeading({level: 3}).run();}, state.h3)}
    </span>
    <span className="writing-toolbar-group">
      {button('Bullet list', '• List', () => {editor.chain().focus().toggleBulletList().run();}, state.bullet)}
      {button('Numbered list', '1. List', () => {editor.chain().focus().toggleOrderedList().run();}, state.ordered)}
      {button('Block quote', '“ ”', () => {editor.chain().focus().toggleBlockquote().run();}, state.quote)}
      {button('Scene break', '―', () => {editor.chain().focus().setHorizontalRule().run();})}
    </span>
    <span className="writing-toolbar-group">
      {button('Undo', '↶', () => {editor.chain().focus().undo().run();}, undefined, !state.undo)}
      {button('Redo', '↷', () => {editor.chain().focus().redo().run();}, undefined, !state.redo)}
    </span>
  </div>;
});

function EditorStatistics({editor, inlineScene}: {editor: Editor; inlineScene: boolean}) {
  const words = useEditorState({editor, selector: ({editor}) => {const text = editor.state.doc.textBetween(0, editor.state.doc.content.size, ' ').trim(); return text ? text.split(/\s+/u).length : 0;}});
  const count = <span aria-label="Word count">{words.toLocaleString()} {words === 1 ? 'word' : 'words'}</span>;
  return inlineScene ? <span className="chapter-scene-word-count">{count}</span> : <div className="writing-editor-footer">{count}<span>Changes are saved when you choose Save scene.</span></div>;
}
