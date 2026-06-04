// ── Americano Logic ──────────────────────────────────────────
import { shuffle, pk } from "./utils";

// ── Penalty weights ───────────────────────────────────────────
// REST_IMBALANCE is enforced at sitting-out selection (selectSittingOut),
// NOT inside scoredSplit — applying it twice would double-count rest pressure.
export const PENALTY = {
  PARTNER_REPEAT: 1000,
  ADVANCED_PAIR: 5000,
  COURT_REPEAT: 500,
  REST_IMBALANCE: 2000,
  MATCH_IMBALANCE: 400,
  OPPONENT_REPEAT: 300,
};

// ── Relaxation thresholds ─────────────────────────────────────
// Index 0 = strict, index 1 = relax court repeat,
// index 2 = relax partner repeat, attempt 3 uses Infinity (always accept).
export const RELAX_THRESHOLDS = [2000, 6000, 15000];

// ── scoredSplit ───────────────────────────────────────────────
// Evaluates the 3 possible pair-splits for a group of 4 players and
// returns the split with the lowest penalty score given current state and weights.
// REST_IMBALANCE is NOT in this formula — enforced at selectSittingOut, not here.
function scoredSplit(group, courtIndex, state, weights) {
  const { ph, courtHistory, oh = {} } = state;

  const opts = [
    [[group[0], group[1]], [group[2], group[3]]],
    [[group[0], group[2]], [group[1], group[3]]],
    [[group[0], group[3]], [group[1], group[2]]],
  ];

  let best = null;
  let bestScore = Infinity;

  opts.forEach(([pA, pB]) => {
    let score = 0;

    // Partner repeat penalty
    score += (ph[pk(pA[0].id, pA[1].id)] || 0) * (weights.PARTNER_REPEAT ?? PENALTY.PARTNER_REPEAT);
    score += (ph[pk(pB[0].id, pB[1].id)] || 0) * (weights.PARTNER_REPEAT ?? PENALTY.PARTNER_REPEAT);

    // Advanced+Advanced pair penalty
    // Skipped when ADVANCED_PAIR weight is 0 (unsatisfiable constraint or attempt 3)
    const apWeight = weights.ADVANCED_PAIR ?? PENALTY.ADVANCED_PAIR;
    if (apWeight > 0) {
      if (highLevelClash(pA)) score += apWeight;
      if (highLevelClash(pB)) score += apWeight;
    }

    // Court repeat penalty (for all 4 players on this court)
    // Court keys use format "${id}_c${courtIndex}" — safe because player IDs are integers 0..N
    // and no integer formatted as string contains "_c".
    const crWeight = weights.COURT_REPEAT ?? PENALTY.COURT_REPEAT;
    [...pA, ...pB].forEach((p) => {
      score += (courtHistory[`${p.id}_c${courtIndex}`] || 0) * crWeight;
    });

    // Team level-balance penalty — prefers splits where both teams have equal total level.
    // Distinguishes AM vs AM (balance=0) from AA vs MM (balance=2) when ADVANCED_PAIR
    // gives equal scores for both (e.g. when all players are level>=3).
    score += matchBalance(pA, pB) * (weights.MATCH_IMBALANCE ?? PENALTY.MATCH_IMBALANCE);

    // Opponent repeat penalty — softly diversifies who faces whom across rounds.
    // Applied per cross-team pair so accumulated history nudges the algorithm
    // toward new opponent combinations without breaking team balance.
    const orWeight = weights.OPPONENT_REPEAT ?? PENALTY.OPPONENT_REPEAT;
    pA.forEach((a) => pB.forEach((b) => {
      score += (oh[pk(a.id, b.id)] || 0) * orWeight;
    }));

    if (score < bestScore) {
      bestScore = score;
      best = [pA, pB];
    }
  });

  return { pairs: best, score: bestScore };
}

// ── selectSittingOut ──────────────────────────────────────────
// Selects which players sit out each round.
// Sort priority:
//   1. Fewest total rests (soh) — primary fairness criterion
//   2. Longest consecutive rounds played without rest (streak desc) — tie-break
//   3. Random — eliminates ID-order bias when streak also ties
function selectSittingOut(entities, courts, soh, streak = {}) {
  const activeCourts = Math.min(courts, Math.floor(entities.length / 4));
  const cnt = entities.length - activeCourts * 4;

  if (cnt <= 0) return { active: entities, sittingOut: [] };

  const pool = shuffle([...entities])
    .map((p) => ({ ...p, _soh: soh[p.id] || 0, _streak: streak[p.id] || 0 }))
    .sort((a, b) =>
      a._soh !== b._soh ? a._soh - b._soh : b._streak - a._streak
    );

  const sittingOutIds = new Set(pool.slice(0, cnt).map((p) => p.id));
  return {
    sittingOut: entities.filter((p) => sittingOutIds.has(p.id)),
    active: entities.filter((p) => !sittingOutIds.has(p.id)),
  };
}

