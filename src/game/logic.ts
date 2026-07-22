import { capitals, pickClue, type Capital } from "../data/capitals";
import { connectedIds, getRoute, type Route, type Transport } from "../data/routes";

export const WIN_STREAK = 5;

export type Phase =
  | "title"
  | "playing"
  | "traveling"
  | "arrival"
  | "backtracking"
  | "won";

export type TravelLeg = {
  from: string;
  to: string;
  transport: Transport;
  distanceMiles: number;
  correct: boolean;
  isBacktrack: boolean;
};

export type GameState = {
  phase: Phase;
  playerCity: string;
  spyTarget: string;
  clue: string;
  streak: number;
  attempts: number;
  travel: TravelLeg | null;
  lastResult: "correct" | "wrong" | null;
  visited: string[];
  message: string;
};

function randomOf<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)]!;
}

function chooseSpyTarget(fromId: string, avoid?: string): string {
  const options = connectedIds(fromId).filter((id) => id !== avoid);
  const pool = options.length > 0 ? options : connectedIds(fromId);
  return randomOf(pool);
}

function clueFor(targetId: string, salt: number): string {
  const city = capitals.find((c) => c.id === targetId)!;
  return pickClue(city, salt);
}

export function createInitialState(): GameState {
  return {
    phase: "title",
    playerCity: "NY",
    spyTarget: "NY",
    clue: "",
    streak: 0,
    attempts: 0,
    travel: null,
    lastResult: null,
    visited: [],
    message: "",
  };
}

export function startGame(preferredStart?: string): GameState {
  // Start somewhere with several connections (skip AK/HI as start).
  const starters = capitals.filter((c) => connectedIds(c.id).length >= 3);
  const forced = preferredStart
    ? capitals.find((c) => c.id === preferredStart)
    : undefined;
  const start =
    forced ?? randomOf(starters.length ? starters : capitals);
  const target = chooseSpyTarget(start.id);
  return {
    phase: "playing",
    playerCity: start.id,
    spyTarget: target,
    clue: clueFor(target, Date.now()),
    streak: 0,
    attempts: 0,
    travel: null,
    lastResult: null,
    visited: [start.id],
    message: `You start in ${start.capital}, ${start.state}. The spy just left a clue…`,
  };
}

export function getCapital(id: string): Capital {
  return capitals.find((c) => c.id === id)!;
}

export function beginTravel(
  state: GameState,
  destinationId: string,
): GameState {
  if (state.phase !== "playing") return state;
  const route = getRoute(state.playerCity, destinationId);
  if (!route) return state;

  const correct = destinationId === state.spyTarget;
  return {
    ...state,
    phase: "traveling",
    attempts: state.attempts + 1,
    travel: {
      from: state.playerCity,
      to: destinationId,
      transport: route.transport,
      distanceMiles: route.distanceMiles,
      correct,
      isBacktrack: false,
    },
    lastResult: null,
    message: correct
      ? "You're on the spy's trail!"
      : "Hmm… that trail feels cold…",
  };
}

export function finishTravel(state: GameState): GameState {
  if (state.phase !== "traveling" || !state.travel) return state;
  const { to, correct } = state.travel;

  if (correct) {
    const newStreak = state.streak + 1;
    if (newStreak >= WIN_STREAK) {
      return {
        ...state,
        phase: "won",
        playerCity: to,
        streak: newStreak,
        travel: state.travel,
        lastResult: "correct",
        visited: [...state.visited, to],
        message: "You caught the spy!",
      };
    }
    return {
      ...state,
      phase: "arrival",
      playerCity: to,
      streak: newStreak,
      lastResult: "correct",
      visited: [...state.visited, to],
      message: `Hot trail! ${newStreak} in a row!`,
    };
  }

  // Wrong city — land briefly, then backtrack.
  return {
    ...state,
    phase: "arrival",
    playerCity: to,
    streak: 0,
    lastResult: "wrong",
    visited: [...state.visited, to],
    message: "Wrong city! Backtrack and try again.",
  };
}

export function continueAfterArrival(state: GameState): GameState {
  if (state.phase !== "arrival" || !state.travel) return state;

  if (state.lastResult === "wrong") {
    const backFrom = state.travel.to;
    const backTo = state.travel.from;
    const route = getRoute(backFrom, backTo)!;
    return {
      ...state,
      phase: "backtracking",
      travel: {
        from: backFrom,
        to: backTo,
        transport: route.transport,
        distanceMiles: route.distanceMiles,
        correct: false,
        isBacktrack: true,
      },
      message: "Heading back to pick up the trail…",
    };
  }

  // Correct — spy flees to a new connected capital.
  const nextTarget = chooseSpyTarget(state.playerCity, state.spyTarget);
  return {
    ...state,
    phase: "playing",
    spyTarget: nextTarget,
    clue: clueFor(nextTarget, state.attempts + state.streak),
    travel: null,
    lastResult: null,
    message: "The spy slipped away again. New clue!",
  };
}

export function finishBacktrack(state: GameState): GameState {
  if (state.phase !== "backtracking" || !state.travel) return state;
  return {
    ...state,
    phase: "playing",
    playerCity: state.travel.to,
    travel: null,
    lastResult: null,
    message: "You're back. Read the clue carefully!",
  };
}

export function routeLabel(route: Route): string {
  const city = getCapital(route.to);
  return `${city.capital}, ${city.abbrev}`;
}
