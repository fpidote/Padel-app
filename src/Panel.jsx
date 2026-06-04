// src/Panel.jsx
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { collection, query, where, orderBy, onSnapshot, deleteDoc, doc } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { db, auth } from "./firebase";
import { TOURNAMENT_TYPES } from "./logic/constants";
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
        try {
          setModalMsg(null);
          await deleteDoc(doc(db, "torneos", code));
        } catch (err) {
          console.error("Error al eliminar torneo:", err);
          setModalMsg({ message: "No se pudo eliminar el torneo. Intentá de nuevo." });
        }
      },
    });
  }

  if (user === undefined) return null;

  return (
    <>
      <div className="min-h-screen bg-[#0f172a] text-[#f1f5f9] px-4 py-6">
        <div className="max-w-lg mx-auto">

          {/* Header */}
          <div className="flex items-center gap-3 mb-7">
            <button
              onClick={() => navigate("/")}
              className="w-8 h-8 rounded-lg bg-[#1e293b] border border-[#334155] flex items-center justify-center text-sm text-[#94a3b8] hover:text-[#f1f5f9] cursor-pointer transition-colors flex-shrink-0"
            >
              ←
            </button>
            <h1 className="text-xl font-black text-[#f1f5f9]">Mis torneos</h1>
            {!loading && torneos.length > 0 && (
              <span className="ml-auto text-sm font-semibold text-[#64748b]">
                {torneos.length} {torneos.length === 1 ? "torneo" : "torneos"}
              </span>
            )}
          </div>

          {/* Loading */}
          {loading && (
            <p className="text-[#64748b] text-center text-sm animate-pulse">Cargando...</p>
          )}

          {/* Empty state */}
          {!loading && torneos.length === 0 && (
            <div className="flex flex-col items-center gap-4 py-12 text-center">
              <div className="w-14 h-14 rounded-2xl bg-[#1e293b] border border-[#334155] flex items-center justify-center text-3xl">
                🏓
              </div>
              <div>
                <p className="text-base font-bold text-[#f1f5f9] mb-1">Sin torneos todavía</p>
                <p className="text-sm text-[#64748b] leading-relaxed">
                  Creá tu primer torneo y compartilo con tus jugadores.
                </p>
              </div>
              <button
                onClick={() => navigate("/")}
                className="bg-[#84cc16] text-[#14532d] font-black rounded-xl px-6 py-2.5 text-sm cursor-pointer border-0 mt-1"
              >
                + Crear torneo
              </button>
            </div>
          )}

          {/* Lista de torneos */}
          <div className="flex flex-col gap-3">
            {torneos.map((t) => {
              const typeInfo = TOURNAMENT_TYPES.find((x) => x.id === t.type);
              const s = STATUS[t.status] ?? STATUS.finished;
              return (
                <div
                  key={t.code}
                  className="bg-[#1e293b] border border-[#334155] rounded-2xl overflow-hidden"
                >
                  {/* Card body */}
                  <div
                    className="flex items-center gap-3 px-4 py-3.5"
                    style={{ borderLeft: `3px solid ${typeInfo?.color ?? "#334155"}` }}
                  >
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
                      style={{ background: `${typeInfo?.color ?? "#334155"}18` }}
                    >
                      {typeInfo?.icon ?? "🏓"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-sm text-[#f1f5f9] truncate">{t.name}</div>
                      <div className="text-xs text-[#64748b] mt-0.5">
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
                    <span
                      className="text-[11px] font-bold rounded-full px-2.5 py-0.5 border flex items-center gap-1.5 flex-shrink-0 whitespace-nowrap"
                      style={{ color: s.color, background: s.bg, borderColor: s.border }}
                    >
                      {t.status === "playing" && (
                        <span
                          className="animate-pulse w-1.5 h-1.5 rounded-full flex-shrink-0"
                          style={{ background: s.color }}
                        />
                      )}
                      {s.label}
                    </span>
                  </div>

                  {/* Card footer */}
                  <div className="flex border-t border-[#334155]">
                    <button
                      onClick={() => navigate(`/torneo/${t.code}`)}
                      className="flex-1 py-2.5 text-sm font-bold cursor-pointer bg-transparent border-0 transition-colors hover:bg-[#263349]"
                      style={{ color: typeInfo?.color ?? "#94a3b8" }}
                    >
                      Entrar →
                    </button>
                    <div className="w-px bg-[#334155]" />
                    <button
                      onClick={() => onDelete(t.code)}
                      className="px-4 py-2.5 text-sm text-[#64748b] hover:text-[#ef4444] hover:bg-[#ef4444]/5 cursor-pointer bg-transparent border-0 transition-colors"
                    >
                      🗑
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
          icon="🗑️"
        />
      )}
    </>
  );
}
