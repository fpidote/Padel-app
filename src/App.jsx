import { lazy, Suspense, useEffect } from "react";
import { Routes, Route, useLocation } from "react-router-dom";
import Home from "./Home.jsx";
import TournamentPage from "./TournamentPage.jsx";
import { trackEvent } from "./firebase";
import Toaster from "./components/shared/Toaster.jsx";

const Panel = lazy(() => import("./Panel.jsx"));

function usePageViewTracking() {
  const location = useLocation();
  useEffect(() => {
    trackEvent("page_view", { page_path: location.pathname });
  }, [location.pathname]);
}

export default function App() {
  usePageViewTracking();

  return (
    <>
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
    <Toaster />
    </>
  );
}
