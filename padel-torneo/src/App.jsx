// src/App.jsx
import { Routes, Route } from "react-router-dom";
import Home from "./Home.jsx";
import TournamentPage from "./TournamentPage.jsx";
import Panel from "./Panel.jsx";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/torneo/:code" element={<TournamentPage />} />
      <Route path="/panel" element={<Panel />} />
    </Routes>
  );
}
