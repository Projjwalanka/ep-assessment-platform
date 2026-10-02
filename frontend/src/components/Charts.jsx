import {
  Bar, BarChart, CartesianGrid, Cell, ComposedChart, Legend, Line, Pie, PieChart, PolarAngleAxis, PolarGrid,
  PolarRadiusAxis, Radar, RadarChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { scoreColor } from '../format';

export const CHART = ['#1F6F6B', '#C68A2E', '#4E6E9E', '#7FA58A', '#B4432F', '#7A5C8E'];
export const REC_COLORS = { 'Strongly recommend': '#2F7D4F', Recommend: '#1F6F6B', 'Consider for next round': '#C68A2E', 'Not recommended': '#B4432F' };
const axis = { fontSize: 12, fill: '#5D6B6A' };
const tip = { contentStyle: { borderRadius: 8, border: '1px solid #DCE2DE', fontSize: 13 }, cursor: { fill: 'rgba(31,111,107,0.06)' } };

/** Semicircle gauge with the band bar marked on the arc. The report's signature element. */
export function Gauge({ value = 0, bar, label = 'Recommendation score', size = 210 }) {
  const v = Math.max(0, Math.min(100, value || 0));
  const r = 80, cx = 100, cy = 96, sw = 16;
  const pt = (p) => {
    const a = Math.PI * (1 - p / 100);
    return [cx + r * Math.cos(a), cy - r * Math.sin(a)];
  };
  const arc = (from, to) => {
    const [x1, y1] = pt(from), [x2, y2] = pt(to);
    return `M ${x1} ${y1} A ${r} ${r} 0 0 1 ${x2} ${y2}`;
  };
  const color = scoreColor(v);
  const barPt = bar != null ? pt(bar) : null;
  const barIn = bar != null ? [cx + (r - 14) * Math.cos(Math.PI * (1 - bar / 100)), cy - (r - 14) * Math.sin(Math.PI * (1 - bar / 100))] : null;
  const barOut = bar != null ? [cx + (r + 14) * Math.cos(Math.PI * (1 - bar / 100)), cy - (r + 14) * Math.sin(Math.PI * (1 - bar / 100))] : null;
  return (
    <svg width={size} height={size * 0.7} viewBox="0 -16 200 140" role="img" aria-label={`${label}: ${Math.round(v)} out of 100`}>
      <path d={arc(0, 49.9)} stroke="#F7E6E2" strokeWidth={sw} fill="none" />
      <path d={arc(50, 64.9)} stroke="#F8EEDC" strokeWidth={sw} fill="none" />
      <path d={arc(65, 79.9)} stroke="#E3EFEC" strokeWidth={sw} fill="none" />
      <path d={arc(80, 100)} stroke="#E4F1E8" strokeWidth={sw} fill="none" />
      {v > 0 && <path d={arc(0, v)} stroke={color} strokeWidth={sw} fill="none" strokeLinecap="butt" style={{ transition: 'all .6s' }} />}
      {barPt && (
        <g>
          <line x1={barIn[0]} y1={barIn[1]} x2={barOut[0]} y2={barOut[1]} stroke="#102A2B" strokeWidth="2.5" />
          <text x={barOut[0]} y={barOut[1] - 5} fontSize="9.5" textAnchor={bar > 55 ? 'start' : bar < 45 ? 'end' : 'middle'} fill="#102A2B">bar {bar}</text>
        </g>
      )}
      <text x={cx} y={cy - 8} textAnchor="middle" fontSize="38" fontWeight="600" fill="#1C2626" style={{ fontVariantNumeric: 'tabular-nums' }}>{Math.round(v)}</text>
      <text x={cx} y={cy + 14} textAnchor="middle" fontSize="10.5" fill="#5D6B6A">{label}</text>
    </svg>
  );
}

export function TopicRadar({ data, height = 300 }) {
  if (!data?.length) return null;
  const rows = data.map((t) => ({ topic: t.topic, score: t.percent }));
  if (rows.length < 3) return <TopicBars data={data} />;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <RadarChart data={rows} outerRadius="72%">
        <PolarGrid stroke="#DCE2DE" />
        <PolarAngleAxis dataKey="topic" tick={{ fontSize: 11, fill: '#5D6B6A' }} />
        <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
        <Radar dataKey="score" stroke="#1F6F6B" fill="#1F6F6B" fillOpacity={0.22} strokeWidth={2} />
        <Tooltip {...tip} formatter={(v) => [`${v}%`, 'Score']} />
      </RadarChart>
    </ResponsiveContainer>
  );
}