// ── levelSortedWithShuffle ────────────────────────────────────
// Groups active players by level descending, shuffles within each level group,
// then concatenates — gives the penalty engine variety while keeping level separation.
function levelSortedWithShuffle(active) {
  const byLevel = {};
  active.forEach((p) => {
    const l = p.level || 0;
    if (!byLevel[l]) byLevel[l] = [];
    byLevel[l].push(p);
  });

  const levels = Object.keys(byLevel).map(Number).sort((a, b) => b - a);
  return levels.flatMap((l) => shuffle(byLevel[l]));
}

// Returns { rounds: Array<{courts, sittingOut}>, warnings: Array<{round, constraint, message}> }
export function precomputeAllRounds(entities, config) {
  const { courts, mode = "individual", maxRounds } = config;
  const isPairs = mode === "pairs";

  // Pairs mode: sin pre-cálculo nivel-aware; retornar null para que el caller lo omita
  if (isPairs) return { rounds: null, warnings: [] };

  const totalRounds = maxRounds ?? Math.min(entities.length - 1, 12); // cap matches existing stub formula
  const activeCourts = Math.min(courts, Math.floor(entities.length / 4));

  // ALGO-05: Pre-comprobación de restricción imposible (D-12)
  // Cuando advancedCount >= 2 * activeCourts, la restricción ADVANCED_PAIR es matemáticamente
  // insatisfactible — excluir la penalización para todas las rondas y no emitir 'advanced_pair' warnings.
  const advancedCount = entities.filter((p) => (p.level || 0) >= 3).length;
  // > (strict) — only disable the penalty when M+M partners are mathematically unavoidable
  // (more than 2 M players per court on average). With exactly 2*activeCourts M's,
  // consecutive grouping puts 2 M's per court and scoredSplit can still pair them as opponents.
  const advancedPairingAllowed = advancedCount > 2 * activeCourts;

  // Estado mutable compartido entre rondas (objetos planos — D-02)
  const ph = {};            // historial de parejas: { "0_1": 2, ... }
  const oh = {};            // historial de rivales: { "0_1": 3, ... }
  const courtHistory = {};  // historial de canchas: { "3_c0": 1, ... }
  const soh = {};           // historial de descanso: { 5: 1, ... }
  const streak = {};        // rondas consecutivas jugadas sin descanso: { 5: 3, ... }

  const rounds = [];
  const warnings = [];

  // Configuraciones de relajación — 4 intentos con pesos progresivamente más permisivos
  // Si advancedPairingAllowed=true, ADVANCED_PAIR se anula en todos los niveles (D-12)
  const RELAX_CONFIGS = [
    {
      weights: advancedPairingAllowed
        ? { ...PENALTY, ADVANCED_PAIR: 0 }
        : { ...PENALTY },
      threshold: RELAX_THRESHOLDS[0], // 2000 — estricto
    },
    {
      weights: advancedPairingAllowed
        ? { ...PENALTY, COURT_REPEAT: 0, ADVANCED_PAIR: 0 }
        : { ...PENALTY, COURT_REPEAT: 0 },
      threshold: RELAX_THRESHOLDS[1], // 6000 — relajar repetición de cancha
    },
    {
      weights: advancedPairingAllowed
        ? { ...PENALTY, COURT_REPEAT: 0, PARTNER_REPEAT: 100, ADVANCED_PAIR: 0 }
        : { ...PENALTY, COURT_REPEAT: 0, PARTNER_REPEAT: 100 },
      threshold: RELAX_THRESHOLDS[2], // 15000 — relajar repetición de pareja
    },
    {
      weights: { ...PENALTY, COURT_REPEAT: 0, PARTNER_REPEAT: 100, ADVANCED_PAIR: 0 },
      threshold: Infinity, // intento 3: aceptar siempre
    },
  ];

  for (let r = 0; r < totalRounds; r++) {
    // Variables locales al loop de ronda (D-08 — las banderas de relajación no se filtran entre rondas)
    const { active, sittingOut } = selectSittingOut(entities, courts, soh, streak);
    const sorted = levelSortedWithShuffle(active);

    const topHalf = sorted.slice(0, activeCourts * 2);
    const botHalf = sorted.slice(activeCourts * 2);

    const cs = [];
    // Set de restricciones que dispararon relaxación en esta ronda (colapsado por tipo — Open Question 2)
    const constraintsRelaxed = new Set();
    let maxAttemptUsed = 0;

    // Consecutive indexing: clusters 2 M's per group so scoredSplit can pair them
    // as opponents (M+P vs M+P). Then shuffle groups so advanced players aren't
    // always assigned to courts 0,1 — any court can get the M vs M match.
    const groups = [];
    for (let c = 0; c < activeCourts; c++) {
      groups.push([topHalf[c * 2], topHalf[c * 2 + 1], botHalf[c * 2], botHalf[c * 2 + 1]]);
    }
    const shuffledGroups = shuffle(groups);

    for (let c = 0; c < activeCourts; c++) {
      const group = shuffledGroups[c];

      let accepted = null;
      let attemptUsed = 0;

      for (let attempt = 0; attempt < RELAX_CONFIGS.length; attempt++) {
        const { weights, threshold } = RELAX_CONFIGS[attempt];
        const { pairs, score } = scoredSplit(group, c, { ph, oh, courtHistory }, weights);

        if (score <= threshold || attempt === RELAX_CONFIGS.length - 1) {
          accepted = pairs;
          attemptUsed = attempt;
          break;
        }
      }

      if (attemptUsed > maxAttemptUsed) maxAttemptUsed = attemptUsed;

      // Registrar qué restricciones se relajaron en esta cancha
      if (attemptUsed >= 1) constraintsRelaxed.add("court_repeat");
      if (attemptUsed >= 2) constraintsRelaxed.add("partner_repeat");
      if (attemptUsed >= 3 && !advancedPairingAllowed) constraintsRelaxed.add("advanced_pair");

      const [pA, pB] = accepted;
      cs.push({ pairA: pA, pairB: pB, scoreA: "", scoreB: "", saved: false });
    }

    // Emitir un warning por tipo de restricción relajada en esta ronda (D-09, D-11)
    for (const constraint of constraintsRelaxed) {
      let message;
      if (constraint === "partner_repeat") {
        message = `Ronda ${r + 1}: repetición de pareja permitida (sin combinación válida disponible)`;
      } else if (constraint === "court_repeat") {
        message = `Ronda ${r + 1}: repetición de cancha permitida (sin combinación sin repetición disponible)`;
      } else {
        message = `Ronda ${r + 1}: pareja de nivel avanzado permitida (restricción relajada)`;
      }
      warnings.push({ round: r + 1, constraint, message });
    }

    rounds.push({ courts: cs, sittingOut });

    // Actualizar estado después de la ronda
    // Actualizar courtHistory con claves "${id}_c${courtIndex}"
    // Seguro porque los IDs son enteros 0..N y ningún entero formateado como string contiene "_c"
    cs.forEach((court, ci) => {
      const kA = pk(court.pairA[0].id, court.pairA[1].id);
      const kB = pk(court.pairB[0].id, court.pairB[1].id);
      ph[kA] = (ph[kA] || 0) + 1;
      ph[kB] = (ph[kB] || 0) + 1;

      court.pairA.forEach((a) => court.pairB.forEach((b) => {
        const k = pk(a.id, b.id);
        oh[k] = (oh[k] || 0) + 1;
      }));

      [...court.pairA, ...court.pairB].forEach((p) => {
        const key = `${p.id}_c${ci}`;
        courtHistory[key] = (courtHistory[key] || 0) + 1;
      });
    });

    sittingOut.forEach((p) => {
      soh[p.id] = (soh[p.id] || 0) + 1;
      streak[p.id] = 0;
    });
    active.forEach((p) => {
      streak[p.id] = (streak[p.id] || 0) + 1;
    });
  }

  return { rounds, warnings };
}

