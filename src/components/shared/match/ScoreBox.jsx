// src/components/shared/match/ScoreBox.jsx
import { scoreInputProps } from "../../../logic/scoreInput";

// Caja de marcador ya guardado: la del ganador va en verde
export function ScoreBox({ value, won = false, onClick }) {
  return (
    <div
      onClick={onClick}
      className={`font-data w-11 h-11 rounded-xl flex items-center justify-center text-[22px] font-bold ${
        won ? "bg-green-500/10 border border-green-500/30 text-green-400" : "bg-white/[0.04] border border-white/[0.07] text-slate-400"
      } ${onClick ? "cursor-pointer" : ""}`}
      style={won ? { animation: "score-pop 0.3s ease-out" } : undefined}
    >
      {value}
    </div>
  );
}

// Casilla de marcador editable. El número va siempre en blanco; el color del formato solo marca el borde.
// size: "games" (44×44) o "set" (44×36, una fila por set)
export function ScoreInput({ value, onChange, accentColor, size = "games", error = false, ...rest }) {
  const dims = size === "set" ? "h-9 rounded-lg text-base" : "h-11 rounded-xl text-[22px]";
  return (
    <input
      type="number"
      min="0"
      {...scoreInputProps}
      {...rest}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`font-data w-11 ${dims} bg-white/[0.04] border-[1.5px] ${error ? "border-red-500/60" : "border-white/10"} text-center font-bold text-[#f1f5f9] outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none transition-all`}
      style={value !== "" && !error ? { borderColor: `${accentColor}b3`, boxShadow: `0 0 0 3px ${accentColor}1f` } : undefined}
    />
  );
}
