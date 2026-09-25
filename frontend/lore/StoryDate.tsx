import {useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent} from 'react';
import {createPortal} from 'react-dom';
import {calendarCells, daysInMonth, formatStoryDate, months, parseStoryDate, precisionNames, shiftMonth, weekday, yearLabel} from '../../public/profiles/dates.js';

type Precision = 'day' | 'month' | 'quarter' | 'half-year' | 'year';
type Day = {year: number; month: number; day: number};
const modes = Object.keys(precisionNames) as Precision[];
const minYear = -999999, maxYear = 999999;
const sameDay = (a: Day, b: Day) => a.year === b.year && a.month === b.month && a.day === b.day;
function initialDay(value: string): Day {
  const parsed = parseStoryDate(value), today = new Date();
  return {year: parsed?.year ?? today.getFullYear(), month: parsed?.month || (parsed?.quarter ? (parsed.quarter - 1) * 3 + 1 : parsed?.half ? (parsed.half - 1) * 6 + 1 : parsed ? 1 : today.getMonth() + 1), day: parsed?.day || (parsed ? 1 : today.getDate())};
}

export function StoryDate({value, onChange, requestSave}: {value: string; onChange: (value: string) => void; requestSave: () => void}) {
  const source = useRef<HTMLInputElement>(null), [open, setOpen] = useState(false);
  return <><div className="date-control"><input ref={source} id="field-originDate" name="originDate" aria-label="Origin / creation" type="text" data-date-input readOnly aria-haspopup="dialog" aria-controls="profile-date-picker" autoComplete="off" maxLength={10000} value={value} placeholder="Select date…" onClick={() => setOpen(true)} onKeyDown={event => {if (['Enter', ' ', 'ArrowDown'].includes(event.key)) {event.preventDefault(); setOpen(true);}}}/><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><rect x="4" y="5" width="16" height="16" rx="2"/><path d="M8 3v4m8-4v4M4 10h16"/></svg></div>
    {open && createPortal(<DateDialog value={value} source={source.current!} close={() => setOpen(false)} commit={onChange} requestSave={requestSave}/>, document.body)}</>;
}

