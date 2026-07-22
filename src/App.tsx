import { useCallback, useEffect, useMemo, useState } from "react";
import { GameMap, useTravelProgress } from "./components/GameMap";
import { GameHUD, TravelBanner } from "./components/GameHUD";
import { ArrivalOverlay, TitleScreen, WinOverlay } from "./components/Overlays";
import {
  beginTravel,
  continueAfterArrival,
  createInitialState,
  finishBacktrack,
  finishTravel,
  getCapital,
  startGame,
  type GameState,
} from "./game/logic";
import { connectedIds, getRoute } from "./data/routes";
import "./App.css";

function travelDuration(miles: number, backtrack: boolean): number {
  const base = Math.min(3200, Math.max(1400, miles * 2.2));
  return backtrack ? base * 0.75 : base;
}

export default function App() {
  const [state, setState] = useState<GameState>(() => createInitialState());

  const traveling =
    state.phase === "traveling" || state.phase === "backtracking";
  const duration = useMemo(() => {
    if (!state.travel) return 2000;
    return travelDuration(state.travel.distanceMiles, state.travel.isBacktrack);
  }, [state.travel]);

  const progress = useTravelProgress(traveling, duration);

  useEffect(() => {
    if (!traveling || progress === null || progress < 1) return;
    const t = window.setTimeout(() => {
      setState((s) =>
        s.phase === "traveling" ? finishTravel(s) : finishBacktrack(s),
      );
    }, 80);
    return () => clearTimeout(t);
  }, [traveling, progress]);

  const onStart = useCallback(() => {
    const params = new URLSearchParams(window.location.search);
    const start = params.get("start") ?? undefined;
    setState(startGame(start ?? undefined));
  }, []);
  const onSelectCity = useCallback((id: string) => {
    setState((s) => beginTravel(s, id));
  }, []);
  const onContinueArrival = useCallback(() => {
    setState((s) => continueAfterArrival(s));
  }, []);

  const choices = useMemo(() => {
    if (state.phase !== "playing") return [];
    return connectedIds(state.playerCity)
      .map((id) => {
        const city = getCapital(id);
        const route = getRoute(state.playerCity, id)!;
        return { id, city, route };
      })
      .sort((a, b) => a.city.capital.localeCompare(b.city.capital));
  }, [state.phase, state.playerCity]);

  if (state.phase === "title") {
    return <TitleScreen onStart={onStart} />;
  }

  const selectable = state.phase === "playing";
  const fromCap = state.travel ? getCapital(state.travel.from) : null;
  const toCap = state.travel ? getCapital(state.travel.to) : null;

  return (
    <div className="app-shell">
      <GameHUD
        playerCity={state.playerCity}
        clue={state.clue}
        streak={state.streak}
        message={state.message}
        phase={state.phase}
        selectable={selectable}
      />

      <main className="map-stage">
        {traveling && state.travel && fromCap && toCap && (
          <TravelBanner
            transport={state.travel.transport}
            fromName={fromCap.capital}
            toName={toCap.capital}
            backtracking={state.travel.isBacktrack}
          />
        )}

        <GameMap
          playerCity={
            traveling && state.travel ? state.travel.from : state.playerCity
          }
          spyTarget={state.spyTarget}
          selectable={selectable}
          highlightConnections={selectable || traveling}
          onSelectCity={onSelectCity}
          travelProgress={progress}
          travelFrom={state.travel?.from ?? null}
          travelTo={state.travel?.to ?? null}
          travelTransport={state.travel?.transport ?? null}
        />

        {selectable && choices.length > 0 && (
          <div className="choice-bar" aria-label="Connected capitals">
            <span className="choice-bar-label">Travel to</span>
            <div className="choice-bar-buttons">
              {choices.map(({ id, city, route }) => (
                <button
                  key={id}
                  type="button"
                  className="choice-chip"
                  onClick={() => onSelectCity(id)}
                >
                  <span className="choice-chip-name">{city.capital}</span>
                  <span className="choice-chip-meta">
                    {city.abbrev} · {route.transport}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
      </main>

      {state.phase === "arrival" && state.travel && (
        <ArrivalOverlay
          correct={state.lastResult === "correct"}
          cityName={getCapital(state.travel.to).capital}
          stateName={getCapital(state.travel.to).state}
          streak={state.streak}
          onContinue={onContinueArrival}
        />
      )}

      {state.phase === "won" && <WinOverlay onReplay={onStart} />}
    </div>
  );
}
