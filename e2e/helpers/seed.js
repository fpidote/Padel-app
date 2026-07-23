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
  await db().collection("torneos").doc(code).delete();
}

export async function getTestToken(uid = TEST_UID) {
  return adminAuth().createCustomToken(uid);
}
