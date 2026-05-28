// src/App.jsx
import Home from "./Home.jsx";
import { useTournament } from "./hooks/useTournament";
import { TOURNAMENT_TYPES } from "./logic/constants";

import SetupAmericano from "./components/setup/SetupAmericano";
import SetupPairs from "./components/setup/SetupPairs";
import PlayAmericano from "./components/play/PlayAmericano";
import PlayRelampago from "./components/play/PlayRelampago";
import PlayMundialito from "./components/play/PlayMundialito";
import PlayPozo from "./components/play/PlayPozo";

export default function App() {
  const {
    screen,
    code,
    isAdmin,
    t,
    joinVal,
    setJoinVal,
    persist,
    onCreate,
    onJoin,
    copyCode,
  } = useTournament();

  const props = { t, code, isAdmin, persist, copyCode };

  if (screen === "home")
    return (
      <Home
        joinVal={joinVal}
        setJoinVal={setJoinVal}
        onCreate={onCreate}
        onJoin={onJoin}
      />
    );

  if (!t)
    return (
      <div style={{ padding: 20, textAlign: "center", color: "#f1f5f9" }}>
        Cargando...
      </div>
    );

  const typeInfo =
    TOURNAMENT_TYPES.find((x) => x.id === t.type) || TOURNAMENT_TYPES[0];

  if (screen === "setup") {
    if (t.type === "americano") return <SetupAmericano {...props} />;
    // 👇 Agrega typeInfo={typeInfo} aquí
    return <SetupPairs {...props} typeInfo={typeInfo} />;
  }

  // ── Play ──────────────────────────────────────────────────────
  if (t.type === "americano") return <PlayAmericano {...props} />;
  if (t.type === "relampago") return <PlayRelampago {...props} />;
  if (t.type === "mundialito") return <PlayMundialito {...props} />;
  if (t.type === "pozo") return <PlayPozo {...props} />;

  return null;
}
