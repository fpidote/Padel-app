// src/Panel.jsx
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { collection, query, where, orderBy, onSnapshot, deleteDoc, doc } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { db, auth } from "./firebase";
import { TOURNAMENT_TYPES, B } from "./logic/constants";
import { SimpleModal } from "./components/shared/Components";

const STATUS = {
  setup:    { label: "Configurando", color: "#eab308", bg: "#eab30815", border: "#eab30830" },
  playing:  { label: "En curso",     color: "#22c55e", bg: "#22c55e15", border: "#22c55e30" },
  finished: { label: "Finalizado",   color: "#64748b", bg: "#64748b15", border: "#64748b30" },
};

export default function Panel() {
  const navigate = useNavigate();
  const [user, setUser] = useState(undefined); // undefined = todavía cargando
  const [torneos, setTorneos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalMsg, setModalMsg] = useState(null);

  // Protección de ruta
  useEffect(() => {
    return onAuthStateChanged(auth, (u) => {
      setUser(u);
      if (u === null) navigate("/", { replace: true });
    });
  }, [navigate]);

  // Query en tiempo real de los torneos del usuario
  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, "torneos"),
      where("ownerUid", "==", user.uid),
      orderBy("createdAt", "desc"),
    );
    const unsub = onSnapshot(q, (snap) => {
      const docs = snap.docs.map((d) => {
        const data = JSON.parse(d.data().data);
        return {
          code: d.id,
          name: data.config?.name ?? d.id,
          type: data.type,
          status: data.status,
          createdAt: d.data().createdAt?.toDate() ?? null,
        };
      });
      setTorneos(docs);
      setLoading(false);
    });
    return () => unsub();
  }, [user]);

  async function onDelete(code) {
    setModalMsg({
      message: "¿Eliminar este torneo? Esta acción no se puede deshacer.",
      onConfirm: async () => {
        setModalMsg(null);
        await deleteDoc(doc(db, "torneos", code));
      },
    });
  }

  if (user === undefined) return null; // espera auth

  return (
    <>
    <div
      style={{
        minHeight: "100vh",
        background: "#0f172a",
        color: "#f1f5f9",
        fontFamily: "system-ui",
        padding: "24px 16px",
      }}
    >
      <div style={{ maxWidth: 560, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 28 }}>
          <button
            onClick={() => navigate("/")}
            style={{
              background: "none",
              border: "none",
              color: "#64748b",
              fontSize: 20,
              cursor: "pointer",
              padding: 0,
              lineHeight: 1,
            }}
          >
            ←
          </button>
          <h1 style={{ fontSize: 20, fontWeight: 800, color: "#f1f5f9", margin: 0 }}>
            Mis torneos
          </h1>
        </div>

        {loading && (
          <p style={{ color: "#64748b", textAlign: "center" }}>Cargando...</p>
        )}

        {!loading && torneos.length === 0 && (
          <p style={{ color: "#64748b", textAlign: "center" }}>
            Todavía no creaste ningún torneo.
          </p>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {torneos.map((t) => {
            const typeInfo = TOURNAMENT_TYPES.find((x) => x.id === t.type);
            const s = STATUS[t.status] ?? STATUS.finished;
            return (
              <div
                key={t.code}
                style={{
                  background: "#1e293b",
                  borderRadius: 12,
                  padding: "14px 16px",
                  display: "flex",
                  flexDirection: "column",
                  gap: 10,
                }}
              >
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                    <span style={{ fontSize: 20, flexShrink: 0 }}>{typeInfo?.icon ?? "🏓"}</span>
                    <div style={{ minWidth: 0 }}>
                      <div
                        style={{
                          fontWeight: 700,
                          fontSize: 15,
                          color: "#f1f5f9",
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {t.name}
                      </div>
                      <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>
                        {typeInfo?.name ?? t.type}
                        {t.createdAt && (
                          <>
                            {" · "}
                            {t.createdAt.toLocaleDateString("es-AR", {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                            })}
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 4,
                      fontSize: 11,
                      fontWeight: 700,
                      color: s.color,
                      background: s.bg,
                      border: `1px solid ${s.border}`,
                      borderRadius: 99,
                      padding: "3px 10px",
                      flexShrink: 0,
                      whiteSpace: "nowrap",
                    }}
                  >
                    {t.status === "playing" && (
                      <span className="animate-pulse" style={{
                        width: 6, height: 6, borderRadius: "50%",
                        background: "#22c55e", flexShrink: 0,
                      }} />
                    )}
                    {s.label}
                  </span>
                </div>

                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    onClick={() => navigate(`/torneo/${t.code}`)}
                    style={B("#0284c7", { flex: 1, padding: "8px 0", borderRadius: 8 })}
                  >
                    Entrar
                  </button>
                  <button
                    onClick={() => onDelete(t.code)}
                    style={B("#7f1d1d", {
                      padding: "8px 14px",
                      borderRadius: 8,
                      background: "#1e293b",
                      border: "1px solid #ef444444",
                      color: "#ef4444",
                    })}
                  >
                    Borrar
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>

    {modalMsg && (
      <SimpleModal
        message={modalMsg.message}
        onClose={() => setModalMsg(null)}
        onConfirm={modalMsg.onConfirm}
      />
    )}
    </>
  );
}
