// src/components/shared/match/MatchShell.jsx
// Superficie común de toda tarjeta de enfrentamiento: cabecera con el color del formato, etiqueta y estado.
export default function MatchShell({ label, accentColor, saved = false, locked = false, onEdit, children }) {
  return (
    <div className="bg-[#1f2937] rounded-2xl border border-[#374151] overflow-hidden mb-3">
      <div className="flex justify-between items-center gap-2 px-4 py-2.5 min-h-[46px] border-b border-white/5 bg-black/15">
        <span className="flex min-w-0 items-center gap-2 text-xs font-bold text-gray-500 uppercase tracking-widest">
          <span className="w-2 h-2 shrink-0 rounded-full" style={{ background: accentColor }} />
          <span className="truncate">{label}</span>
        </span>
        {saved && (
          <div className="flex shrink-0 items-center gap-2 whitespace-nowrap">
            <span className="text-xs text-green-400 font-semibold">✅ Guardado</span>
            {onEdit && (
              <button
                type="button"
                onClick={onEdit}
                className="text-xs font-semibold text-gray-400 hover:text-gray-200 bg-white/[0.06] hover:bg-white/10 px-2.5 py-1 rounded-lg cursor-pointer border-0 transition-colors"
              >
                ✏️ Editar
              </button>
            )}
            {locked && <span className="text-xs text-gray-500 font-semibold">🔒 Cerrado</span>}
          </div>
        )}
      </div>
      {children}
    </div>
  );
}
