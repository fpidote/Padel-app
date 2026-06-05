import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { onAuthStateChanged, signInWithPopup, signOut } from "firebase/auth";
import { doc, setDoc, getDoc, serverTimestamp } from "firebase/firestore";
import { auth, db, googleProvider } from "./firebase";
import { TOURNAMENT_TYPES } from "./logic/constants.js";
import { genCode } from "./logic/utils.js";
import { buildInitialTournament } from "./logic/initTournament.js";
import { SimpleModal } from "./components/shared/Components";

const BENEFITS = [
  {
    icon: "📊",
    title: "Resultados en vivo",
    desc: "La clasificación se actualiza sola al cargar un resultado",
  },
  {
    icon: "💬",
    title: "Comparte por WhatsApp",
    desc: "Un link y todos siguen el torneo desde su móvil",
  },
  {
    icon: "🔓",
    title: "Sin apps, sin cuentas",
    desc: "Los jugadores entran directo con el link, sin registrarse",
  },
];

export default function Home() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [joinVal, setJoinVal] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [modalMsg, setModalMsg] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);
  const modalRef = useRef(null);

  useEffect(() => {
    return onAuthStateChanged(auth, setUser);
  }, []);

  useEffect(() => {
    function handleClickOutside(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  async function handleCreateClick() {
    try {
      if (!auth.currentUser) {
        await signInWithPopup(auth, googleProvider);
      }
      setShowModal(true);
    } catch (err) {
      if (err.code !== "auth/popup-closed-by-user") {
        console.error("Error al iniciar sesión:", err);
        setModalMsg("No se pudo iniciar sesión con Google.");
      }
    }
  }

  async function onCreate(type) {
    try {
      setShowModal(false);
      const code = genCode();
      const init = buildInitialTournament(type, auth.currentUser.uid);
      await setDoc(doc(db, "torneos", code), {
        data: JSON.stringify(init),
        ownerUid: auth.currentUser.uid,
        createdAt: serverTimestamp(),
      });
      navigate(`/torneo/${code}`);
    } catch (err) {
      console.error("Error al crear:", err);
      setModalMsg("Error al crear el torneo. Verificá Firebase.");
    }
  }

  async function handleGoToPanel() {
    try {
      if (!auth.currentUser) {
        await signInWithPopup(auth, googleProvider);
      }
      navigate("/panel");
    } catch (err) {
      if (err.code !== "auth/popup-closed-by-user") {
        console.error("Error al iniciar sesión:", err);
        setModalMsg("No se pudo iniciar sesión con Google.");
      }
    }
  }

  async function onJoin() {
    try {
      const code = joinVal.trim().toUpperCase();
      if (!code) return;
      const snap = await getDoc(doc(db, "torneos", code));
      if (!snap.exists()) {
        setModalMsg("Código no encontrado");
        return;
      }
      navigate(`/torneo/${code}`);
    } catch (err) {
      console.error("Error al unirse:", err);
      setModalMsg("Error de conexión con Firebase.");
    }
  }

  return (
    <div className="min-h-screen bg-app bg-grid text-gray-50">

      {/* ── Modal de selección de formato ── */}
      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4"
          onMouseDown={(e) => {
            if (modalRef.current && !modalRef.current.contains(e.target)) {
              setShowModal(false);
            }
          }}
        >
          <div
            ref={modalRef}
            className="w-full max-w-sm bg-[#1e293b] rounded-2xl p-6"
          >
            {/* Header del modal */}
            <div className="flex items-start justify-between mb-1">
              <h2 className="text-lg font-black text-gray-50">¿Qué formato quieres?</h2>
              <button
                onClick={() => setShowModal(false)}
                className="text-gray-500 hover:text-gray-300 transition-colors cursor-pointer text-xl leading-none ml-4 mt-0.5"
              >
                ✕
              </button>
            </div>
            <p className="text-gray-400 text-sm mb-5">Elige el tipo de torneo</p>

            {/* Cards de formato */}
            <div className="flex flex-col gap-2">
              {TOURNAMENT_TYPES.map((tt) => (
                <button
                  key={tt.id}
                  onClick={() => onCreate(tt.id)}
                  className="w-full flex items-center gap-3 p-4 rounded-xl text-left transition-all duration-150 cursor-pointer active:scale-95"
                  style={{
                    background: tt.color + "14",
                    border: "1px solid " + tt.color + "40",
                    borderLeft: "4px solid " + tt.color,
                  }}
                >
                  <span className="text-2xl flex-shrink-0">{tt.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-sm" style={{ color: tt.color }}>
                      {tt.name}
                    </div>
                    <div className="text-gray-400 text-xs mt-0.5">{tt.desc}</div>
                  </div>
                  <span className="text-xl shrink-0 leading-none" style={{ color: tt.color, opacity: 0.5 }}>›</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Header ── */}
      <header className="sticky top-0 z-10 w-full bg-[#0f172a]/85 backdrop-blur-md border-b border-white/5">
        <div className="w-full max-w-lg mx-auto px-6 py-4 flex items-center justify-between">
          <span className="text-[18px] font-black tracking-tight text-[#f1f5f9]">
            Padeldesk<span className="text-[#84cc16]">•</span>
          </span>

          {user && (
            <div className="relative" ref={menuRef}>
              <button
                onClick={() => setMenuOpen((o) => !o)}
                className="flex items-center gap-2 cursor-pointer"
              >
                <div className="w-7 h-7 rounded-full bg-lime-500/20 border border-lime-500/30 flex items-center justify-center text-xs font-bold text-lime-400 relative overflow-hidden shrink-0">
                  {user.displayName?.[0]?.toUpperCase() ?? "?"}
                  {user.photoURL && (
                    <img
                      src={user.photoURL}
                      alt=""
                      onError={(e) => (e.currentTarget.style.display = "none")}
                      className="absolute inset-0 w-full h-full object-cover"
                    />
                  )}
                </div>
                <span className="text-gray-400 text-xs truncate max-w-[100px]">
                  {user.displayName}
                </span>
                <span className="text-gray-500 text-xs leading-none">▾</span>
              </button>

              {menuOpen && (
                <div className="absolute top-[calc(100%+8px)] right-0 bg-[#1e293b] border border-[#374151] rounded-xl min-w-[180px] z-50 overflow-hidden">
                  {[
                    { icon: "📋", label: "Mis torneos", action: () => { setMenuOpen(false); navigate("/panel"); } },
                    { icon: "👤", label: "Mi perfil",   action: () => { setMenuOpen(false); navigate("/perfil"); } },
                  ].map((item) => (
                    <button
                      key={item.label}
                      onClick={item.action}
                      className="flex items-center gap-2.5 w-full px-4 py-2.5 bg-transparent border-0 text-gray-50 text-sm cursor-pointer text-left hover:bg-[#374151] transition-colors"
                    >
                      <span>{item.icon}</span>{item.label}
                    </button>
                  ))}
                  <div className="border-t border-[#374151] my-1" />
                  <button
                    onClick={() => { setMenuOpen(false); signOut(auth); }}
                    className="flex items-center gap-2.5 w-full px-4 py-2.5 bg-transparent border-0 text-gray-50 text-sm cursor-pointer text-left hover:bg-[#374151] transition-colors"
                  >
                    <span>🚪</span>Salir
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </header>

      {/* ── Landing ── */}
      <main className="w-full max-w-lg mx-auto px-6 pb-12">

        {/* Hero */}
        <section className="pt-10 pb-8 text-center">
          <div className="inline-flex items-center gap-2 bg-[#84cc16]/8 border border-[#84cc16]/20 text-[#84cc16] text-[10px] font-bold tracking-[0.5px] px-3.5 py-1.5 rounded-full mb-5 select-none">
            <span
              className="w-1.5 h-1.5 rounded-full bg-[#84cc16] flex-shrink-0"
              style={{ animation: 'pulse-dot 2s ease-in-out infinite' }}
            />
            100% gratis · Tiempo real
          </div>

          <h1 className="text-[42px] font-black leading-[1.0] tracking-[-0.05em] mb-4">
            Organiza.<br />
            Comparte.<br />
            <span className="text-[#84cc16]">Juega.</span>
          </h1>

          <p className="text-[#4a5568] text-sm font-medium leading-relaxed mb-8 max-w-xs mx-auto">
            Monta tu torneo en 2 minutos, comparte el link y que empiece el juego.
          </p>

          <button
            onClick={handleCreateClick}
            className="w-full bg-[#84cc16] hover:bg-lime-400 text-[#14532d] font-black py-4 rounded-2xl text-base transition-colors cursor-pointer"
            style={{
              boxShadow: '0 0 0 1px rgba(132,204,22,0.4), 0 4px 20px rgba(132,204,22,0.25), 0 12px 40px rgba(132,204,22,0.1)',
            }}
          >
            + Crear torneo gratis
          </button>

          <button
            onClick={handleGoToPanel}
            className="w-full text-gray-400 hover:text-gray-200 text-sm font-semibold py-2 transition-colors cursor-pointer"
          >
            {user ? "Mis torneos →" : "Ya tengo torneos →"}
          </button>
        </section>

        {/* Divider */}
        <div className="flex items-center gap-3 mb-4">
          <div className="flex-1 h-px bg-gray-800" />
          <span className="text-gray-500 text-xs">o únete con un código</span>
          <div className="flex-1 h-px bg-gray-800" />
        </div>

        {/* Join */}
        <div className="flex gap-2 mb-10">
          <input
            value={joinVal}
            onChange={(e) => setJoinVal(e.target.value.toUpperCase())}
            onKeyDown={(e) => e.key === "Enter" && onJoin()}
            maxLength={6}
            placeholder="CÓDIGO"
            className="flex-1 min-w-0 font-data bg-white/[0.03] border border-white/[0.07] focus:border-[#84cc16]/30 rounded-2xl text-[#f1f5f9] text-xl font-bold tracking-[0.35em] text-center py-3 outline-none transition-all placeholder:text-[#1e2a3a] placeholder:tracking-[4px] placeholder:text-sm placeholder:font-medium"
            onFocus={(e) => { e.target.style.boxShadow = '0 0 0 3px rgba(132,204,22,0.06)'; }}
            onBlur={(e) => { e.target.style.boxShadow = 'none'; }}
          />
          <button
            onClick={onJoin}
            className="bg-gray-700 hover:bg-gray-600 text-gray-50 font-bold px-5 py-3 rounded-xl transition-colors cursor-pointer shrink-0"
          >
            Unirse
          </button>
        </div>

        {/* Formatos informativos */}
        <section id="formats" className="mb-10">
          <p className="text-gray-500 text-xs font-bold uppercase tracking-widest mb-3">
            Formatos disponibles
          </p>
          <div className="flex flex-col gap-2">
            {TOURNAMENT_TYPES.map((tt) => (
              <div
                key={tt.id}
                className="w-full flex items-center gap-3 p-4 rounded-xl"
                style={{
                  background: tt.color + "14",
                  border: "1px solid " + tt.color + "40",
                  borderLeft: "4px solid " + tt.color,
                }}
              >
                <span className="text-2xl flex-shrink-0">{tt.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-sm" style={{ color: tt.color }}>
                    {tt.name}
                  </div>
                  <div className="text-gray-400 text-xs mt-0.5">{tt.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Beneficios */}
        <section className="border-t border-gray-800 pt-8 mb-10">
          <div className="flex flex-col gap-5">
            {BENEFITS.map((b) => (
              <div key={b.title} className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-lg bg-[#84cc16]/7 border border-[#84cc16]/10 flex items-center justify-center shrink-0 text-xl leading-none">
                  {b.icon}
                </div>
                <div>
                  <div className="text-gray-50 text-sm font-semibold">{b.title}</div>
                  <div className="text-gray-400 text-xs mt-0.5 leading-relaxed">{b.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Footer */}
        <footer className="text-center border-t border-gray-800 pt-6">
          <p className="text-gray-500 text-xs mb-3">
            Al crear necesitas iniciar sesión con Google
          </p>
          <div className="flex items-center justify-center gap-3 text-xs text-gray-600">
            <a href="#" className="hover:text-gray-400 transition-colors">Política de privacidad</a>
            <span>·</span>
            <a href="#" className="hover:text-gray-400 transition-colors">Contacto</a>
          </div>
        </footer>

      </main>
      {modalMsg && <SimpleModal message={modalMsg} onClose={() => setModalMsg(null)} />}
    </div>
  );
}
