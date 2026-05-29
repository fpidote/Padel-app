import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { onAuthStateChanged, signInWithPopup, signOut } from "firebase/auth";
import { doc, setDoc, getDoc, serverTimestamp } from "firebase/firestore";
import { auth, db, googleProvider } from "./firebase";
import { TOURNAMENT_TYPES } from "./logic/constants.js";
import { genCode } from "./logic/utils.js";
import { buildInitialTournament } from "./logic/initTournament.js";

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
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    return onAuthStateChanged(auth, setUser);
  }, []);

  async function onGoogleSignIn() {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      if (err.code !== "auth/popup-closed-by-user") {
        console.error("Error al iniciar sesión:", err);
        alert("No se pudo iniciar sesión con Google.");
      }
    }
  }

  async function onCreate(type) {
    try {
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
      alert("Error al crear el torneo. Verificá Firebase.");
    }
  }

  async function handleFormatClick(type) {
    try {
      if (!auth.currentUser) {
        await signInWithPopup(auth, googleProvider);
      }
      await onCreate(type);
    } catch (err) {
      if (err.code !== "auth/popup-closed-by-user") {
        console.error(err);
        alert("No se pudo iniciar sesión con Google.");
      }
    }
  }

  async function handleCtaClick() {
    if (!user) {
      try {
        await signInWithPopup(auth, googleProvider);
        document.getElementById("formats")?.scrollIntoView({ behavior: "smooth" });
      } catch (err) {
        if (err.code !== "auth/popup-closed-by-user") {
          alert("No se pudo iniciar sesión con Google.");
        }
      }
    } else {
      document.getElementById("formats")?.scrollIntoView({ behavior: "smooth" });
    }
  }

  async function onJoin() {
    try {
      const code = joinVal.trim().toUpperCase();
      if (!code) return;
      const snap = await getDoc(doc(db, "torneos", code));
      if (!snap.exists()) {
        alert("Código no encontrado");
        return;
      }
      navigate(`/torneo/${code}`);
    } catch (err) {
      console.error("Error al unirse:", err);
      alert("Error de conexión con Firebase.");
    }
  }

  return (
    <div className="min-h-screen bg-[#111827] text-gray-50" style={{ fontFamily: "system-ui" }}>

      {/* ── Header fijo ── */}
      <header className="sticky top-0 z-10 w-full bg-[#111827]/90 backdrop-blur-sm border-b border-gray-800">
        <div className="w-full max-w-lg mx-auto px-6 py-4 flex items-center justify-between">
          <span className="text-xl font-black text-lime-500 tracking-tight">Padeldesk</span>

          {user && (
            <div className="relative" ref={menuRef}>
              {/* Trigger */}
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

              {/* Dropdown */}
              {menuOpen && (
                <div
                  style={{
                    position: "absolute",
                    top: "calc(100% + 8px)",
                    right: 0,
                    background: "#1f2937",
                    border: "1px solid #374151",
                    borderRadius: 12,
                    minWidth: 180,
                    zIndex: 50,
                    overflow: "hidden",
                  }}
                >
                  {[
                    { icon: "📋", label: "Mis torneos", action: () => { setMenuOpen(false); navigate("/panel"); } },
                    { icon: "👤", label: "Mi perfil", action: () => { setMenuOpen(false); navigate("/perfil"); } },
                  ].map((item) => (
                    <button
                      key={item.label}
                      onClick={item.action}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        width: "100%",
                        padding: "10px 16px",
                        background: "transparent",
                        border: "none",
                        color: "#f9fafb",
                        fontSize: 14,
                        cursor: "pointer",
                        textAlign: "left",
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = "#374151")}
                      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                    >
                      <span>{item.icon}</span>
                      {item.label}
                    </button>
                  ))}
                  <div style={{ borderTop: "1px solid #374151", margin: "4px 0" }} />
                  <button
                    onClick={() => { setMenuOpen(false); signOut(auth); }}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      width: "100%",
                      padding: "10px 16px",
                      background: "transparent",
                      border: "none",
                      color: "#f9fafb",
                      fontSize: 14,
                      cursor: "pointer",
                      textAlign: "left",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "#374151")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                  >
                    <span>🚪</span>
                    Salir
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </header>

      <main className="w-full max-w-lg mx-auto px-6 pb-12">

        {/* ── Hero ── */}
        <section className="pt-10 pb-8 text-center">
          <div className="inline-flex items-center gap-1.5 bg-green-900/60 text-lime-400 border border-green-800 text-xs font-semibold px-3 py-1.5 rounded-full mb-6 select-none">
            ✅ 100% gratis · ⚡ Tiempo real
          </div>

          <h1 className="text-3xl font-black leading-tight mb-4 text-gray-50">
            Organiza. Comparte. Juega.
          </h1>

          <p className="text-gray-400 text-sm leading-relaxed mb-8 max-w-xs mx-auto">
            Monta tu torneo en 2 minutos, comparte el link y que empiece el juego.
          </p>

          <button
            onClick={handleCtaClick}
            className="w-full bg-lime-500 hover:bg-lime-400 text-green-950 font-black py-4 rounded-2xl text-base transition-colors cursor-pointer shadow-lg shadow-lime-500/20"
          >
            + Crear torneo gratis
          </button>
        </section>

        {/* ── Divider ── */}
        <div className="flex items-center gap-3 mb-4">
          <div className="flex-1 h-px bg-gray-800" />
          <span className="text-gray-500 text-xs">o únete con un código</span>
          <div className="flex-1 h-px bg-gray-800" />
        </div>

        {/* ── Join ── */}
        <div className="flex gap-2 mb-10">
          <input
            value={joinVal}
            onChange={(e) => setJoinVal(e.target.value.toUpperCase())}
            onKeyDown={(e) => e.key === "Enter" && onJoin()}
            maxLength={6}
            placeholder="CÓDIGO"
            className="flex-1 min-w-0 bg-[#1f2937] border border-gray-700 focus:border-lime-600 rounded-xl text-gray-50 text-xl font-bold tracking-[0.35em] text-center py-3 outline-none transition-colors placeholder:text-gray-600 placeholder:tracking-widest placeholder:text-sm placeholder:font-normal"
          />
          <button
            onClick={onJoin}
            className="bg-gray-700 hover:bg-gray-600 text-gray-50 font-bold px-5 py-3 rounded-xl transition-colors cursor-pointer shrink-0"
          >
            Unirse
          </button>
        </div>

        {/* ── Formatos ── */}
        <section id="formats" className="mb-10">
          <p className="text-gray-500 text-xs font-bold uppercase tracking-widest mb-3">
            Elige tu formato
          </p>
          <div className="flex flex-col gap-2">
            {TOURNAMENT_TYPES.map((tt) => (
              <button
                key={tt.id}
                onClick={() => handleFormatClick(tt.id)}
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
                  <div className="text-gray-400 text-xs mt-0.5">
                    {tt.desc}
                  </div>
                </div>
                <span
                  className="text-xl shrink-0 leading-none"
                  style={{ color: tt.color, opacity: 0.5 }}
                >
                  ›
                </span>
              </button>
            ))}
          </div>
        </section>

        {/* ── Beneficios ── */}
        <section className="border-t border-gray-800 pt-8 mb-10">
          <div className="flex flex-col gap-5">
            {BENEFITS.map((b) => (
              <div key={b.title} className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-lg bg-[#14532d] flex items-center justify-center shrink-0 text-xl leading-none">
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

        {/* ── Footer ── */}
        <footer className="text-center border-t border-gray-800 pt-6">
          <p className="text-gray-500 text-xs mb-3">
            Al crear necesitas iniciar sesión con Google
          </p>
          <div className="flex items-center justify-center gap-3 text-xs text-gray-600">
            <a href="#" className="hover:text-gray-400 transition-colors">
              Política de privacidad
            </a>
            <span>·</span>
            <a href="#" className="hover:text-gray-400 transition-colors">
              Contacto
            </a>
          </div>
        </footer>
      </main>
    </div>
  );
}