function highLevelClash(pair) {
  return pair.every((p) => (p.level || 0) >= 3) ? 1 : 0;
}

function matchBalance(pA, pB) {
  const sumA = pA.reduce((s, p) => s + (p.level || 0), 0);
  const sumB = pB.reduce((s, p) => s + (p.level || 0), 0);
  return Math.abs(sumA - sumB);
}

function bestSplit(g, ph) {
  const opts = [
    [
      [g[0], g[1]],
      [g[2], g[3]],
    ],
    [
      [g[0], g[2]],
      [g[1], g[3]],
    ],
    [
      [g[0], g[3]],
      [g[1], g[2]],
    ],
  ];
  let best = opts[0],
    bs = Infinity;
  opts.forEach(([pA, pB]) => {
    const sc =
      (ph[pk(pA[0].id, pA[1].id)] || 0) * 12 +
      (ph[pk(pB[0].id, pB[1].id)] || 0) * 12 +
      highLevelClash(pA) * 15 +
      highLevelClash(pB) * 15 +
      matchBalance(pA, pB) * Math.floor(12 * PENALTY.MATCH_IMBALANCE / PENALTY.PARTNER_REPEAT);
    if (sc < bs) {
      bs = sc;
      best = [pA, pB];
    }
  });
  return best;
}

