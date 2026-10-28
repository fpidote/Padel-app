// src/TournamentPage.jsx
import { useState, lazy, Suspense } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useTournament } from "./hooks/useTournament";
import { useOnline } from "./hooks/useOnline";
import { TOURNAMENT_TYPES } from "./logic/constants";
import { SimpleModal } from "./components/shared/Components";
import { RoleContext } from "./components/shared/RoleContext";
import HelpersModal from "./components/shared/HelpersModal";

const SetupAmericano = lazy(() => import('./components/setup/SetupAmericano'));
const SetupPairs = lazy(() => import('./components/setup/SetupPairs'));
const PlayAmericano = lazy(() => import('./components/play/PlayAmericano'));
const PlayRelampago = lazy(() => import('./components/play/PlayRelampago'));
const PlayMundialito = lazy(() => import('./components/play/PlayMundialito'));
const PlayPozo = lazy(() => import('./components/play/PlayPozo'));
const PlayLiga = lazy(() => import('./components/play/PlayLiga'));

export default function TournamentPage() {
  const { code } = useParams();
  const navigate = useNavigate();
  const { t, notFound, isOwner, isHelper, canScore, signedIn, error, saving, persist, copyCode, sessionExpired, reauthenticate } = useTournament(code);
  const online = useOnline();
  const [editMode, setEditMode] = useState(false);
  const [showHelpers, setShowHelpers] = useState(false);

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
            className="mt-2 w-full py-3 rounded-xl font-black text-sm bg-[#84cc16] hover:bg-lime-400 text-[#14532d] cursor-pointer transition-colors"
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
            className="mt-2 w-full py-3 rounded-xl font-black text-sm bg-[#84cc16] hover:bg-lime-400 text-[#14532d] cursor-pointer transition-colors"
          >
            Reintentar
          </button>
        </div>
      </div>
    );

  if (!t)
    return (
      <div className="min-h-screen flex items-center justify-center">
        <span className="text-sm font-semibold text-[#64748b] animate-pulse">Cargando torneo...</span>
      </div>
    );

  // Los ayudantes cargan resultados (canScore); preparar, lanzar y editar el torneo es solo del dueño
  const props = { t, code, isAdmin: canScore, saving, persist, copyCode };
  const setupProps = { ...props, isAdmin: isOwner };
  const typeInfo = TOURNAMENT_TYPES.find((x) => x.id === t.type) || TOURNAMENT_TYPES[0];

  const canEditTournament = !t.scoringStarted;
  const onEditTournament = isOwner && canEditTournament ? () => setEditMode(true) : undefined;

  const role = { isHelper, onHelpers: isOwner ? () => setShowHelpers(true) : undefined };

  return (
    <RoleContext.Provider value={role}>
      {(!online || error) && (
        <div role="alert" className="sticky top-0 z-50 bg-amber-500/95 text-[#1c1917] text-xs font-bold text-center px-4 py-2">
          {!online
            ? "📡 Sin conexión. Verás los últimos datos, pero no se guardarán cambios hasta que vuelva."
            : "⚠️ Se perdió la conexión con el torneo en vivo. Recarga la página si no se actualiza."}
        </div>
      )}
      {sessionExpired && (
        <SimpleModal
          icon="🔒"
          message="Tu sesión expiró. Iniciá sesión de nuevo para seguir cargando resultados."
          onClose={reauthenticate}
        />
      )}
      <Suspense fallback={<div className="p-4 text-center text-[#f1f5f9]">Cargando torneo...</div>}>
        {(t.status === "setup" || editMode) ? (
          t.type === "americano"
            ? <SetupAmericano {...setupProps} onExitEdit={editMode ? () => setEditMode(false) : undefined} />
            : <SetupPairs {...setupProps} typeInfo={typeInfo} onExitEdit={editMode ? () => setEditMode(false) : undefined} />
        ) : (
          <div className="min-h-screen bg-[#0f172a]">
            <div className="max-w-2xl mx-auto w-full">
              {t.type === "americano" && <PlayAmericano {...props} onEditTournament={onEditTournament} />}
              {t.type === "relampago" && <PlayRelampago {...props} onEditTournament={onEditTournament} />}
              {t.type === "mundialito" && <PlayMundialito {...props} onEditTournament={onEditTournament} />}
              {t.type === "pozo" && <PlayPozo {...props} onEditTournament={onEditTournament} />}
              {t.type === "liga" && <PlayLiga {...props} onEditTournament={onEditTournament} />}
            </div>
          </div>
        )}
      </Suspense>
      {/* Quien no tiene sesión puede iniciarla aquí (un ayudante entra por el mismo enlace del torneo) */}
      {!signedIn && (
        <div className="text-center py-6">
          <button
            type="button"
            data-testid="btn-iniciar-sesion"
            onClick={reauthenticate}
            className="text-xs text-[#64748b] hover:text-[#f1f5f9] underline bg-transparent border-0 cursor-pointer"
          >
            ¿Eres organizador o ayudante? Iniciar sesión
          </button>
        </div>
      )}
      {showHelpers && isOwner && <HelpersModal code={code} onClose={() => setShowHelpers(false)} />}
    </RoleContext.Provider>
  );
}
