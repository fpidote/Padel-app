// Aviso de quién descansa en una jornada de Liga (solo aparece con cantidad impar de parejas).
import { ligaRestingPairs } from "../../logic/liga";

export default function RestingNote({ matches, round }) {
  const resting = ligaRestingPairs(matches, round);
  if (resting.length === 0) return null;
  const text = `😴 Descansa: ${resting.map((p) => `${p.p1} / ${p.p2}`).join(", ")}`;
  return <div className="text-xs font-semibold text-amber-400 mb-2">{text}</div>;
}
