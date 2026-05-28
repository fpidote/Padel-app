// src/components/shared/Components.jsx
import { TOURNAMENT_TYPES, B } from '../../logic/constants';

export function THeader({ t, code, isAdmin, copyCode, subtitle }) {
  const typeInfo = TOURNAMENT_TYPES.find((x) => x.id === t.type) || TOURNAMENT_TYPES[0];
  return (
    <div style={{ background: "linear-gradient(135deg,#1e3a5f,#0f4c75)", padding: "14px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", boxShadow: "0 4px 12px rgba(0,0,0,.4)" }}>
      <div>
        <div style={{ fontSize: 18, fontWeight: 800, color: "#38bdf8" }}>
          {typeInfo.icon} {t.config.name}
        </div>
        <div style={{ fontSize: 11, color: "#94a3b8" }}>{subtitle}</div>
      </div>
      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
        {isAdmin && <span style={{ background: "#f59e0b22", color: "#fbbf24", border: "1px solid #f59e0b55", borderRadius: 99, padding: "3px 8px", fontSize: 11, fontWeight: 700 }}>👑 Admin</span>}
        <button onClick={copyCode} style={B("#1e293b", { border: "1px solid #334155", color: "#94a3b8", fontSize: 12 })}>🔗 {code}</button>
      </div>
    </div>
  );
}

export function Tabs({ tabs, active, setActive }) {
  return (
    <div style={{ display: "flex", borderBottom: "1px solid #1e293b" }}>
      {tabs.map(([tb, lbl]) => (
        <button key={tb} onClick={() => setActive(tb)} style={{ flex: 1, padding: "12px 0", background: "none", border: "none", borderBottom: `2px solid ${active === tb ? "#38bdf8" : "transparent"}`, color: active === tb ? "#38bdf8" : "#64748b", fontWeight: active === tb ? 700 : 500, fontSize: 13, cursor: "pointer" }}>
          {lbl}
        </button>
      ))}
    </div>
  );
}

export function PTag({ p }) {
  if (!p || p.level === undefined) return null;
  return (
    <span style={{ display: "inline-block", fontSize: 10, background: p.level === 1 ? "#0284c722" : "#16a34a22", color: p.level === 1 ? "#38bdf8" : "#4ade80", border: `1px solid ${p.level === 1 ? "#0284c755" : "#16a34a55"}`, borderRadius: 99, padding: "1px 5px", marginLeft: 3 }}>
      N{p.level}
    </span>
  );
}

export function PName({ pair }) {
  return (
    <>
      {pair.map((p, i) => (
        <span key={p.id}>
          {i > 0 && <span style={{ color: "#94a3b8" }}> & </span>}
          {p.name}
          <PTag p={p} />
        </span>
      ))}
    </>
  );
}

export function PairName({ pair, showNames = true }) {
  if (!pair) return <span style={{ color: "#64748b" }}>TBD</span>;
  return <span style={{ fontWeight: 700, color: "#fbbf24" }}>{showNames ? `${pair.p1} / ${pair.p2}` : `Par ${pair.id + 1}`}</span>;
}