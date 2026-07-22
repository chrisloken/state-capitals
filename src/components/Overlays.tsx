import type { CSSProperties } from "react";

type Props = {
  correct: boolean;
  cityName: string;
  stateName: string;
  streak: number;
  onContinue: () => void;
};

export function ArrivalOverlay({
  correct,
  cityName,
  stateName,
  streak,
  onContinue,
}: Props) {
  return (
    <div
      className={`arrival-overlay ${correct ? "success" : "miss"}`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="arrival-title"
    >
      <div className="arrival-card">
        {correct ? (
          <>
            <div className="burst" aria-hidden>
              {Array.from({ length: 12 }, (_, i) => (
                <span key={i} className="burst-ray" style={{ "--i": i } as CSSProperties} />
              ))}
            </div>
            <div className="stamp stamp-hot">HOT TRAIL</div>
            <h2 id="arrival-title">You found {cityName}!</h2>
            <p>
              Capital of <strong>{stateName}</strong>. The spy was just here —
              keep chasing!
            </p>
            <p className="arrival-streak">Streak: {streak}</p>
          </>
        ) : (
          <>
            <div className="stamp stamp-cold">COLD TRAIL</div>
            <h2 id="arrival-title">Dead end in {cityName}!</h2>
            <p>
              The spy isn't in {stateName}. Backtrack to your last city and try
              another connected capital.
            </p>
          </>
        )}
        <button type="button" className="btn primary" onClick={onContinue}>
          {correct ? "Follow the next clue" : "Backtrack"}
        </button>
      </div>
    </div>
  );
}

type WinProps = {
  onReplay: () => void;
};

export function WinOverlay({ onReplay }: WinProps) {
  return (
    <div className="win-overlay" role="dialog" aria-modal="true">
      <div className="win-card">
        <div className="confetti" aria-hidden>
          {Array.from({ length: 24 }, (_, i) => (
            <span key={i} className="confetti-bit" style={{ "--i": i } as CSSProperties} />
          ))}
        </div>
        <p className="win-kicker">Mission complete</p>
        <h2>You caught the spy!</h2>
        <p>
          Five correct capitals in a row — you're a Capital Chase champion.
        </p>
        <button type="button" className="btn primary" onClick={onReplay}>
          Play again
        </button>
      </div>
    </div>
  );
}

export function TitleScreen({ onStart }: { onStart: () => void }) {
  return (
    <div className="title-screen">
      <div className="title-sky" aria-hidden />
      <div className="title-content">
        <p className="title-eyebrow">Learn the fifty capitals</p>
        <h1 className="title-brand">Capital Chase</h1>
        <p className="title-lead">
          A spy is hopping capital to capital. Read each clue, follow the
          routes, and catch them with five correct stops in a row.
        </p>
        <ul className="title-rules">
          <li>Clues point to a nearby capital linked by a route</li>
          <li>Travel by car, train, or plane</li>
          <li>Wrong guess? Backtrack and try again</li>
        </ul>
        <button type="button" className="btn primary large" onClick={onStart}>
          Start the chase
        </button>
      </div>
      <div className="title-plane" aria-hidden>
        <svg viewBox="0 0 64 64" width="72" height="72">
          <path
            fill="#f0c75e"
            d="M62 40v-4L38 26V12a6 6 0 0 0-12 0v14L2 36v4l24-6v12l-6 5v4l9-3 9 3v-4l-6-5V34l24 6z"
          />
        </svg>
      </div>
    </div>
  );
}
