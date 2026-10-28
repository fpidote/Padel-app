// src/components/play/CrossingsProjection.jsx
// Pestaña "Eliminatoria" mientras se juegan los grupos: cómo se armará el cuadro final.
import { crossingMode, classicFirstRound, projectedFirstRound, extraQualifiersText } from "../../logic/mundialito";

const names = (p) => `${p.p1} / ${p.p2}`;

function Row({ left, right, muted = false }) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-[#334155] bg-[#0f172a] px-4 py-3">
      <span className="flex-1 text-right font-extrabold text-[#f1f5f9]">{left}</span>
      <span className="mx-4 font-black text-[#38bdf8]">VS</span>
      <span className={`flex-1 text-left font-extrabold ${muted ? "text-[#94a3b8]" : "text-[#f1f5f9]"}`}>{right}</span>
    </div>
  );
}

export default function CrossingsProjection({ groups, config }) {
  const advance = config.advancePerGroup || 2;
  const extra = extraQualifiersText(advance, config.extraQualifiers);
  const classic = crossingMode(config) === "classic";
  const projection = classic ? null : projectedFirstRound(groups, config);
  const groupName = (i) => groups[i]?.name || `Grupo ${i + 1}`;

  return (
    <div className="rounded-xl bg-[#1e293b] p-5">
      <h3 className="mb-2 text-center text-[18px] font-black text-[#38bdf8]">🔮 Proyección de Cruces</h3>

      {classic ? (
        <>
          <p className="mb-5 text-center text-[13px] text-[#94a3b8]">
            Cruces de la primera ronda del cuadro final. Pasan los 2 primeros de cada grupo.
          </p>
          <div className="flex flex-col gap-3">
            {classicFirstRound(groups.length).map(([a, b]) => (
              <Row key={`${a.group}-${b.group}-${a.pos}`} left={`${a.pos}º ${groupName(a.group)}`} right={`${b.pos}º ${groupName(b.group)}`} muted />
            ))}
          </div>
        </>
      ) : (
        <>
          <p className="mb-4 text-center text-[13px] text-[#94a3b8]">
            Pasan los {advance} primeros de cada grupo{extra ? ` y ${extra}` : ""}. Los cruces se arman al terminar los grupos: se enfrenta al mejor clasificado contra el peor, sin repetir grupo en la primera ronda cuando se puede.
          </p>
          {projection && (
            <>
              <div className="mb-2 text-center text-[11px] font-bold uppercase text-[#f59e0b]">
                Provisional: si los grupos terminaran hoy
              </div>
              <div className="flex flex-col gap-3">
                {projection.map((m) => {
                  const free = m.pairA?.id === "bye" || m.pairB?.id === "bye";
                  const real = m.pairA?.id === "bye" ? m.pairB : m.pairA;
                  return free ? (
                    <div key={m.id} className="rounded-lg border border-[#334155] bg-[#0f172a] px-4 py-3 text-center font-extrabold text-[#f1f5f9]">
                      {names(real)} <span className="ml-2 text-[12px] text-[#4ade80]">Pasa directo</span>
                    </div>
                  ) : (
                    <Row key={m.id} left={names(m.pairA)} right={names(m.pairB)} />
                  );
                })}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
