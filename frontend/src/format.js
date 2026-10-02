export const BANDS = ['0-5', '6-10', '10-15', '15+'];
export const DIFFS = ['EASY', 'MEDIUM', 'HARD'];
export const bandLabel = (b) => (b ? `${b} yrs` : '—');
export const diffLabel = (d) => ({ EASY: 'Easy', MEDIUM: 'Medium', HARD: 'Hard' }[d] || d || '—');

export const STATUS = {
  ASSIGNED: { label: 'Not started', tone: '' },
  IN_PROGRESS: { label: 'In progress', tone: 'info' },
  SUBMITTED: { label: 'Awaiting review', tone: 'amber' },
  REVIEWED: { label: 'Reviewed', tone: 'accent' },
};
export const DECISION = {
  PROCEED: { label: 'Proceed', tone: 'pass' },
  HOLD: { label: 'On hold', tone: 'amber' },
  REJECT: { label: 'Rejected', tone: 'fail' },
};
export const REC_TONE = {
  'Strongly recommend': 'pass',
  Recommend: 'accent',
  'Consider for next round': 'amber',
  'Not recommended': 'fail',
};

export const scoreColor = (v) => {
  if (v == null) return 'var(--line-strong)';
  if (v >= 80) return 'var(--pass)';
  if (v >= 65) return 'var(--accent)';
  if (v >= 50) return 'var(--amber)';
  return 'var(--fail)';
};

export const pct = (v, d = 0) => (v == null ? '—' : `${Number(v).toFixed(d)}%`);

export const fmtDate = (s) => {
  if (!s) return '—';
  const d = new Date(s);
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
};
export const fmtDateTime = (s) => {
  if (!s) return '—';
  const d = new Date(s);
  return `${d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}, ${d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}`;
};
export const fmtDuration = (sec) => {
  if (sec == null) return '—';
  const m = Math.round(sec / 60);
  if (m < 60) return `${m} min`;
  return `${Math.floor(m / 60)} h ${m % 60} min`;
};
export const fmtClock = (sec) => {
  const s = Math.max(0, Math.floor(sec));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), r = s % 60;
  const mm = String(m).padStart(2, '0'), ss = String(r).padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
};
export const initials = (name = '') => name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0].toUpperCase()).join('') || '?';
export const letter = (i) => String.fromCharCode(65 + i);
