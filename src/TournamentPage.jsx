// src/TournamentPage.jsx
import { useState, lazy, Suspense } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useTournament } from "./hooks/useTournament";
import { TOURNAMENT_TYPES } from "./logic/constants";

const SetupAmericano = lazy(() => import('./components/setup/SetupAmericano'));
const SetupPairs = lazy(() => import('./components/setup/SetupPairs'));
const PlayAmericano = lazy(() => import('./components/play/PlayAmericano'));
const PlayRelampago = lazy(() => import('./components/play/PlayRelampago'));
const PlayMundialito = lazy(() => import('./components/play/PlayMundialito'));
const PlayPozo = lazy(() => import('./components/play/PlayPozo'));

export default function TournamentPage() {
  const { code } = useParams();
  const navigate = useNavigate();
  const { t, notFound, isAdmin, error, persist, copyCode } = useTournament(code);
  const [editMode, setEditMode] = useState(false);

  if (notFound)
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-6 px-6 text-center">
        <div className="text-5xl">🏸</div>
        <div className="bg-[#1e293b] border border-[#334155] rounded-2xl px-8 py-8 max-w-sm w-full flex flex-col items-center gap-4">
          <h2 className="text-lg font-black text-gray-50">Torneo no encontrado</h2>
          <p className="text-sm text-gray-400 leading-relaxed">
            El torneo al que intentas acceder no existe o ha sido eliminado.
          </p>
          <button
            onClick={() => navigate("/")}
            className="mt-2 w-full py-3 rounded-xl font-bold text-sm bg-[#0284c7] hover:bg-sky-500 text-white cursor-pointer transition-colors"
          >
            Volver al inicio
          </button>
        </div>
      </div>
    );

  if (error && !t)
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-6 px-6 text-center">
        <div className="text-5xl">⚠️</div>
        <div className="bg-[#1e293b] border border-[#334155] rounded-2xl px-8 py-8 max-w-sm w-full flex flex-col items-center gap-4">
          <h2 className="text-lg font-black text-gray-50">Error de conexión</h2>
          <p className="text-sm text-gray-400 leading-relaxed">
            No se pudo cargar el torneo. Revisá tu conexión e intentá de nuevo.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="mt-2 w-full py-3 rounded-xl font-bold text-sm bg-[#0284c7] hover:bg-sky-500 text-white cursor-pointer transition-colors"
          >
            Reintentar
          </button>
        </div>
      </div>
    );

  if (!t)
    return (
      <div style={{ padding: 20, textAlign: "center", color: "#f1f5f9" }}>
        Cargando...
      </div>
    );

  const props = { t, code, isAdmin, persist, copyCode };
  const typeInfo = TOURNAMENT_TYPES.find((x) => x.id === t.type) || TOURNAMENT_TYPES[0];

  const onEditTournament = () => setEditMode(true);

  return (
    <Suspense fallback={<div className="p-4 text-center text-[#f1f5f9]">Cargando torneo...</div>}>
      {(t.status === "setup" || editMode) ? (
        t.type === "americano"
          ? <SetupAmericano {...props} onExitEdit={editMode ? () => setEditMode(false) : undefined} />
          : <SetupPairs {...props} typeInfo={typeInfo} onExitEdit={editMode ? () => setEditMode(false) : undefined} />
      ) : (
        <>
          {t.type === "americano" && <PlayAmericano {...props} onEditTournament={onEditTournament} />}
          {t.type === "relampago" && <PlayRelampago {...props} onEditTournament={onEditTournament} />}
          {t.type === "mundialito" && <PlayMundialito {...props} onEditTournament={onEditTournament} />}
          {t.type === "pozo" && <PlayPozo {...props} onEditTournament={onEditTournament} />}
        </>
      )}
    </Suspense>
  );
}
