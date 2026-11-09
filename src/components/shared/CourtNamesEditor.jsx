import { useState, useRef, useEffect } from "react";
import { COURT_NAME_MAX, normalizeCourtNames } from "../../logic/americano";
import { showToast } from "../../logic/toast";

// Un campo por pista para poner el nombre que usa el club ("Pista Pajarito", "la 7"...).
// Con `autoSave` (Setup) guarda solo, con debounce de 600 ms como el resto de campos de texto.
// Sin él (torneo en marcha) hay un botón "Guardar nombres" que manda lo escrito en ese momento: un
// guardado con retraso podría llevar un estado viejo y pisar marcadores cargados entretanto.
export default function CourtNamesEditor({ courts, courtNames, onSave, autoSave = false }) {
  const [open, setOpen] = useState(false);
  const [names, setNames] = useState(() => normalizeCourtNames(courtNames, courts));
  const [saving, setSaving] = useState(false);
  const deb = useRef(null);

  // Si cambia el número de pistas o llegan nombres de otra pantalla, y no estamos editando, se reajusta
  const savedKey = JSON.stringify(normalizeCourtNames(courtNames, courts));
  useEffect(() => {
    if (!open) setNames(normalizeCourtNames(courtNames, courts));
  }, [savedKey, courts, open]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => clearTimeout(deb.current), []);

  const dirty = JSON.stringify(normalizeCourtNames(names, courts)) !== savedKey;

  async function save(list) {
    setSaving(true);
    try {
      const ok = await onSave(normalizeCourtNames(list, courts));
      if (ok === false) showToast("No se pudieron guardar los nombres de las pistas. Inténtalo de nuevo.");
    } catch (err) {
      console.error("Error al guardar nombres de pista:", err);
      showToast("No se pudieron guardar los nombres de las pistas. Inténtalo de nuevo.");
    } finally {
      setSaving(false);
    }
  }

  function handleChange(i, val) {
    const next = names.map((n, idx) => (idx === i ? val : n));
    setNames(next);
    if (autoSave) {
      clearTimeout(deb.current);
      deb.current = setTimeout(() => save(next), 600);
    }
  }

  return (
    <div className="mt-3">
      <button
        type="button"
        data-testid="nombrar-pistas"
        onClick={() => setOpen((o) => !o)}
        className="text-xs font-semibold text-sky-400 cursor-pointer"
      >
        {open ? "▾ Nombres de las pistas" : "✏️ Nombrar pistas"}
      </button>
      {open && (
        <div className="mt-2 space-y-2">
          <p className="text-xs text-gray-500">Si en tu club se llaman distinto, escribe el nombre que verán los jugadores.</p>
          {names.map((n, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="w-14 shrink-0 text-xs font-bold text-gray-500">Pista {i + 1}</span>
              <input
                value={n}
                data-testid={`nombre-pista-${i + 1}`}
                maxLength={COURT_NAME_MAX}
                onChange={(e) => handleChange(i, e.target.value)}
                placeholder={`Pista ${i + 1}`}
                className="flex-1 min-w-0 text-sm bg-[#1f2937] border border-gray-700 rounded-lg px-3 py-2 outline-none text-gray-50 placeholder:text-gray-600 focus:border-sky-600"
              />
            </div>
          ))}
          {!autoSave && (
            <button
              type="button"
              data-testid="guardar-nombres-pistas"
              disabled={!dirty || saving}
              onClick={() => save(names)}
              className="w-full py-2.5 rounded-xl text-sm font-bold cursor-pointer bg-[#374151] text-gray-100 disabled:opacity-40 disabled:cursor-default"
            >
              {saving ? "Guardando…" : "Guardar nombres"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
