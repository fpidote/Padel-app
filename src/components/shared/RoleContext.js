// Rol del usuario en este torneo, para el encabezado: lo provee TournamentPage
import { createContext } from "react";

export const RoleContext = createContext({ isHelper: false, onHelpers: undefined });
