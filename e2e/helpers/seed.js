// Firebase Admin helpers for seeding test data in the emulator.
// Requires FIRESTORE_EMULATOR_HOST and FIREBASE_AUTH_EMULATOR_HOST to be set
// by `firebase emulators:exec` before this module is imported.
import { initializeApp, getApps } from "firebase-admin/app";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";

export const TEST_UID = "e2e-test-owner";

function adminApp() {
  return getApps()[0] ?? initializeApp({ projectId: "app-padel-torneo" });
}

function db() { return getFirestore(adminApp()); }
function adminAuth() { return getAuth(adminApp()); }

// 4 players, 1 court — minimal valid setup for an americano tournament
const DEFAULT_PLAYER_INPUTS = [
  { name: "Alice", level: 2 },
  { name: "Bob",   level: 1 },
  { name: "Carol", level: 2 },
  { name: "Dave",  level: 1 },
];

export function makeTournamentData(overrides = {}) {
  return {
    ver: 1,
    type: "americano",
    status: "setup",
    ownerUid: TEST_UID,
    config: {
      name: "Torneo E2E",
      courts: 1,
      matchmaking: "americano",
      mode: "individual",
      scoringSystem: "timed",
      matchMinutes: 10,
      maxRounds: 3,
      useLevels: true,
      goldenPoint: true,
    },
    playerInputs: DEFAULT_PLAYER_INPUTS,
    pairInputs: [],
    players: [],
    pairs: [],
    rounds: [],
    currentRound: null,
    sittingOut: [],
    partnerHistory: {},
    sitOutHistory: {},
    roundNum: 1,
    ...overrides,
  };
}

export async function seedTournament(code, overrides = {}) {
  const data = makeTournamentData(overrides);
  // Sin restos de una prueba anterior (borrar el documento no borra sus subcolecciones, como helpers)
  await db().recursiveDelete(db().collection("torneos").doc(code));
  await db().collection("torneos").doc(code).set({
    data: JSON.stringify(data),
    ownerUid: TEST_UID,
    createdAt: Timestamp.now(),
  });
  return data;
}

export async function getTournamentData(code) {
  const snap = await db().collection("torneos").doc(code).get();
  return snap.exists ? JSON.parse(snap.data().data) : null;
}

export async function deleteTournament(code) {
  await db().recursiveDelete(db().collection("torneos").doc(code));
}

// Con claims = { email, email_verified }, el usuario se crea (o actualiza) en el emulador con ese correo
// verificado: el emulador no copia a los tokens personalizados un `email` puesto como claim, pero sí el
// correo del usuario, y así llega a las reglas como request.auth.token.email (como con Google).
export async function getTestToken(uid = TEST_UID, claims) {
  if (claims?.email) {
    const props = { email: claims.email, emailVerified: claims.email_verified !== false };
    try {
      await adminAuth().updateUser(uid, props);
    } catch (err) {
      if (err.code !== "auth/user-not-found") throw err;
      await adminAuth().createUser({ uid, ...props });
    }
  }
  return adminAuth().createCustomToken(uid);
}

// Ayudantes: torneos/{code}/helpers/{correo en minúsculas}
export async function addHelper(code, email) {
  await db().collection("torneos").doc(code).collection("helpers").doc(email.toLowerCase()).set({ addedAt: Timestamp.now() });
}

export async function removeHelper(code, email) {
  await db().collection("torneos").doc(code).collection("helpers").doc(email.toLowerCase()).delete();
}
