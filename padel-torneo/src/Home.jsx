import { useState } from "react";
import { B, TOURNAMENT_TYPES } from "./logic/constants.js";

export default function Home({ joinVal, setJoinVal, onCreate, onJoin }) {
  const [creating, setCreating] = useState(false);
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