function DateDialog({value, source, close, commit, requestSave}: {value: string; source: HTMLInputElement; close: () => void; commit: (value: string) => void; requestSave: () => void}) {
  const dialog = useRef<HTMLDialogElement>(null), entry = useRef<HTMLInputElement>(null), grid = useRef<HTMLDivElement>(null), restoreFocus = useRef(true), focusDay = useRef(false);
  const [draft, setDraft] = useState(value), [mode, setMode] = useState<Precision>((parseStoryDate(value)?.precision as Precision) || 'day'), [view, setView] = useState(() => initialDay(value)), [focused, setFocused] = useState(() => initialDay(value));
  const [yearText, setYearText] = useState(String(view.year <= 0 ? 1 - view.year : view.year)), [era, setEra] = useState(view.year <= 0 ? 'BCE' : 'CE'), [error, setError] = useState(''), [needsSelection, setNeedsSelection] = useState(false), [approximate, setApproximate] = useState(parseStoryDate(value)?.approximate || false);
  const parsed = parseStoryDate(draft), cells = calendarCells(view.year, view.month) as Array<Day & {outside: boolean}>;
  const closeCurrent = useRef(close); closeCurrent.current = close;
  useLayoutEffect(() => {
    const element = dialog.current!;
    element.showModal(); document.body.classList.add('date-picker-open'); entry.current?.focus(); entry.current?.select();
    const onClose = () => closeCurrent.current(); element.addEventListener('close', onClose);
    return () => {element.removeEventListener('close', onClose); if (element.open) element.close(); document.body.classList.remove('date-picker-open'); if (restoreFocus.current && source.isConnected) source.focus({preventScroll: true});};
  }, [source]);
  useLayoutEffect(() => {
    const place = () => {
      const element = dialog.current!;
      const viewport = window.visualViewport, width = viewport?.width || innerWidth, height = viewport?.height || innerHeight, left = viewport?.offsetLeft || 0, top = viewport?.offsetTop || 0;
      const field = source.getBoundingClientRect(), card = source.closest('.infobox')?.getBoundingClientRect();
      element.style.width = Math.min(354, width - 24) + 'px'; element.style.maxHeight = Math.max(120, height - 24) + 'px';
      const beside = card && card.left - 12 - element.offsetWidth >= left + 12;
      element.style.left = (beside ? card.left - 12 - element.offsetWidth : Math.max(left + 12, Math.min(field.right - element.offsetWidth, left + width - 12 - element.offsetWidth))) + 'px';
      const desiredTop = beside ? field.top - 16 : field.bottom + 9 + element.offsetHeight <= top + height - 12 ? field.bottom + 9 : field.top - element.offsetHeight - 9;
      element.style.top = Math.max(top + 12, Math.min(desiredTop, top + height - 12 - element.offsetHeight)) + 'px';
    };
    place(); const observer = new ResizeObserver(place); observer.observe(dialog.current!); window.addEventListener('scroll', place, {passive: true, capture: true}); window.addEventListener('resize', place); window.visualViewport?.addEventListener('resize', place); window.visualViewport?.addEventListener('scroll', place);
    return () => {observer.disconnect(); window.removeEventListener('scroll', place, true); window.removeEventListener('resize', place); window.visualViewport?.removeEventListener('resize', place); window.visualViewport?.removeEventListener('scroll', place);};
  }, [source]);
  useLayoutEffect(() => {if (focusDay.current) {grid.current?.querySelector<HTMLButtonElement>('button[tabindex="0"]')?.focus(); focusDay.current = false;}}, [focused, mode, view]);

  const apply = (text = draft.trim(), save = false) => {
    if (needsSelection || !entry.current?.reportValidity()) return;
    commit(text); restoreFocus.current = !save; close();
    if (save) {dialog.current?.close(); source.focus({preventScroll: true}); requestSave();}
  };
  const saveCurrent = useRef(() => {}); saveCurrent.current = () => apply(draft.trim(), true);
  useEffect(() => {const shortcut = (event: globalThis.KeyboardEvent) => {if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {event.preventDefault(); event.stopImmediatePropagation(); saveCurrent.current();}}; document.addEventListener('keydown', shortcut, true); return () => document.removeEventListener('keydown', shortcut, true);}, []);
  function updateView(next: Day) {setView(next); setFocused(next); setYearText(String(next.year <= 0 ? 1 - next.year : next.year)); setEra(next.year <= 0 ? 'BCE' : 'CE');}
  function readYear() {
    const number = Number(yearText), limit = era === 'BCE' ? 1000000 : 999999;
    if (!yearText || !Number.isInteger(number) || number < 1 || number > limit) {setError('Enter a year from 1 to ' + limit + '.'); return null;}
    setError(''); return era === 'BCE' ? 1 - number : number;
  }
  function changeMode(next: Precision) {const year = readYear(); if (year === null) return; updateView({...view, year}); setMode(next); setNeedsSelection(parsed?.precision !== next);}
  function choose(parts: Partial<Day> & {quarter?: number; half?: number}) {
    const year = readYear(); if (year === null) return;
    try {const text = formatStoryDate({year, month: view.month, day: view.day, quarter: undefined, half: undefined, ...parts, precision: mode, approximate}); commit(text); close();} catch (error) {setError(error instanceof Error ? error.message : 'Choose a valid date.');}
  }
  function navigate(direction: number) {const year = readYear(); if (year === null) return; const next = mode === 'day' ? {...view, ...shiftMonth(year, view.month, direction)} : {...view, year: year + direction * (mode === 'year' ? 12 : 1)}; next.year = Math.max(minYear, Math.min(maxYear, next.year)); updateView({...next, day: 1});}
  function dayKey(event: KeyboardEvent<HTMLButtonElement>, day: Day) {
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    const deltas: Record<string, number> = {ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7, Home: -weekday(day.year, day.month, day.day), End: 6 - weekday(day.year, day.month, day.day)};
    let next = {...day};
    if (event.key in deltas) {next.day += deltas[event.key]; if (next.day < 1) {const previous = shiftMonth(next.year, next.month, -1); next = {...previous, day: daysInMonth(previous.year, previous.month) + next.day};} else if (next.day > daysInMonth(next.year, next.month)) {const nextDay = next.day - daysInMonth(next.year, next.month); next = {...shiftMonth(next.year, next.month, 1), day: nextDay};}}
    else if (event.key === 'PageUp' || event.key === 'PageDown') {next = {...next, ...shiftMonth(next.year, next.month, (event.key === 'PageUp' ? -1 : 1) * (event.shiftKey ? 12 : 1))}; next.day = Math.min(next.day, daysInMonth(next.year, next.month));}
    else return;
    event.preventDefault(); if (next.year < minYear || next.year > maxYear) return; focusDay.current = true; updateView(next);
  }
  const periods = mode === 'month' ? months.map((label: string, index: number) => ({label, month: index + 1})) : mode === 'quarter' ? Array.from({length: 4}, (_, index) => ({label: 'Q' + (index + 1), quarter: index + 1})) : mode === 'half-year' ? [{label: 'First half', half: 1}, {label: 'Second half', half: 2}] : Array.from({length: 12}, (_, index) => ({label: yearLabel(Math.floor(view.year / 12) * 12 + index), year: Math.floor(view.year / 12) * 12 + index}));
  const note = needsSelection ? 'Choose a ' + precisionNames[mode].toLowerCase() + ' above, or enter a date.' : draft.trim() && !parsed ? 'This custom date will be saved as entered and remain unplaced on the timeline. Enter any approximation in the text.' : 'Choose a date or enter your own. Save changes on the profile to keep it.';
  return <dialog ref={dialog} id="profile-date-picker" className="date-dialog" aria-labelledby="date-picker-title" onCancel={event => {event.preventDefault(); close();}} onClick={event => {const rect = event.currentTarget.getBoundingClientRect(); if (event.target === event.currentTarget && (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom)) close();}}>
    <div className="date-picker-heading"><h2 id="date-picker-title">Origin / creation</h2><button type="button" className="date-dismiss" aria-label="Cancel date selection" onClick={close}>×</button></div>
    <div className="date-entry"><input ref={entry} type="text" maxLength={10000} placeholder="YYYY-MM-DD or a story date" aria-label="Selected date" aria-describedby="date-picker-note" value={draft} onChange={event => {const text = event.target.value, date = parseStoryDate(text); setDraft(text); setNeedsSelection(false); setApproximate(date?.approximate || false); if (date) {setMode(date.precision as Precision); updateView(initialDay(text));}}} onKeyDown={event => {if (event.key === 'Enter') {event.preventDefault(); apply();}}}/><button type="button" className="date-clear" aria-label="Clear date" onClick={() => {commit(''); close();}}>×</button></div>
    <div className="date-tabs" role="tablist" aria-label="Date precision" onKeyDown={event => {const index = modes.indexOf(mode), next = event.key === 'ArrowRight' ? (index + 1) % modes.length : event.key === 'ArrowLeft' ? (index + modes.length - 1) % modes.length : event.key === 'Home' ? 0 : event.key === 'End' ? modes.length - 1 : -1; if (next >= 0) {event.preventDefault(); changeMode(modes[next]); document.getElementById('date-tab-' + modes[next])?.focus();}}}>{modes.map(key => <button key={key} type="button" id={'date-tab-' + key} role="tab" aria-selected={mode === key} aria-controls="date-picker-panel" tabIndex={mode === key ? 0 : -1} onClick={() => changeMode(key)}>{precisionNames[key]}</button>)}</div>
    <div className="date-picker-panel" id="date-picker-panel" role="tabpanel" aria-labelledby={'date-tab-' + mode}>
      <div className="date-navigation"><button type="button" className="date-arrow" aria-label={mode === 'day' ? 'Previous month' : mode === 'year' ? 'Previous 12 years' : 'Previous year'} disabled={view.year <= minYear && (mode !== 'day' || view.month === 1)} onClick={() => navigate(-1)}>‹</button>
        <select aria-label="Calendar month" hidden={mode !== 'day'} value={view.month} onChange={event => {const year = readYear(); if (year !== null) updateView({year, month: Number(event.target.value), day: 1});}}>{months.map((name: string, index: number) => <option key={name} value={index + 1}>{name}</option>)}</select>
        <input aria-label="Calendar year" type="number" min="1" max={era === 'BCE' ? 1000000 : 999999} step="1" value={yearText} onChange={event => {const text = event.target.value; setYearText(text); const number = Number(text); if (text && Number.isInteger(number) && number >= 1 && number <= (era === 'BCE' ? 1000000 : 999999)) {setView(previous => ({...previous, year: era === 'BCE' ? 1 - number : number})); setError('');}}} onBlur={readYear}/>
        <select aria-label="Calendar era" value={era} onChange={event => {const next = event.target.value; setEra(next); const number = Number(yearText); if (number >= 1 && number <= (next === 'BCE' ? 1000000 : 999999)) setView(previous => ({...previous, year: next === 'BCE' ? 1 - number : number}));}}><option>CE</option><option>BCE</option></select>
        <button type="button" className="date-arrow" aria-label={mode === 'day' ? 'Next month' : mode === 'year' ? 'Next 12 years' : 'Next year'} disabled={view.year >= maxYear && (mode !== 'day' || view.month === 12)} onClick={() => navigate(1)}>›</button></div>
      <p className="date-error" role="alert" hidden={!error}>{error}</p>
      <div ref={grid} className={'date-picker-grid ' + (mode === 'day' ? 'date-days' : 'date-periods')} role={mode === 'day' ? 'grid' : undefined} aria-label={mode === 'day' ? months[view.month - 1] + ' ' + yearLabel(view.year) : precisionNames[mode] + ' choices'}>
        {mode === 'day' ? <><div className="date-week" role="row">{['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map(day => <span key={day} role="columnheader" aria-label={day}>{day.slice(0, 2)}</span>)}</div>{Array.from({length: 6}, (_, week) => <div className="date-week" role="row" key={week}>{cells.slice(week * 7, week * 7 + 7).map(day => {const selected = parsed?.precision === 'day' && parsed.year === day.year && parsed.month === day.month && parsed.day === day.day; const canFocus = sameDay(day, focused) || !cells.some(cell => sameDay(cell, focused)) && day.day === 1 && !day.outside; return <div key={`${day.year}-${day.month}-${day.day}`} role="gridcell" aria-selected={selected}><button type="button" aria-label={`${months[day.month - 1]} ${day.day}, ${yearLabel(day.year)}`} className={(day.outside ? 'outside ' : '') + (selected ? 'selected' : '')} tabIndex={canFocus ? 0 : -1} disabled={day.year < minYear || day.year > maxYear} onFocus={() => setFocused(day)} onKeyDown={event => dayKey(event, day)} onClick={() => choose(day)}>{day.day}</button></div>;})}</div>)}</> : periods.map(period => {const parts: Partial<Day> & {quarter?: number; half?: number} = period; const year = parts.year ?? view.year; const selected = parsed?.precision === mode && parsed.year === year && (mode === 'year' || mode === 'month' && parsed.month === parts.month || mode === 'quarter' && parsed.quarter === parts.quarter || mode === 'half-year' && parsed.half === parts.half); return <button key={period.label} type="button" disabled={year < minYear || year > maxYear} aria-pressed={selected} className={selected ? 'selected' : ''} onClick={() => choose(parts)}>{period.label}</button>;})}
      </div>
    </div>
    <div className="date-options"><label><input type="checkbox" checked={approximate} disabled={Boolean(draft.trim() && !parsed)} onChange={event => {setApproximate(event.target.checked); if (parsed) setDraft(formatStoryDate({...parsed, approximate: event.target.checked}));}}/> Approximate</label></div>
    <p className="date-note" id="date-picker-note">{note}</p><div className="date-picker-footer"><button type="button" onClick={close}>Cancel</button><button type="button" className="date-apply" disabled={needsSelection} onClick={() => apply()}>Use date</button></div>
  </dialog>;
}
