import { lazy, Suspense } from "react";
import { Routes, Route } from "react-router-dom";
import Home from "./Home.jsx";
import TournamentPage from "./TournamentPage.jsx";

const Panel = lazy(() => import("./Panel.jsx"));

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/torneo/:code" element={<TournamentPage />} />
      <Route path="/panel" element={
        <Suspense fallback={<div className="p-4 text-center text-[#f1f5f9]">Cargando...</div>}>
          <Panel />
        </Suspense>
      } />
      <Route path="/perfil" element={<div>Perfil próximamente</div>} />
    </Routes>
  );
}
