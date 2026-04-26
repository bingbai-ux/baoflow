// Inline cell editor — wraps a cell value with click-to-edit behavior
// Auto-saves on blur or Enter; Esc cancels. Tab moves to next editable cell.

function InlineCell({ value, type, onSave, format, align, width, suffix, options }) {
  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState(value);
  const inputRef = React.useRef(null);

  React.useEffect(() => { if (editing && inputRef.current) { inputRef.current.focus(); inputRef.current.select && inputRef.current.select(); } }, [editing]);
  React.useEffect(() => { setDraft(value); }, [value]);

  const commit = () => {
    if (draft !== value) onSave && onSave(draft);
    setEditing(false);
  };
  const cancel = () => { setDraft(value); setEditing(false); };

  if (editing) {
    if (type === 'select') {
      return (
        <select ref={inputRef} value={draft} onChange={e => setDraft(e.target.value)} onBlur={commit} onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') cancel(); }}
                style={{ border:'1.5px solid #0a0a0a', borderRadius:4, padding:'2px 4px', fontSize:11, fontFamily:'inherit', background:'#fff', outline:'none', width:'100%' }}>
          {options.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
      );
    }
    return (
      <input ref={inputRef} type={type === 'date' ? 'date' : 'text'} value={draft}
             onChange={e => setDraft(type === 'number' ? e.target.value.replace(/[^\d.]/g, '') : e.target.value)}
             onBlur={commit} onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') cancel(); }}
             style={{ border:'1.5px solid #0a0a0a', borderRadius:4, padding:'2px 5px', fontSize:11, fontFamily: type === 'number' || type === 'date' ? "'Fraunces', serif" : 'inherit', fontVariantNumeric:'tabular-nums', background:'#fff', outline:'none', width:'100%', textAlign: align || 'left' }} />
    );
  }

  const display = format ? format(value) : (value !== null && value !== undefined && value !== '' ? value : '—');
  return (
    <span onClick={(e) => { e.stopPropagation(); setEditing(true); }}
          style={{ display:'inline-block', width:'100%', padding:'1px 3px', borderRadius:3, cursor:'text', textAlign: align || 'left', minHeight:18, color: (value === null || value === undefined || value === '') ? '#ccc' : 'inherit' }}
          onMouseEnter={e => { e.currentTarget.style.background='#fffbe6'; e.currentTarget.style.boxShadow='inset 0 0 0 1px #e5a32e44'; }}
          onMouseLeave={e => { e.currentTarget.style.background='transparent'; e.currentTarget.style.boxShadow='none'; }}>
      {display}{suffix}
    </span>
  );
}

window.InlineCell = InlineCell;