export function buildFirstRoundAmericano(
  entities,
  courts,
  mode = "individual",
) {
  const isPairs = mode === "pairs";
  const units = isPairs ? 2 : 4;
  const activeCourts = Math.min(courts, Math.floor(entities.length / units));
  const cs = [];

  if (isPairs) {
    const all = shuffle(entities);
    const act = all.slice(0, activeCourts * units);
    const sit = all.slice(activeCourts * units);
    for (let c = 0; c < activeCourts; c++) {
      cs.push({
        pairA: act[c * 2],
        pairB: act[c * 2 + 1],
        scoreA: "",
        scoreB: "",
        saved: false,
      });
    }
    return { courts: cs, sittingOut: sit };
  }

  // Individual: group by level desc (shuffle within each level group), then split into
  // top half + bottom half — interleaved indexing [c] / [c + activeCourts] spreads
  // advanced players across courts instead of concentrating them on court 0.
  const sorted = levelSortedWithShuffle(entities);
  const act = sorted.slice(0, activeCourts * units);
  const sit = sorted.slice(activeCourts * units);
  const topH = act.slice(0, activeCourts * 2);
  const botH = act.slice(activeCourts * 2);
  const groups = [];
  for (let c = 0; c < activeCourts; c++) {
    groups.push([topH[c * 2], topH[c * 2 + 1], botH[c * 2], botH[c * 2 + 1]]);
  }
  for (const g of shuffle(groups)) {
    const [pA, pB] = bestSplit(g, {});
    cs.push({ pairA: pA, pairB: pB, scoreA: "", scoreB: "", saved: false });
  }
  return { courts: cs, sittingOut: sit };
}

export function buildRoundAmericano(entities, n, ph, soh, mode = "individual") {
  const isPairs = mode === "pairs";
  const units = isPairs ? 2 : 4;
  const sorted = [...entities].sort((a, b) =>
    b.pts !== a.pts ? b.pts - a.pts : b.gf - b.gc - (a.gf - a.gc),
  );
  const activeCourts = Math.min(n, Math.floor(sorted.length / units));
  const cnt = sorted.length - activeCourts * units;
  let active = sorted, sittingOut = [];
  if (cnt > 0) {
    const pool = sorted
      .slice(-Math.max(cnt * 2, cnt + 2))
      .map((p) => ({ ...p, ss: soh[p.id] || 0 }))
      .sort((a, b) => a.ss !== b.ss ? a.ss - b.ss : a.pts - b.pts);
    const ids = new Set(pool.slice(0, cnt).map((p) => p.id));
    sittingOut = sorted.filter((p) => ids.has(p.id));
    active = sorted.filter((p) => !ids.has(p.id));
  }
  const cs = [];
  if (isPairs) {
    for (let c = 0; c < activeCourts; c++) {
      cs.push({
        pairA: active[c * 2],
        pairB: active[c * 2 + 1],
        scoreA: "",
        scoreB: "",
        saved: false,
      });
    }
  } else {
    const topH = active.slice(0, activeCourts * 2);
    const botH = active.slice(activeCourts * 2);
    const groups = [];
    for (let c = 0; c < activeCourts; c++) {
      groups.push([topH[c * 2], topH[c * 2 + 1], botH[c * 2], botH[c * 2 + 1]]);
    }
    for (const g of shuffle(groups)) {
      const [pA, pB] = bestSplit(g, ph);
      cs.push({ pairA: pA, pairB: pB, scoreA: "", scoreB: "", saved: false });
    }
  }
  return { courts: cs, sittingOut };
}
