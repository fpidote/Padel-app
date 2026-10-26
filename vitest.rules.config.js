// Configuración de Vitest solo para los tests de Firestore Security Rules (requieren el emulador).
// `npm test` no los incluye; se ejecutan con `npm run test:rules`.
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["firestore.rules.test.js"],
  },
});
