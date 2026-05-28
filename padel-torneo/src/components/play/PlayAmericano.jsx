import { useState } from "react";
import { B } from "../../logic/constants";
import { pk } from "../../logic/utils";
import { buildRoundAmericano } from "../../logic/americano";
import { THeader, Tabs, PName, PTag } from "../shared/Components";
import History from "../shared/History";
import { TOURNAMENT_RULES } from "../../logic/constants";

export default function PlayAmericano({ t, code, isAdmin, persist, copyCode }) {
  const [tab, setTab] = useState("courts");
  const [ls, setLs] = useState({});

  async function onSave(ci) {
    const court = t.currentRound[ci];
    const a = parseInt(ls[`${ci}_A`] ?? court.scoreA);
    const b = parseInt(ls[`${ci}_B`] ?? court.scoreB);
    if (isNaN(a) || isNaN(b) || a < 0 || b < 0 || a === b) return;
    const cr = t.currentRound.map((c, i) =>
      i === ci
        ? { ...c, scoreA: String(a), scoreB: String(b), saved: true }
        : c,
    );
    setLs((prev) => {
      const n = { ...prev };
      delete n[`${ci}_A`];
      delete n[`${ci}_B`];
      return n;
    });
    await persist({ ...t, currentRound: cr });
  }

  async function onEdit(ci) {
    const cr = t.currentRound.map((c, i) =>
      i === ci ? { ...c, saved: false, scoreA: "", scoreB: "" } : c,
    );
    await persist({ ...t, currentRound: cr });
  }

  async function onNext() {
    if (!t.currentRound.every((c) => c.saved)) return;
    let np = t.players.map((p) => ({ ...p }));
    const nh = { ...t.partnerHistory };
    const nso = { ...t.sitOutHistory };
    t.sittingOut.forEach((p) => {
      nso[p.id] = (nso[p.id] || 0) + 1;
    });
    t.currentRound.forEach((court) => {
      const a = parseInt(court.scoreA),
        b = parseInt(court.scoreB);
      [court.pairA, court.pairB].forEach((pair, pi) => {
        nh[pk(pair[0].id, pair[1].id)] =
          (nh[pk(pair[0].id, pair[1].id)] || 0) + 1;
        const won = pi === 0 ? a > b : b > a;
        pair.forEach(({ id }) => {
          const p = np.find((x) => x.id === id);
          p.pts += won ? 1 : 0;
          p.gf += pi === 0 ? a : b;
          p.gc += pi === 0 ? b : a;
        });
      });
    });
    const { courts: nc, sittingOut: nSit } = buildRoundAmericano(
      np,
      t.config.courts,
      nh,
      nso,
    );
    const newRounds = [
      ...t.rounds,
      { num: t.roundNum, courts: t.currentRound, sittingOut: t.sittingOut },
    ];
    setLs({});
    await persist({
      ...t,
      players: np,
      rounds: newRounds,
      currentRound: nc,
      sittingOut: nSit,
      partnerHistory: nh,
      sitOutHistory: nso,
      roundNum: t.roundNum + 1,
    });
  }

  const standings = [...t.players].sort((a, b) =>
    b.pts !== a.pts ? b.pts - a.pts : b.gf - b.gc - (a.gf - a.gc),
  );
  const allSaved = t.currentRound?.every((c) => c.saved);

  return (
    <div style={{ paddingBottom: 80 }}>
      <THeader
        t={t}
        code={code}
        isAdmin={isAdmin}
        copyCode={copyCode}
        subtitle={`Ronda ${t.roundNum} de ${t.config.rounds || "∞"}`}
      />
      <div style={{ padding: 16 }}>
        <Tabs
          tabs={[
            ["courts", "⚔️ Pistas"],
            ["standings", "🏆 Posiciones"],
            ["history", "📜 Historial"],
            ["rules", "📖 Reglas"],
          ]}
          active={tab}
          setActive={setTab}
        />
      </div>
      <div style={{ padding: "0 16px" }}>
        {tab === "courts" && (
          <CourtsAmericano
            t={t}
            isAdmin={isAdmin}
            ls={ls}
            setLs={setLs}
            allSaved={allSaved}
            onSave={onSave}
            onNext={onNext}
            onEdit={onEdit}
          />
        )}
        {tab === "standings" && (
          <StandingsAmericano rows={standings} roundNum={t.roundNum} />
        )}
        {tab === "history" && <History rounds={t.rounds} />}
        {tab === "rules" && (
          <div style={{ background: "#1e293b", padding: 20, borderRadius: 12 }}>
            <h3
              style={{
                fontSize: 18,
                fontWeight: 800,
                color: "#38bdf8",
                marginBottom: 16,
              }}
            >
              Reglas del Torneo Americano
            </h3>
            <ul
              style={{
                color: "#cbd5e1",
                fontSize: 14,
                lineHeight: "1.6",
                paddingLeft: 20,
                listStyleType: "disc",
              }}
            >
              {TOURNAMENT_RULES.americano.map((rule, i) => (
                <li key={i} style={{ marginBottom: 10 }}>
                  {rule}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

function CourtsAmericano({
  t,
  isAdmin,
  ls,
  setLs,
  allSaved,
  onSave,
  onNext,
  onEdit,
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {t.sittingOut?.length > 0 && (
        <div
          style={{
            background: "#fbbf2422",
            border: "1px solid #fbbf2455",
            color: "#fbbf24",
            padding: 12,
            borderRadius: 8,
            fontSize: 14,
          }}
        >
          <span style={{ fontWeight: 700 }}>⏳ Descansan: </span>
          <span style={{ fontWeight: 500 }}>
            {t.sittingOut.map((p) => p.name).join(", ")}
          </span>
        </div>
      )}
      {(t.currentRound || []).map((court, ci) => {
        const sA = ls[`${ci}_A`] ?? court.scoreA;
        const sB = ls[`${ci}_B`] ?? court.scoreB;
        const a = parseInt(sA),
          b = parseInt(sB);
        const valid = !isNaN(a) && !isNaN(b) && a >= 0 && b >= 0 && a !== b;
        const isTie = !isNaN(a) && !isNaN(b) && a === b;
        const iStyle = (hi) => ({
          width: 52,
          textAlign: "center",
          fontSize: 22,
          fontWeight: 900,
          background: "#0f172a",
          border: `2px solid ${hi ? "#4ade80" : "#334155"}`,
          borderRadius: 8,
          color: "#f1f5f9",
          padding: "6px 0",
        });
        return (
          <div
            key={ci}
            style={{
              background: "#1e293b",
              borderRadius: 12,
              padding: 16,
              borderLeft: "4px solid #38bdf8",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginBottom: 12,
                fontSize: 13,
                color: "#94a3b8",
                fontWeight: 700,
              }}
            >
              <span>
                Pista {ci + 1}
                {ci === 0 && (
                  <span
                    style={{
                      marginLeft: 8,
                      background: "#f59e0b22",
                      color: "#fbbf24",
                      padding: "2px 6px",
                      borderRadius: 4,
                      fontSize: 10,
                    }}
                  >
                    👑 Principal
                  </span>
                )}
                {ci === t.config.courts - 1 && t.config.courts > 1 && (
                  <span
                    style={{
                      marginLeft: 8,
                      background: "#334155",
                      color: "#94a3b8",
                      padding: "2px 6px",
                      borderRadius: 4,
                      fontSize: 10,
                    }}
                  >
                    📉 Auxiliar
                  </span>
                )}
              </span>

              {court.saved && (
                <div
                  style={{ display: "flex", alignItems: "center", gap: "12px" }}
                >
                  <span style={{ color: "#4ade80" }}>✅ Guardado</span>
                  {isAdmin && (
                    <button
                      onClick={() => onEdit(ci)}
                      style={{
                        fontSize: 12,
                        color: "#f87171",
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        textDecoration: "underline",
                        fontWeight: 700,
                      }}
                    >
                      Editar
                    </button>
                  )}
                </div>
              )}
            </div>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
              }}
            >
              <div style={{ flex: 1, textAlign: "right" }}>
                <div
                  style={{
                    fontSize: 11,
                    color: "#64748b",
                    marginBottom: 4,
                    textTransform: "uppercase",
                    fontWeight: 700,
                  }}
                >
                  Pareja A
                </div>
                <div
                  style={{ fontWeight: 700, color: "#f1f5f9", fontSize: 14 }}
                >
                  <PName pair={court.pairA} />
                </div>
              </div>

              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  background: "#0f172a",
                  padding: "8px 12px",
                  borderRadius: 8,
                }}
              >
                {isAdmin && !court.saved ? (
                  <>
                    <input
                      type="number"
                      min="0"
                      onKeyDown={(e) => ["-", "e", ".", ","].includes(e.key) && e.preventDefault()}
                      value={sA}
                      onChange={(e) =>
                        setLs((p) => ({ ...p, [`${ci}_A`]: e.target.value }))
                      }
                      style={iStyle(!isNaN(a) && !isNaN(b) && a > b)}
                    />
                    <span style={{ color: "#64748b", fontWeight: 700 }}>
                      -
                    </span>
                    <input
                      type="number"
                      min="0"
                      onKeyDown={(e) => ["-", "e", ".", ","].includes(e.key) && e.preventDefault()}
                      value={sB}
                      onChange={(e) =>
                        setLs((p) => ({ ...p, [`${ci}_B`]: e.target.value }))
                      }
                      style={iStyle(!isNaN(a) && !isNaN(b) && b > a)}
                    />
                  </>
                ) : (
                  <div
                    style={{
                      fontSize: 24,
                      fontWeight: 900,
                      color: court.saved ? "#f1f5f9" : "#64748b",
                    }}
                  >
                    {court.scoreA || "-"}-{court.scoreB || "-"}
                  </div>
                )}
              </div>

              <div style={{ flex: 1, textAlign: "left" }}>
                <div
                  style={{
                    fontSize: 11,
                    color: "#64748b",
                    marginBottom: 4,
                    textTransform: "uppercase",
                    fontWeight: 700,
                  }}
                >
                  Pareja B
                </div>
                <div
                  style={{ fontWeight: 700, color: "#f1f5f9", fontSize: 14 }}
                >
                  <PName pair={court.pairB} />
                </div>
              </div>
            </div>

            {isTie && !court.saved && (
              <div
                style={{
                  textAlign: "center",
                  marginTop: 12,
                  fontSize: 13,
                  color: "#fbbf24",
                  fontWeight: 700,
                }}
              >
                ⚡ Empate - definir a punto de oro
              </div>
            )}
            {valid && !court.saved && (
              <div
                style={{
                  textAlign: "center",
                  marginTop: 12,
                  fontSize: 13,
                  color: "#4ade80",
                  fontWeight: 700,
                }}
              >
                ✓ Ganan <PName pair={a > b ? court.pairA : court.pairB} />
              </div>
            )}
            {isAdmin && !court.saved && (
              <button
                onClick={() => onSave(ci)}
                disabled={!valid}
                style={B(valid ? "#0284c7" : "#334155", {
                  width: "100%",
                  marginTop: 10,
                  borderRadius: 8,
                  padding: 10,
                  opacity: valid ? 1 : 0.5,
                  cursor: valid ? "pointer" : "not-allowed",
                })}
              >
                Guardar resultado
              </button>
            )}
          </div>
        );
      })}
      {allSaved && isAdmin && (
        <button
          onClick={onNext}
          style={B("#10b981", { width: "100%", padding: 16, fontSize: 16 })}
        >
          Siguiente Ronda ➔
        </button>
      )}
      {!isAdmin && !allSaved && (
        <div
          style={{
            textAlign: "center",
            color: "#64748b",
            padding: 20,
            fontSize: 14,
          }}
        >
          👀 Modo vista · Esperando resultados
        </div>
      )}
    </div>
  );
}

function StandingsAmericano({ rows, roundNum }) {
  return (
    <div style={{ background: "#1e293b", borderRadius: 12, padding: 16 }}>
      <div
        style={{
          fontWeight: 800,
          fontSize: 16,
          color: "#f1f5f9",
          marginBottom: 4,
        }}
      >
        🏆 Tabla - Ronda {roundNum}
      </div>
      <div style={{ fontSize: 12, color: "#64748b", marginBottom: 16 }}>
        1º Puntos · 2º Diferencia de games
      </div>
      <div style={{ display: "flex", flexDirection: "column" }}>
        {rows.map((p, i) => {
          const d = p.gf - p.gc;
          const m = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : null;
          return (
            <div
              key={p.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "10px 0",
                borderBottom:
                  i === rows.length - 1 ? "none" : "1px solid #334155",
              }}
            >
              <div
                style={{
                  width: 28,
                  textAlign: "center",
                  fontSize: m ? 20 : 16,
                  fontWeight: 800,
                  color: "#94a3b8",
                }}
              >
                {m || i + 1}
              </div>
              <div style={{ flex: 1 }}>
                <div
                  style={{
                    fontWeight: 700,
                    color: "#f1f5f9",
                    fontSize: 15,
                    marginBottom: 2,
                  }}
                >
                  {p.name}
                  <PTag p={p} />
                </div>
                <div style={{ fontSize: 12, color: "#64748b" }}>
                  GF {p.gf} · GC {p.gc} · Dif {d >= 0 ? "+" : ""}
                  {d}
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div
                  style={{ fontSize: 20, fontWeight: 900, color: "#38bdf8" }}
                >
                  {p.pts}
                </div>
                <div
                  style={{
                    fontSize: 10,
                    color: "#64748b",
                    textTransform: "uppercase",
                    fontWeight: 700,
                  }}
                >
                  pts
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
