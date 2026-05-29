import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { onAuthStateChanged, signInWithPopup, signOut } from "firebase/auth";
import { doc, setDoc, getDoc, serverTimestamp } from "firebase/firestore";
import { auth, db, googleProvider } from "./firebase";
import { B, TOURNAMENT_TYPES } from "./logic/constants.js";
import { genCode } from "./logic/utils.js";
import { buildInitialTournament } from "./logic/initTournament.js";

export default function Home() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [creating, setCreating] = useState(false);
  const [joinVal, setJoinVal] = useState("");

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
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        fontFamily: "system-ui",
        background: "#0f172a",
        color: "#f1f5f9",
      }}
    >
      <div style={{ textAlign: "center", marginBottom: 32 }}>
        <div style={{ fontSize: 64, marginBottom: 12 }}>🏓</div>
        <h1
          style={{
            fontSize: 28,
            fontWeight: 900,
            color: "#38bdf8",
            marginBottom: 8,
          }}
        >
          Pádel Torneo
        </h1>
        <p style={{ color: "#64748b", fontSize: 14 }}>
          Organizá y seguí tu torneo en tiempo real
        </p>
      </div>

      {!creating ? (
        <div
          style={{
            width: "100%",
            maxWidth: 380,
            display: "flex",
            flexDirection: "column",
            gap: 12,
          }}
        >
          {user ? (
            <>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  background: "#1e293b",
                  borderRadius: 10,
                  padding: "8px 12px",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: "50%",
                      background: "#0284c7",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 13,
                      fontWeight: 700,
                      color: "#fff",
                      flexShrink: 0,
                      position: "relative",
                      overflow: "hidden",
                    }}
                  >
                    {user.displayName?.[0]?.toUpperCase() ?? "?"}
                    {user.photoURL && (
                      <img
                        src={user.photoURL}
                        alt=""
                        onError={(e) => (e.currentTarget.style.display = "none")}
                        style={{
                          position: "absolute",
                          inset: 0,
                          width: "100%",
                          height: "100%",
                          objectFit: "cover",
                        }}
                      />
                    )}
                  </div>
                  <span style={{ fontSize: 13, color: "#cbd5e1" }}>
                    {user.displayName}
                  </span>
                </div>
                <button
                  onClick={() => signOut(auth)}
                  style={{
                    background: "none",
                    border: "none",
                    color: "#64748b",
                    fontSize: 12,
                    cursor: "pointer",
                    padding: "2px 6px",
                  }}
                >
                  Salir
                </button>
              </div>
              <button
                onClick={() => setCreating(true)}
                style={B("#0284c7", {
                  padding: 16,
                  fontSize: 16,
                  borderRadius: 12,
                  width: "100%",
                })}
              >
                ➕ Crear nuevo torneo
              </button>
              <button
                onClick={() => navigate("/panel")}
                style={B("#1e40af", {
                  padding: 12,
                  fontSize: 14,
                  borderRadius: 12,
                  width: "100%",
                })}
              >
                📋 Mis torneos
              </button>
            </>
          ) : (
            <button
              onClick={onGoogleSignIn}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 10,
                background: "#fff",
                color: "#1e293b",
                border: "none",
                borderRadius: 12,
                padding: 16,
                fontSize: 15,
                fontWeight: 700,
                cursor: "pointer",
                width: "100%",
              }}
            >
              <svg width="18" height="18" viewBox="0 0 48 48">
                <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
                <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.31-8.16 2.31-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
              </svg>
              Entrar con Google
            </button>
          )}

          <div style={{ color: "#64748b", textAlign: "center", fontSize: 13 }}>
            — o unirte a uno existente —
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              value={joinVal}
              onChange={(e) => setJoinVal(e.target.value.toUpperCase())}
              onKeyDown={(e) => e.key === "Enter" && onJoin()}
              maxLength={6}
              placeholder="Código"
              style={{
                flex: 1,
                background: "#1e293b",
                border: "1px solid #334155",
                borderRadius: 10,
                color: "#f1f5f9",
                padding: "10px 0",
                fontSize: 20,
                letterSpacing: 6,
                textAlign: "center",
                outline: "none",
              }}
            />
            <button
              onClick={onJoin}
              style={B("#0284c7", { padding: "10px 16px", borderRadius: 10 })}
            >
              Unirse
            </button>
          </div>
        </div>
      ) : (
        <div style={{ width: "100%", maxWidth: 480 }}>
          <div
            style={{
              textAlign: "center",
              color: "#94a3b8",
              fontSize: 14,
              marginBottom: 16,
            }}
          >
            Elegí el formato del torneo
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 12,
            }}
          >
            {TOURNAMENT_TYPES.map((tt) => (
              <button
                key={tt.id}
                onClick={() => onCreate(tt.id)}
                style={{
                  background: "#1e293b",
                  border: `2px solid ${tt.color}44`,
                  borderRadius: 14,
                  padding: "18px 12px",
                  cursor: "pointer",
                  textAlign: "left",
                  transition: "border-color .2s",
                }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.borderColor = tt.color)
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.borderColor = `${tt.color}44`)
                }
              >
                <div style={{ fontSize: 32, marginBottom: 6 }}>{tt.icon}</div>
                <div
                  style={{
                    fontWeight: 800,
                    color: "#f1f5f9",
                    fontSize: 15,
                    marginBottom: 4,
                  }}
                >
                  {tt.name}
                </div>
                <div
                  style={{ fontSize: 11, color: "#64748b", lineHeight: 1.4 }}
                >
                  {tt.desc}
                </div>
              </button>
            ))}
          </div>
          <button
            onClick={() => setCreating(false)}
            style={{
              ...B("#334155"),
              width: "100%",
              marginTop: 12,
              padding: 10,
            }}
          >
            ← Volver
          </button>
        </div>
      )}
    </div>
  );
}
