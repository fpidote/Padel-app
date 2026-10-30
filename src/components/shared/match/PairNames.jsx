// src/components/shared/match/PairNames.jsx
// Pareja en dos líneas ("Nombre /" y "Nombre"), alineada hacia el marcador. El espacio entre ambas hace que su
// texto siga siendo "Nombre / Nombre" para lectores de pantalla y al copiar.
export default function PairNames({ pair, align = "left", fallback = "Por definir" }) {
  const alignment = align === "right" ? "items-end text-right" : "items-start text-left";
  return (
    <div className={`flex flex-col self-center text-sm font-bold leading-snug text-gray-50 ${alignment}`}>
      {pair ? (
        <>
          <span>{pair.p1} /</span>{" "}
          <span>{pair.p2}</span>
        </>
      ) : (
        <span>{fallback}</span>
      )}
    </div>
  );
}
