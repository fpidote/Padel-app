// src/components/shared/PodiumCard.jsx
// Podio de un torneo con fase final (Torneo por grupos y Liga con eliminatoria).
const name = (p) => `${p.p1} / ${p.p2}`;

function Row({ icon, label, children }) {
  return (
    <div className="flex items-center gap-3 rounded-lg bg-[#0f172a] px-3 py-2.5">
      <span className="text-[22px]">{icon}</span>
      <div className="min-w-0">
        <div className="text-[11px] font-bold uppercase text-[#94a3b8]">{label}</div>
        <div className="text-[15px] font-extrabold text-[#f1f5f9]">{children}</div>
      </div>
    </div>
  );
}

// hasThird: el torneo tiene partido por el 3.º puesto. Sin él los dos perdedores de semifinales
// quedan empatados, así que se muestran juntos como semifinalistas en lugar de inventar un tercero.
export default function PodiumCard({ podium, hasThird, semifinalists = [], finished = false }) {
  if (!podium?.champion) return null;
  return (
    <div className="mb-4 rounded-xl border-2 border-[#f59e0b] bg-[#1e293b] p-4">
      <div className="mb-3 text-center text-[12px] font-bold uppercase text-[#f59e0b]">
        {finished ? "🏁 Torneo finalizado" : "Resultado final"}
      </div>
      <div className="flex flex-col gap-2">
        <Row icon="🏆" label="Campeón">{name(podium.champion)}</Row>
        <Row icon="🥈" label="Subcampeón">{podium.runnerUp ? name(podium.runnerUp) : "Por definir"}</Row>
        {hasThird && <Row icon="🥉" label="Tercer puesto">{podium.third ? name(podium.third) : "Por definir"}</Row>}
        {!hasThird && semifinalists.length > 0 && (
          <Row icon="🥉" label="Semifinalistas">
            {semifinalists.map((p) => (
              <div key={p.id}>{name(p)}</div>
            ))}
          </Row>
        )}
      </div>
    </div>
  );
}
