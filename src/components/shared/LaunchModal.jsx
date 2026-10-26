// src/components/shared/LaunchModal.jsx
// Ventana "Revisar antes de iniciar": cabecera, pestañas opcionales, contenido con scroll y
// pie con ← Editar, 🔀 Re-sortear (opcional) e Iniciar. El contenido lo aporta cada formato.

export function SummaryRow({ label, value, yellow }) {
  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-xs text-gray-500">{label}</span>
      <span className={`text-xs font-bold ${yellow ? "text-yellow-400" : "text-gray-200"}`}>{value}</span>
    </div>
  );
}

export function SummaryCard({ title, children }) {
  return (
    <div className="bg-[#1f2937] border border-gray-700 rounded-xl overflow-hidden">
      <div className="px-4 py-2.5 border-b border-gray-800">
        <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">{title}</span>
      </div>
      <div className="px-4 py-3 space-y-1">{children}</div>
    </div>
  );
}

export default function LaunchModal({ color, tabs, activeTab, onTab, onClose, onReshuffle, onStart, saving, children }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex flex-col">
      <div className="flex-1 flex flex-col max-w-lg mx-auto w-full bg-[#111827] overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-4 border-b border-gray-800 shrink-0">
          <h2 className="text-sm font-black text-gray-50">Revisar antes de iniciar</h2>
          <button onClick={onClose} style={{ background: "none", border: "none", padding: "0 4px", cursor: "pointer" }} className="text-gray-500 hover:text-gray-200 text-lg leading-none transition-colors">✕</button>
        </div>

        {/* Tabs — solo si el formato tiene más de una vista */}
        {tabs && (
          <div className="flex shrink-0" style={{ borderBottom: "1px solid #1f2937" }}>
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => onTab(tab.id)}
                className="flex-1 py-3 text-xs font-bold transition-colors cursor-pointer"
                style={{
                  background: "none",
                  borderTop: "none", borderLeft: "none", borderRight: "none",
                  borderBottom: activeTab === tab.id ? `2px solid ${color}` : "2px solid transparent",
                  color: activeTab === tab.id ? color : "#64748b",
                }}
              >{tab.label}</button>
            ))}
          </div>
        )}

        {/* Contenido scrollable */}
        <div className="flex-1 overflow-y-auto">
          {children}
        </div>

        {/* Footer */}
        <div className="px-4 pt-3 pb-5 border-t border-gray-800 shrink-0">
          <p className="text-xs text-gray-600 text-center mb-3">Una vez guardado el primer resultado no podrás modificar la configuración.</p>
          <div className="flex gap-2">
            <button onClick={onClose} className="flex-1 py-3 rounded-xl font-bold text-sm text-gray-400 cursor-pointer transition-colors" style={{ background: "#1f2937", border: "1px solid #374151" }}>
              ← Editar
            </button>
            {onReshuffle && (
              <button onClick={onReshuffle} className="px-4 py-3 rounded-xl font-bold text-sm text-gray-300 cursor-pointer transition-colors whitespace-nowrap" style={{ background: "#1f2937", border: "1px solid #374151" }}>
                🔀 Re-sortear
              </button>
            )}
            <button
              data-testid="btn-iniciar"
              onClick={onStart}
              disabled={saving}
              className="flex-1 py-3 rounded-xl font-black text-sm text-white transition-opacity"
              style={{ background: color, cursor: saving ? "not-allowed" : "pointer", opacity: saving ? 0.6 : 1 }}
            >
              {saving ? "Guardando..." : "🎾 Iniciar"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
