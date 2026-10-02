import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AlertCircle, CheckCircle2, Inbox, X } from 'lucide-react';
import { DECISION, REC_TONE, STATUS, diffLabel, scoreColor } from './format';

export const Button = ({ variant, size, className = '', icon: Icon, children, busy, ...rest }) => (
  <button className={`btn ${variant || ''} ${size || ''} ${className}`} disabled={busy || rest.disabled} {...rest}>
    {busy ? <span className="spinner" style={{ width: 14, height: 14 }} /> : Icon ? <Icon size={16} /> : null}
    {children}
  </button>
);

export const Panel = ({ title, subtitle, actions, children, pad = true, className = '' }) => (
  <section className={`panel ${className}`}>
    {(title || actions) && (
      <div className="panel-head">
        <div>
          {title && <h3>{title}</h3>}
          {subtitle && <p>{subtitle}</p>}
        </div>
        {actions && <div className="row">{actions}</div>}
      </div>
    )}
    <div className={pad ? 'panel-body' : ''}>{children}</div>
  </section>
);

export const PageHead = ({ title, subtitle, actions }) => (
  <div className="page-head">
    <div>
      <h1>{title}</h1>
      {subtitle && <p>{subtitle}</p>}
    </div>
    {actions && <div className="row">{actions}</div>}
  </div>
);

export const Field = ({ label, hint, children, className = '' }) => (
  <label className={`field ${className}`}>
    <span>{label} {hint && <em className="hint" style={{ fontStyle: 'normal' }}>{hint}</em>}</span>
    {children}
  </label>
);

export const Switch = ({ checked, onChange, label, disabled }) => (
  <label className="row" style={{ cursor: disabled ? 'not-allowed' : 'pointer', gap: 12 }}>
    <span className="switch">
      <input type="checkbox" checked={!!checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
      <span />
    </span>
    {label}
  </label>
);

export const Segmented = ({ options, value, onChange, disabled }) => (
  <div className="seg" role="radiogroup">
    {options.map((o) => {
      const v = typeof o === 'object' ? o.value : o;
      const l = typeof o === 'object' ? o.label : o;
      return (
        <button key={v} type="button" role="radio" aria-checked={value === v} className={value === v ? 'on' : ''}
          disabled={disabled || (typeof o === 'object' && o.disabled)} onClick={() => onChange(v)}>{l}</button>
      );
    })}
  </div>
);

export const Tabs = ({ tabs, value, onChange }) => (
  <div className="tabs" role="tablist">
    {tabs.map((t) => (
      <button key={t.value} role="tab" aria-selected={value === t.value} className={value === t.value ? 'on' : ''} onClick={() => onChange(t.value)}>
        {t.label}{t.count != null && <span className="badge" style={{ marginLeft: 8 }}>{t.count}</span>}
      </button>
    ))}
  </div>
);

export const Badge = ({ tone = '', children, title }) => <span className={`badge ${tone}`} title={title}>{children}</span>;
export const StatusBadge = ({ status }) => { const s = STATUS[status] || { label: status, tone: '' }; return <Badge tone={s.tone}>{s.label}</Badge>; };
export const DecisionBadge = ({ decision }) => { if (!decision) return null; const d = DECISION[decision] || { label: decision }; return <Badge tone={d.tone}>{d.label}</Badge>; };
export const RecBadge = ({ label }) => (label ? <Badge tone={REC_TONE[label]}>{label}</Badge> : <span className="muted">—</span>);
export const DiffBadge = ({ d }) => <span className={`badge diff-${d}`}>{diffLabel(d)}</span>;

export const ScoreBar = ({ value }) => (
  <div className="score-bar">
    <div className="track"><div className="fill" style={{ width: `${Math.max(0, Math.min(100, value ?? 0))}%`, background: scoreColor(value) }} /></div>
    <b>{value == null ? '—' : Math.round(value)}</b>
  </div>
);

export const Spinner = () => <span className="spinner" />;
export const Loading = ({ text = 'Loading…' }) => <div className="loading"><Spinner />{text}</div>;

export const Empty = ({ icon: Icon = Inbox, title, children, action }) => (
  <div className="empty">
    <Icon size={30} strokeWidth={1.5} />
    <h3>{title}</h3>
    {children && <p className="small">{children}</p>}
    {action && <div className="mt16">{action}</div>}
  </div>
);

export function Modal({ title, onClose, children, footer, size = '' }) {
  const ref = useRef(null);
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    document.addEventListener('keydown', onKey);
    ref.current?.querySelector('input, textarea, select, button:not(.icon-btn)')?.focus();
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose?.(); }}>
      <div className={`modal ${size}`} role="dialog" aria-modal="true" aria-label={title} ref={ref}>
        <div className="modal-head">
          <h2>{title}</h2>
          {onClose && <button className="icon-btn" onClick={onClose} aria-label="Close"><X size={18} /></button>}
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- toasts & confirm
const UiContext = createContext(null);

export function UiProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const [confirmState, setConfirmState] = useState(null);

  const toast = useCallback((message, type = 'ok') => {
    const id = Math.random();
    setToasts((t) => [...t, { id, message, type }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), type === 'error' ? 6000 : 3500);
  }, []);

  const confirm = useCallback((opts) => new Promise((resolve) => setConfirmState({ ...opts, resolve })), []);
  const close = (v) => { confirmState?.resolve(v); setConfirmState(null); };

  return (
    <UiContext.Provider value={{ toast, confirm }}>
      {children}
      <div className="toasts" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${t.type}`}>
            {t.type === 'error' ? <AlertCircle size={18} /> : <CheckCircle2 size={18} />}
            <span>{t.message}</span>
          </div>
        ))}
      </div>
      {confirmState && (
        <Modal title={confirmState.title || 'Are you sure?'} onClose={() => close(false)}
          footer={<>
            <Button onClick={() => close(false)}>{confirmState.cancelText || 'Cancel'}</Button>
            <Button variant={confirmState.danger ? 'solid-danger' : 'primary'} onClick={() => close(true)}>{confirmState.confirmText || 'Confirm'}</Button>
          </>}>
          <div style={{ whiteSpace: 'pre-wrap' }}>{confirmState.message}</div>
        </Modal>
      )}
    </UiContext.Provider>
  );
}

export const useUi = () => useContext(UiContext);

/** Loads data from an async function; returns [data, loading, error, reload, setData]. */
export function useLoad(fn, deps = []) {
  const [state, setState] = useState({ data: null, loading: true, error: null });
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let alive = true;
    setState((s) => ({ ...s, loading: true, error: null }));
    fn().then((data) => alive && setState({ data, loading: false, error: null }))
      .catch((error) => alive && setState({ data: null, loading: false, error }));
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick]);
  const reload = useCallback(() => setTick((t) => t + 1), []);
  const setData = useCallback((updater) => setState((s) => ({ ...s, data: typeof updater === 'function' ? updater(s.data) : updater })), []);
  return [state.data, state.loading, state.error, reload, setData];
}

export const ErrorNote = ({ error }) => (error ? <div className="notice fail"><AlertCircle size={18} /><span>{error.message}</span></div> : null);

export async function copyText(text, toast) {
  try { await navigator.clipboard.writeText(text); toast?.('Copied to clipboard'); }
  catch { toast?.('Copy failed. Select the text and copy it manually.', 'error'); }
}
