// src/components/shared/Components.jsx
import { TOURNAMENT_TYPES } from '../../logic/constants';

export function THeader({ t, code, isAdmin, copyCode, subtitle, onEdit }) {
  const typeInfo = TOURNAMENT_TYPES.find((x) => x.id === t.type) || TOURNAMENT_TYPES[0];
  return (
    <div
      className="px-4 py-3.5 flex items-start justify-between relative overflow-hidden"
      style={{
        background: `linear-gradient(135deg, ${typeInfo.color}2e 0%, ${typeInfo.color}0a 40%, #0f172a 80%)`,
        borderBottom: `1px solid ${typeInfo.color}26`,
      }}
    >
      {/* Glow blob ambiental */}
      <div
        style={{
          position: 'absolute',
          top: -30,
          left: -20,
          width: 140,
          height: 100,
          borderRadius: '50%',
          background: typeInfo.color,
          filter: 'blur(25px)',
          opacity: 0.35,
          pointerEvents: 'none',
        }}
      />

      <div className="relative z-10">
        {/* Etiqueta del formato */}
        <div
          className="text-[10px] font-bold tracking-[1.5px] uppercase mb-1.5 opacity-70"
          style={{ color: typeInfo.color }}
        >
          {typeInfo.icon} {typeInfo.name}
        </div>

        {/* Nombre del torneo */}
        <div className="text-[20px] font-black text-[#f1f5f9] tracking-[-0.5px] leading-tight">
          {t.config.name}
        </div>

        <div className="text-xs text-[#4a5568] mt-0.5 font-medium">{subtitle}</div>

        {onEdit && (
          <button
            onClick={onEdit}
            className="text-xs text-[#4a5568] hover:text-[#f1f5f9] bg-transparent border-0 cursor-pointer underline p-0 mt-1 transition-colors"
          >
            ✏️ Editar torneo
          </button>
        )}
      </div>

      <div className="flex gap-1.5 items-center flex-shrink-0 ml-3 relative z-10 mt-0.5">
        {isAdmin && (
          <span className="bg-[#f59e0b]/10 text-[#fbbf24] border border-[#f59e0b]/25 rounded-full px-2 py-0.5 text-[10px] font-bold whitespace-nowrap">
            👑 Admin
          </span>
        )}
        <button
          onClick={copyCode}
          className="flex items-center gap-1.5 bg-white/5 border border-white/[0.09] text-[#64748b] rounded-lg px-2.5 py-1.5 cursor-pointer hover:text-[#f1f5f9] transition-colors whitespace-nowrap"
        >
          <span className="text-[11px]">🔗</span>
          <span className="font-data text-[11px] font-bold tracking-[1px]">{code}</span>
        </button>
      </div>
    </div>
  );
}

export function Tabs({ tabs, active, setActive }) {
  return (
    <div className="flex border-b border-white/5 bg-black/20">
      {tabs.map(([tb, lbl]) => {
        const [icon, ...rest] = lbl.split(' ');
        const label = rest.join(' ');
        return (
          <button
            key={tb}
            onClick={() => setActive(tb)}
            className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-2.5 cursor-pointer bg-transparent border-0 border-b-2 transition-colors ${
              active === tb
                ? 'text-[#f1f5f9] font-bold border-[#84cc16]'
                : 'text-[#334155] font-semibold border-transparent'
            }`}
          >
            <span className="text-[15px] leading-none">{icon}</span>
            <span className="text-[9px] font-bold tracking-[0.3px]">{label}</span>
          </button>
        );
      })}
    </div>
  );
}

export function PTag({ p }) {
  if (!p || p.level === undefined) return null;
  const isLevel1 = p.level === 1;
  return (
    <span
      className={`inline-block text-[10px] rounded-full px-1.5 py-px ml-1 border ${
        isLevel1
          ? 'bg-[#0284c7]/10 text-[#38bdf8] border-[#0284c7]/30'
          : 'bg-[#16a34a]/10 text-[#4ade80] border-[#16a34a]/30'
      }`}
    >
      N{p.level}
    </span>
  );
}

export function PName({ pair }) {
  return (
    <>
      {pair.map((p, i) => (
        <span key={p.id}>
          {i > 0 && <span className="text-[#94a3b8]"> & </span>}
          {p.name}
          <PTag p={p} />
        </span>
      ))}
    </>
  );
}

export function PairName({ pair, showNames = true }) {
  if (!pair) return <span className="text-[#64748b]">TBD</span>;
  return (
    <span className="font-bold text-[#fbbf24]">
      {showNames ? `${pair.p1} / ${pair.p2}` : `Par ${pair.id + 1}`}
    </span>
  );
}

export function SimpleModal({ message, onClose, onConfirm, confirmLabel, icon }) {
  return (
    <div className="fixed inset-0 z-[9999] bg-black/60 flex items-center justify-center p-6">
      <div className="bg-[#1e293b] border border-[#334155] rounded-2xl p-7 max-w-xs w-full text-center shadow-2xl">
        {icon && <div className="text-3xl mb-3">{icon}</div>}
        <div className="text-sm font-semibold text-[#f1f5f9] mb-5 leading-relaxed">{message}</div>
        <div className="flex gap-2.5 justify-center">
          {onConfirm && (
            <button
              onClick={onClose}
              className="flex-1 bg-[#334155] text-[#94a3b8] rounded-xl py-2.5 font-bold text-sm cursor-pointer border-0"
            >
              Cancelar
            </button>
          )}
          <button
            onClick={onConfirm || onClose}
            className={`flex-1 rounded-xl py-2.5 font-bold text-sm cursor-pointer ${
              onConfirm
                ? 'bg-[#ef4444]/10 text-[#ef4444] border border-[#ef4444]/20'
                : 'bg-[#0284c7]/10 text-[#38bdf8] border border-[#0284c7]/20'
            }`}
          >
            {onConfirm ? (confirmLabel || 'Eliminar') : 'Aceptar'}
          </button>
        </div>
      </div>
    </div>
  );
}
