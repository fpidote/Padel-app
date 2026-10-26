// src/components/setup/DrawPreview.jsx
// Contenido de la pestaña de sorteo en "Revisar y lanzar" para Mundialito y Liga.

const names = (p) => `${p.p1} / ${p.p2}`;
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

export function GroupsPreview({ groups, advancePerGroup }) {
  return (
    <div className="px-4 py-4 space-y-3">
      <p className="text-xs text-gray-500">
        Por grupo {advancePerGroup === 1 ? "avanza 1 pareja" : `avanzan ${advancePerGroup} parejas`} a la eliminatoria.
      </p>
      {groups.map((group) => (
        <div key={group.id} className="bg-[#1f2937] border border-gray-700 rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-800">
            <span className="text-xs font-bold text-gray-300 uppercase tracking-wider">{group.name}</span>
            <span className="text-xs text-gray-500">{plural(group.matches.length, "partido", "partidos")}</span>
          </div>
          <div className="px-4 py-3 space-y-1.5">
            {group.pairs.map((p) => (
              <div key={p.id} className="text-sm font-medium text-gray-100">{names(p)}</div>
            ))}
            {group.pairs.length < 2 && (
              <div className="text-xs text-yellow-400">⚠️ Grupo con menos de 2 parejas: no tendrá partidos</div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

export function FixturePreview({ rounds, matches }) {
  return (
    <div className="px-4 py-4 space-y-5">
      {rounds.map((round) => (
        <div key={round.round}>
          <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Jornada {round.round}</div>
          <div className="space-y-2">
            {matches
              .filter((m) => m.round === round.round)
              .map((m) => (
                <div key={m.id} className="bg-[#1f2937] rounded-xl px-3 py-2.5 border border-gray-700 text-sm text-gray-100 flex flex-wrap items-center gap-x-1">
                  <span className="font-medium">{names(m.pairA)}</span>
                  <span className="text-gray-500 text-xs font-bold mx-1">vs</span>
                  <span className="font-medium">{names(m.pairB)}</span>
                </div>
              ))}
          </div>
        </div>
      ))}
    </div>
  );
}

const isBye = (p) => !p || p.id === "bye";

export function BracketPreview({ bracket, seeded = false }) {
  const first = bracket
    .filter((m) => m.bracket === "winners" && m.round === 1)
    .sort((a, b) => a.matchIndex - b.matchIndex);
  return (
    <div className="px-4 py-4 space-y-3">
      <p className="text-xs text-gray-500">
        {seeded
          ? "Cabezas de serie: se respeta el orden de carga y las primeras parejas pasan directo cuando sobran lugares."
          : "Quien pierde pasa al cuadro de revancha."}
      </p>
      <div className="text-xs font-bold text-gray-400 uppercase tracking-wider">Primera ronda</div>
      <div className="space-y-2">
        {first.map((m) => {
          const free = isBye(m.pairA) || isBye(m.pairB);
          const real = isBye(m.pairA) ? m.pairB : m.pairA;
          return (
            <div key={m.id} className="bg-[#1f2937] rounded-xl px-3 py-2.5 border border-gray-700 text-sm text-gray-100 flex flex-wrap items-center gap-x-1">
              {free ? (
                <>
                  <span className="font-medium">{names(real)}</span>
                  <span className="ml-2 text-xs font-bold text-green-400">Pasa directo</span>
                </>
              ) : (
                <>
                  <span className="font-medium">{names(m.pairA)}</span>
                  <span className="text-gray-500 text-xs font-bold mx-1">vs</span>
                  <span className="font-medium">{names(m.pairB)}</span>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
