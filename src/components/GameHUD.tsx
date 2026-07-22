import type { Transport } from "../data/routes";
import { WIN_STREAK } from "../game/logic";
import { getCapital } from "../game/logic";

type Props = {
  playerCity: string;
  clue: string;
  streak: number;
  message: string;
  phase: string;
  selectable: boolean;
};

export function GameHUD({
  playerCity,
  clue,
  streak,
  message,
  phase,
  selectable,
}: Props) {
  const city = getCapital(playerCity);

  return (
    <aside className="hud" aria-live="polite">
      <div className="hud-brand">
        <span className="hud-brand-mark">Capital Chase</span>
        <span className="hud-brand-sub">Spy Hunt</span>
      </div>

      <div className="streak-track" aria-label={`Streak ${streak} of ${WIN_STREAK}`}>
        {Array.from({ length: WIN_STREAK }, (_, i) => (
          <span
            key={i}
            className={`streak-pip ${i < streak ? "filled" : ""}`}
          />
        ))}
        <span className="streak-label">{streak}/{WIN_STREAK} hot trail</span>
      </div>

      <div className="hud-location">
        <span className="hud-kicker">You are in</span>
        <strong>
          {city.capital}, {city.state}
        </strong>
      </div>

      <div className="clue-panel">
        <span className="clue-stamp">Secret Clue</span>
        <p className="clue-text">{clue}</p>
        {selectable && (
          <p className="clue-hint">
            Tap a glowing capital connected by a route.
          </p>
        )}
        {!selectable && phase !== "won" && (
          <p className="clue-hint">{message}</p>
        )}
      </div>

      {message && selectable && <p className="hud-message">{message}</p>}
    </aside>
  );
}

export function TravelBanner({
  transport,
  fromName,
  toName,
  backtracking,
}: {
  transport: Transport;
  fromName: string;
  toName: string;
  backtracking: boolean;
}) {
  const verb =
    transport === "plane"
      ? "Flying"
      : transport === "train"
        ? "Riding the rails"
        : "Driving";
  return (
    <div className={`travel-banner ${backtracking ? "backtrack" : ""}`}>
      <TransportIcon transport={transport} />
      <span>
        {backtracking ? "Backtracking" : verb} from <strong>{fromName}</strong>{" "}
        to <strong>{toName}</strong>
      </span>
    </div>
  );
}

export function TransportIcon({ transport }: { transport: Transport }) {
  if (transport === "plane") {
    return (
      <svg className="transport-icon" viewBox="0 0 24 24" aria-hidden>
        <path
          fill="currentColor"
          d="M21 16v-2l-8-5V3.5a1.5 1.5 0 0 0-3 0V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z"
        />
      </svg>
    );
  }
  if (transport === "train") {
    return (
      <svg className="transport-icon" viewBox="0 0 24 24" aria-hidden>
        <path
          fill="currentColor"
          d="M12 2c-4 0-8 .5-8 4v9.5A3.5 3.5 0 0 0 7.5 19l-1.5 1.5V22h2l2-2h4l2 2h2v-1.5L16.5 19a3.5 3.5 0 0 0 3.5-3.5V6c0-3.5-4-4-8-4zm-3.5 14a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zm7 0a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zM6 12V7h12v5H6z"
        />
      </svg>
    );
  }
  return (
    <svg className="transport-icon" viewBox="0 0 24 24" aria-hidden>
      <path
        fill="currentColor"
        d="M5 11l1.5-4.5A2 2 0 0 1 8.4 5h7.2a2 2 0 0 1 1.9 1.5L19 11h1a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1h-1.1a2.5 2.5 0 0 1-4.8 0H9.9a2.5 2.5 0 0 1-4.8 0H4a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1h1zm2.5 5.5a1 1 0 1 0 0-2 1 1 0 0 0 0 2zm9 0a1 1 0 1 0 0-2 1 1 0 0 0 0 2zM8.4 7l-1 3h9.2l-1-3H8.4z"
      />
    </svg>
  );
}
