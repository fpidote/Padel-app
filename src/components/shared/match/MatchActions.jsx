// src/components/shared/match/MatchActions.jsx
// Acciones al cargar o corregir un resultado: Cancelar (solo al corregir) y Guardar, con Eliminar debajo.
export default function MatchActions({ isEditing, canSave, onSave, onCancel, onDelete, accentColor }) {
  return (
    <>
      <div className="flex gap-2 px-4 pb-4">
        {isEditing && (
          <button
            type="button"
            data-testid="btn-cancelar-edicion"
            onClick={onCancel}
            className="flex-1 py-3 rounded-xl text-[13px] font-bold bg-red-700 hover:bg-red-600 text-white cursor-pointer border-0 transition-colors"
          >
            ✕ Cancelar
          </button>
        )}
        <button
          type="button"
          onClick={onSave}
          disabled={!canSave}
          data-score-save=""
          className={`${isEditing ? "flex-1" : "w-full"} py-3 rounded-xl text-[13px] font-black border-0 cursor-pointer transition-all ${canSave ? "text-white" : "bg-white/[0.04] text-slate-600"}`}
          style={canSave ? { background: accentColor, boxShadow: `0 4px 16px ${accentColor}4d` } : undefined}
        >
          Guardar resultado
        </button>
      </div>
      {isEditing && onDelete && (
        <button
          type="button"
          onClick={onDelete}
          className="block mx-auto -mt-1 mb-4 text-xs font-semibold text-gray-400 hover:text-gray-200 bg-transparent border-0 cursor-pointer transition-colors"
        >
          🗑 Eliminar resultado
        </button>
      )}
    </>
  );
}