export function TopicBars({ data, height }) {
  const rows = [...(data || [])].sort((a, b) => b.percent - a.percent);
  return (
    <ResponsiveContainer width="100%" height={height || Math.max(160, rows.length * 30 + 30)}>
      <BarChart data={rows} layout="vertical" margin={{ left: 8, right: 24 }}>
        <CartesianGrid horizontal={false} stroke="#EEF1EF" />
        <XAxis type="number" domain={[0, 100]} tick={axis} unit="%" />
        <YAxis type="category" dataKey="topic" width={130} tick={axis} />
        <Tooltip {...tip} formatter={(v) => [`${v}%`, 'Score']} />
        <Bar dataKey="percent" radius={[0, 4, 4, 0]} barSize={14}>
          {rows.map((r) => <Cell key={r.topic} fill={scoreColor(r.percent)} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export function Donut({ data, nameKey = 'label', valueKey = 'count', colors, height = 220, center }) {
  const rows = (data || []).filter((d) => d[valueKey] > 0);
  const total = rows.reduce((s, d) => s + d[valueKey], 0);
  if (!total) return <div className="empty small" style={{ padding: 30 }}>No data yet</div>;
  return (
    <div style={{ position: 'relative' }}>
      <ResponsiveContainer width="100%" height={height}>
        <PieChart>
          <Pie data={rows} dataKey={valueKey} nameKey={nameKey} innerRadius="58%" outerRadius="85%" paddingAngle={2} stroke="none">
            {rows.map((d, i) => <Cell key={d[nameKey]} fill={colors?.[d[nameKey]] || CHART[i % CHART.length]} />)}
          </Pie>
          <Tooltip {...tip} />
          <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
        </PieChart>
      </ResponsiveContainer>
      <div style={{ position: 'absolute', left: 0, right: 0, top: height / 2 - 30, textAlign: 'center', pointerEvents: 'none' }}>
        <div style={{ fontSize: 24, fontWeight: 600 }}>{center ?? total}</div>
      </div>
    </div>
  );
}

export function TrendChart({ data, height = 240 }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={data} margin={{ left: -10, right: 8 }}>
        <CartesianGrid vertical={false} stroke="#EEF1EF" />
        <XAxis dataKey="week" tick={axis} interval={1} />
        <YAxis yAxisId="l" allowDecimals={false} tick={axis} />
        <YAxis yAxisId="r" orientation="right" domain={[0, 100]} tick={axis} unit="%" />
        <Tooltip {...tip} />
        <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
        <Bar yAxisId="l" dataKey="exams" name="Assessments submitted" fill="#CFE0DC" radius={[4, 4, 0, 0]} barSize={18} />
        <Line yAxisId="r" dataKey="avgScore" name="Average score" stroke="#C68A2E" strokeWidth={2.5} dot={{ r: 3 }} connectNulls />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

export function SimpleBars({ data, x, y, name, height = 220, color = '#1F6F6B', unit, refLine }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ left: -10, right: 8 }}>
        <CartesianGrid vertical={false} stroke="#EEF1EF" />
        <XAxis dataKey={x} tick={axis} />
        <YAxis tick={axis} allowDecimals={false} unit={unit} />
        <Tooltip {...tip} />
        {refLine}
        <Bar dataKey={y} name={name} fill={color} radius={[4, 4, 0, 0]} barSize={26} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function BandPerformance({ data, height = 230 }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={data} margin={{ left: -10, right: 8 }}>
        <CartesianGrid vertical={false} stroke="#EEF1EF" />
        <XAxis dataKey="band" tick={axis} tickFormatter={(b) => `${b} yrs`} />
        <YAxis domain={[0, 100]} tick={axis} unit="%" />
        <Tooltip {...tip} />
        <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
        <Bar dataKey="avgScore" name="Average score" fill="#1F6F6B" radius={[4, 4, 0, 0]} barSize={30} />
        <Line dataKey="bar" name="Expected bar" stroke="#102A2B" strokeDasharray="5 4" strokeWidth={2} dot={{ r: 3 }} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

export function CandidateScores({ data, height }) {
  const rows = (data || []).map((d) => ({ ...d, short: d.name?.split(' ')[0] }));
  return (
    <ResponsiveContainer width="100%" height={height || Math.max(180, rows.length * 34 + 40)}>
      <BarChart data={rows} layout="vertical" margin={{ left: 8, right: 24 }}>
        <CartesianGrid horizontal={false} stroke="#EEF1EF" />
        <XAxis type="number" domain={[0, 100]} tick={axis} />
        <YAxis type="category" dataKey="name" width={120} tick={axis} />
        <Tooltip {...tip} />
        <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
        <ReferenceLine x={65} stroke="#102A2B" strokeDasharray="4 4" />
        <Bar dataKey="mcq" name="MCQ %" fill="#4E6E9E" barSize={8} radius={[0, 3, 3, 0]} />
        <Bar dataKey="coding" name="Hands-on %" fill="#C68A2E" barSize={8} radius={[0, 3, 3, 0]} />
        <Bar dataKey="recommendationScore" name="Recommendation" fill="#1F6F6B" barSize={8} radius={[0, 3, 3, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Tiny stacked bar showing easy/medium/hard mix. */
export const MixBar = ({ mix = {} }) => {
  const total = (mix.EASY || 0) + (mix.MEDIUM || 0) + (mix.HARD || 0);
  if (!total) return <div className="mix" />;
  return (
    <div className="mix" title={`Easy ${mix.EASY || 0}, medium ${mix.MEDIUM || 0}, hard ${mix.HARD || 0}`}>
      <span style={{ width: `${(100 * (mix.EASY || 0)) / total}%`, background: '#7FA58A' }} />
      <span style={{ width: `${(100 * (mix.MEDIUM || 0)) / total}%`, background: '#4E6E9E' }} />
      <span style={{ width: `${(100 * (mix.HARD || 0)) / total}%`, background: '#B4432F' }} />
    </div>
  );
};
