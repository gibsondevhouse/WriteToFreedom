import {memo, useEffect, useRef, useState, type KeyboardEvent, type ReactNode} from 'react';
import {EditorContent, useEditor, useEditorState, type Editor} from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
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
  onUpdate: (content: WritingContent) => void;
}

/** The mounted editor owns selection/history; parent saves never call setContent. */
export const WritingEditor = memo(function WritingEditor({sceneId, initialContent, editable, active = true, onUpdate}: EditorProps) {
  const update = useRef(onUpdate); update.current = onUpdate;
  const initial = useRef(initialContent), failed = useRef(false), [error, setError] = useState('');
  const editor = useEditor({
    extensions,
    content: initial.current,
    editable,
    shouldRerenderOnTransaction: false,
    enableContentCheck: true,
    editorProps: {
      attributes: {class: 'writing-prose', role: 'textbox', 'aria-label': 'Scene text', 'aria-multiline': 'true', 'data-scene-editor': sceneId, spellcheck: 'true'},
      transformPastedHTML: cleanPastedHTML,
    },
    onUpdate: ({editor}) => {if (!failed.current) update.current(editor.getJSON() as WritingContent);},
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
  useEffect(() => {
    let frame = 0;
    if (editor && active && !previouslyActive.current) frame = requestAnimationFrame(() => {if (!editor.isDestroyed) editor.commands.focus(undefined, {scrollIntoView: false});});
    previouslyActive.current = active;
    return () => cancelAnimationFrame(frame);
  }, [active, editor]);

  if (!editor) return <p role="status">Opening scene…</p>;
  return <div className="writing-editor">
    <FormattingToolbar editor={editor} disabled={!editable || Boolean(error)}/>
    {error && <p role="alert">{error}</p>}
    <EditorContent editor={editor}/>
    <EditorStatistics editor={editor}/>
  </div>;
});

const FormattingToolbar = memo(function FormattingToolbar({editor, disabled}: {editor: Editor; disabled: boolean}) {
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
  return <div className="writing-toolbar" role="toolbar" aria-label="Text formatting" onKeyDown={moveFocus}>
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

function EditorStatistics({editor}: {editor: Editor}) {
  const words = useEditorState({editor, selector: ({editor}) => {const text = editor.state.doc.textBetween(0, editor.state.doc.content.size, ' ').trim(); return text ? text.split(/\s+/u).length : 0;}});
  return <div className="writing-editor-footer"><span aria-label="Word count">{words.toLocaleString()} {words === 1 ? 'word' : 'words'}</span><span>Changes are saved when you choose Save scene.</span></div>;
}
