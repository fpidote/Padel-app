// src/components/shared/Components.jsx
import { TOURNAMENT_TYPES } from '../../logic/constants';

export function THeader({ t, code, isAdmin, copyCode, subtitle, onEdit }) {
  const typeInfo = TOURNAMENT_TYPES.find((x) => x.id === t.type) || TOURNAMENT_TYPES[0];
  return (
    <div
      className="px-4 py-3.5 flex items-start justify-between"
      style={{
        background: `linear-gradient(135deg, ${typeInfo.color}22 0%, #0f172a 70%)`,
        borderBottom: `1px solid ${typeInfo.color}30`,
      }}
    >
      <div>
        <div className="text-lg font-black text-[#f1f5f9]">
          {typeInfo.icon} {t.config.name}
        </div>
        <div className="text-xs text-[#64748b] mt-0.5">{subtitle}</div>
        {onEdit && (
          <button
            onClick={onEdit}
            className="text-xs text-[#64748b] hover:text-[#f1f5f9] bg-transparent border-0 cursor-pointer underline p-0 mt-1 transition-colors"
          >
            ✏️ Editar torneo
          </button>
        )}
      </div>
      <div className="flex gap-1.5 items-center flex-shrink-0 ml-3">
        {isAdmin && (
          <span className="bg-[#f59e0b]/10 text-[#fbbf24] border border-[#f59e0b]/30 rounded-full px-2 py-0.5 text-[11px] font-bold whitespace-nowrap">
            👑 Admin
          </span>
        )}
        <button
          onClick={copyCode}
          className="bg-[#1e293b] border border-[#334155] text-[#94a3b8] rounded-lg px-2.5 py-1 text-xs font-semibold cursor-pointer hover:text-[#f1f5f9] transition-colors whitespace-nowrap"
        >
          🔗 {code}
        </button>
      </div>
    </div>
  );
}

export function Tabs({ tabs, active, setActive }) {
  return (
    <div className="flex border-b border-[#1e293b]">
      {tabs.map(([tb, lbl]) => (
        <button
          key={tb}
          onClick={() => setActive(tb)}
          className={`flex-1 py-3 text-sm cursor-pointer bg-transparent border-0 border-b-2 transition-colors ${
            active === tb
              ? 'text-[#f1f5f9] font-bold border-[#84cc16]'
              : 'text-[#64748b] font-semibold border-transparent'
          }`}
        >
          {lbl}
        </button>
      ))}
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
