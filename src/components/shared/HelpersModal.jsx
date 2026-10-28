// src/components/shared/HelpersModal.jsx
// Pantalla "Ayudantes" del dueño: añadir por correo de Google, ver la lista y quitar el acceso.
import { useState } from "react";
import { useHelpers } from "../../hooks/useHelpers";
import { normalizeEmail, MAX_HELPERS } from "../../logic/helpers";

export default function HelpersModal({ code, t, persist, onClose }) {
  const { helpers, loading, add, remove } = useHelpers(code, true);
  const [email, setEmail] = useState("");
  const [error, setError] = useState(null);
  const [confirming, setConfirming] = useState(false);
  const [saving, setSaving] = useState(false);

  async function onConfirm() {
    setSaving(true);
    const msg = await add(email);
    setSaving(false);
    setConfirming(false);
    if (msg) setError(msg);
    else {
      setEmail("");
      setError(null);
    }
  }

  // Permisos extra del ayudante (solo Americano): se guardan en el torneo y por defecto están desactivados
  const perms = t?.helperPerms || {};
  function togglePerm(key) {
    persist({ ...t, helperPerms: { ...perms, [key]: !perms[key] } });
  }

  return (
    <div className="fixed inset-0 z-[9999] bg-black/60 flex items-center justify-center p-4" onClick={onClose}>
      <div
        data-testid="modal-ayudantes"
        className="bg-[#1e293b] border border-[#334155] rounded-2xl p-5 max-w-sm w-full shadow-2xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-2">
          <h2 className="text-base font-black text-[#f1f5f9]">👥 Ayudantes</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-200 cursor-pointer bg-transparent border-0" aria-label="Cerrar">✕</button>
        </div>
        <p className="text-xs text-gray-400 mb-4 leading-relaxed">
          Un ayudante puede cargar y corregir resultados, pasar de ronda y finalizar el torneo. Entra desde el mismo
          enlace iniciando sesión con Google. Debe ser el correo con el que esa persona inicia sesión.
        </p>

        {t?.type === "americano" && (
          <div className="mb-4 space-y-2">
            <label className="flex items-center gap-2 text-xs text-gray-300 cursor-pointer">
              <input type="checkbox" data-testid="perm-niveles" checked={!!perms.levels} onChange={() => togglePerm("levels")} />
              Los ayudantes pueden ver los niveles de los jugadores
            </label>
            <label className="flex items-center gap-2 text-xs text-gray-300 cursor-pointer">
              <input type="checkbox" data-testid="perm-renombrar" checked={!!perms.rename} onChange={() => togglePerm("rename")} />
              Los ayudantes pueden renombrar jugadores
            </label>
          </div>
        )}

        {loading ? (
          <div className="text-xs text-gray-500 mb-4">Cargando…</div>
        ) : helpers.length === 0 ? (
          <div className="text-xs text-gray-500 mb-4">Todavía no hay ayudantes.</div>
        ) : (
          <ul className="mb-4 space-y-1.5">
            {helpers.map((h) => (
              <li key={h} data-testid="ayudante" className="flex items-center justify-between gap-2 bg-[#0f172a] rounded-lg px-3 py-2">
                <span className="text-sm text-gray-100 truncate">{h}</span>
                <button
                  onClick={() => remove(h)}
                  className="text-xs font-bold text-red-400 hover:text-red-300 cursor-pointer bg-transparent border-0 shrink-0"
                >
                  Quitar
                </button>
              </li>
            ))}
          </ul>
        )}

        {helpers.length < MAX_HELPERS && (
          confirming ? (
            <div className="bg-[#0f172a] rounded-xl p-3 text-center">
              <div className="text-xs text-gray-400 mb-1">¿Dar acceso de ayudante a este correo?</div>
              <div data-testid="correo-a-confirmar" className="text-sm font-bold text-[#f1f5f9] mb-3 break-all">{normalizeEmail(email)}</div>
              <div className="flex gap-2">
                <button
                  onClick={() => setConfirming(false)}
                  className="flex-1 bg-[#334155] text-[#94a3b8] rounded-xl py-2 font-bold text-sm cursor-pointer border-0"
                >
                  Cancelar
                </button>
                <button
                  data-testid="confirmar-ayudante"
                  onClick={onConfirm}
                  disabled={saving}
                  className="flex-1 bg-[#0284c7]/10 text-[#38bdf8] border border-[#0284c7]/20 rounded-xl py-2 font-bold text-sm cursor-pointer"
                >
                  Confirmar
                </button>
              </div>
            </div>
          ) : (
            <div>
              <input
                type="email"
                inputMode="email"
                autoComplete="off"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setError(null); }}
                onKeyDown={(e) => e.key === "Enter" && email.trim() && setConfirming(true)}
                placeholder="correo@gmail.com"
                className="w-full bg-[#0f172a] border border-[#334155] rounded-lg px-3 py-2 text-sm text-gray-50 outline-none focus:border-[#38bdf8] mb-2"
              />
              {error && <p data-testid="error-ayudante" className="text-xs font-semibold text-amber-400 mb-2">⚠️ {error}</p>}
              <button
                data-testid="agregar-ayudante"
                onClick={() => setConfirming(true)}
                disabled={!email.trim()}
                className="w-full py-2.5 rounded-xl font-bold text-sm cursor-pointer bg-[#0284c7]/10 text-[#38bdf8] border border-[#0284c7]/20 disabled:opacity-40"
              >
                + Agregar ayudante
              </button>
            </div>
          )
        )}
        {helpers.length >= MAX_HELPERS && (
          <p data-testid="error-ayudante" className="text-xs font-semibold text-amber-400">⚠️ Máximo {MAX_HELPERS} ayudantes por torneo</p>
        )}
      </div>
    </div>
  );
}
