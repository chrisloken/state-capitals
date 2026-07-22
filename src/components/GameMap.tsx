import { useEffect, useMemo, useRef, useState } from "react";
import { geoAlbersUsa, geoPath, type GeoPermissibleObjects } from "d3-geo";
import { feature } from "topojson-client";
import type { FeatureCollection, Geometry } from "geojson";
import { capitals, capitalByFips, type Capital } from "../data/capitals";
import { allUniqueRoutes, connectedIds, type Transport } from "../data/routes";

type Props = {
  playerCity: string;
  spyTarget: string;
  selectable: boolean;
  highlightConnections: boolean;
  onSelectCity: (id: string) => void;
  travelProgress: number | null;
  travelFrom: string | null;
  travelTo: string | null;
  travelTransport: Transport | null;
};

const WIDTH = 975;
const HEIGHT = 610;

export function GameMap({
  playerCity,
  spyTarget,
  selectable,
  highlightConnections,
  onSelectCity,
  travelProgress,
  travelFrom,
  travelTo,
  travelTransport,
}: Props) {
  const [states, setStates] = useState<FeatureCollection<Geometry> | null>(
    null,
  );
  const [hoverId, setHoverId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`${import.meta.env.BASE_URL}data/states-10m.json`)
      .then((r) => r.json())
      .then((topo) => {
        if (cancelled) return;
        const fc = feature(
          topo,
          // oxlint-disable-next-line typescript/no-explicit-any
          (topo as { objects: { states: object } }).objects.states as never,
        ) as unknown as FeatureCollection;
        setStates(fc);
      })
      .catch(console.error);
    return () => {
      cancelled = true;
    };
  }, []);

  const projection = useMemo(
    () => geoAlbersUsa().translate([WIDTH / 2, HEIGHT / 2]).scale(1300),
    [],
  );
  const path = useMemo(() => geoPath(projection), [projection]);

  const positions = useMemo(() => {
    const map = new Map<string, [number, number]>();
    for (const c of capitals) {
      const p = projection([c.lng, c.lat]);
      if (p) map.set(c.id, p as [number, number]);
    }
    return map;
  }, [projection]);

  const connected = useMemo(
    () => new Set(connectedIds(playerCity)),
    [playerCity],
  );

  const routes = useMemo(() => allUniqueRoutes(), []);

  const travelPoint = useMemo(() => {
    if (
      travelProgress == null ||
      !travelFrom ||
      !travelTo ||
      !positions.has(travelFrom) ||
      !positions.has(travelTo)
    ) {
      return null;
    }
    const a = positions.get(travelFrom)!;
    const b = positions.get(travelTo)!;
    const t = travelProgress;
    // Gentle arc
    const mx = (a[0] + b[0]) / 2;
    const my = (a[1] + b[1]) / 2 - Math.hypot(b[0] - a[0], b[1] - a[1]) * 0.18;
    const x = (1 - t) * (1 - t) * a[0] + 2 * (1 - t) * t * mx + t * t * b[0];
    const y = (1 - t) * (1 - t) * a[1] + 2 * (1 - t) * t * my + t * t * b[1];
    const angle =
      Math.atan2(
        2 * (1 - t) * (my - a[1]) + 2 * t * (b[1] - my),
        2 * (1 - t) * (mx - a[0]) + 2 * t * (b[0] - mx),
      ) *
      (180 / Math.PI);
    return { x, y, angle };
  }, [travelProgress, travelFrom, travelTo, positions]);

  if (!states) {
    return (
      <div className="map-loading" role="status">
        Unfolding the map…
      </div>
    );
  }

  return (
    <svg
      className="game-map"
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      role="img"
      aria-label="United States map with state capitals and travel routes"
    >
      <defs>
        <linearGradient id="ocean" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#1a6b7a" />
          <stop offset="55%" stopColor="#0f4c5c" />
          <stop offset="100%" stopColor="#163a4a" />
        </linearGradient>
        <linearGradient id="land" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#d5e8c8" />
          <stop offset="100%" stopColor="#a8c99a" />
        </linearGradient>
        <filter id="softGlow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <pattern
          id="routeDash"
          patternUnits="userSpaceOnUse"
          width="10"
          height="10"
        >
          <circle cx="1" cy="1" r="1" fill="#f0c75e" opacity="0.7" />
        </pattern>
      </defs>

      <rect width={WIDTH} height={HEIGHT} fill="url(#ocean)" rx="18" />

      <g className="states">
        {states.features.map((f) => {
          const fips = String(f.id).padStart(2, "0");
          const capital = capitalByFips[fips];
          const isPlayerState = capital?.id === playerCity;
          const isConnectedState =
            highlightConnections && capital && connected.has(capital.id);
          const isTargetHint =
            highlightConnections && capital?.id === spyTarget && false; // never reveal target visually

          return (
            <path
              key={fips}
              d={path(f as GeoPermissibleObjects) ?? undefined}
              className={[
                "state",
                isPlayerState ? "state-player" : "",
                isConnectedState ? "state-connected" : "",
                isTargetHint ? "state-hint" : "",
              ]
                .filter(Boolean)
                .join(" ")}
            />
          );
        })}
      </g>

      <g className="routes">
        {routes.map((r) => {
          const a = positions.get(r.from);
          const b = positions.get(r.to);
          if (!a || !b) return null;
          const active =
            highlightConnections &&
            ((r.from === playerCity && connected.has(r.to)) ||
              (r.to === playerCity && connected.has(r.from)));
          const traveling =
            travelFrom &&
            travelTo &&
            ((r.from === travelFrom && r.to === travelTo) ||
              (r.from === travelTo && r.to === travelFrom));
          const midX = (a[0] + b[0]) / 2;
          const midY =
            (a[1] + b[1]) / 2 -
            Math.hypot(b[0] - a[0], b[1] - a[1]) * 0.18;
          return (
            <path
              key={`${r.from}-${r.to}`}
              d={`M ${a[0]} ${a[1]} Q ${midX} ${midY} ${b[0]} ${b[1]}`}
              className={[
                "route",
                active ? "route-active" : "",
                traveling ? "route-traveling" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              fill="none"
            />
          );
        })}
      </g>

      <g className="capitals">
        {capitals.map((c) => {
          const p = positions.get(c.id);
          if (!p) return null;
          const isPlayer = c.id === playerCity;
          const isConnected = connected.has(c.id);
          const canClick = selectable && isConnected;
          const isHover = hoverId === c.id;

          return (
            <CapitalMarker
              key={c.id}
              capital={c}
              x={p[0]}
              y={p[1]}
              isPlayer={isPlayer}
              canClick={canClick}
              isHover={isHover}
              dimmed={highlightConnections && !isPlayer && !isConnected}
              onEnter={() => setHoverId(c.id)}
              onLeave={() => setHoverId(null)}
              onClick={() => canClick && onSelectCity(c.id)}
            />
          );
        })}
      </g>

      {travelPoint && travelTransport && (
        <VehicleMarker
          x={travelPoint.x}
          y={travelPoint.y}
          angle={travelPoint.angle}
          transport={travelTransport}
        />
      )}
    </svg>
  );
}

function CapitalMarker({
  capital,
  x,
  y,
  isPlayer,
  canClick,
  isHover,
  dimmed,
  onEnter,
  onLeave,
  onClick,
}: {
  capital: Capital;
  x: number;
  y: number;
  isPlayer: boolean;
  canClick: boolean;
  isHover: boolean;
  dimmed: boolean;
  onEnter: () => void;
  onLeave: () => void;
  onClick: () => void;
}) {
  const showLabel = isPlayer || canClick || isHover;
  return (
    <g
      className={[
        "capital",
        isPlayer ? "capital-player" : "",
        canClick ? "capital-choice" : "",
        dimmed ? "capital-dim" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      transform={`translate(${x}, ${y})`}
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
      onClick={onClick}
      role={canClick ? "button" : undefined}
      tabIndex={canClick ? 0 : undefined}
      onKeyDown={(e) => {
        if (canClick && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          onClick();
        }
      }}
      style={{ cursor: canClick ? "pointer" : "default" }}
    >
      {canClick && <circle className="capital-pulse" r="14" />}
      <circle className="capital-dot" r={isPlayer ? 7 : 4.5} />
      {showLabel && (
        <g className="capital-label" transform="translate(0, -14)">
          <rect
            x={-Math.min(capital.capital.length * 3.4 + 8, 70)}
            y={-12}
            width={Math.min(capital.capital.length * 6.8 + 16, 140)}
            height={18}
            rx={6}
            className="capital-label-bg"
          />
          <text textAnchor="middle" dy="1">
            {capital.capital}
          </text>
        </g>
      )}
    </g>
  );
}

function VehicleMarker({
  x,
  y,
  angle,
  transport,
}: {
  x: number;
  y: number;
  angle: number;
  transport: Transport;
}) {
  return (
    <g
      className="vehicle"
      transform={`translate(${x}, ${y}) rotate(${angle})`}
      filter="url(#softGlow)"
    >
      <circle r="16" className="vehicle-halo" />
      <g transform="rotate(90) translate(-10, -10)">
        {transport === "plane" && (
          <path
            fill="#f0c75e"
            stroke="#8a4b12"
            strokeWidth="0.6"
            d="M20 12.5v-1.2L12 8V4.2a1.8 1.8 0 0 0-3.6 0V8L.8 11.3v1.2L8.4 11v3.4l-1.8 1.3v1.1L10 16l3.4 1.1v-1.1L11.6 14.4V11l8.4 1.5z"
          />
        )}
        {transport === "train" && (
          <path
            fill="#e07a5f"
            stroke="#5c2a1d"
            strokeWidth="0.6"
            d="M10 2c-3.2 0-6.4.4-6.4 3.2v7.2A2.6 2.6 0 0 0 6.2 15l-1.1 1.1V17.5h1.5l1.5-1.5h3.2l1.5 1.5H14.5v-1.4L13.4 15a2.6 2.6 0 0 0 2.6-2.6V5.2C16 2.4 13.2 2 10 2zM7.4 13a1.1 1.1 0 1 1 0-2.2 1.1 1.1 0 0 1 0 2.2zm5.2 0a1.1 1.1 0 1 1 0-2.2 1.1 1.1 0 0 1 0 2.2zM5.2 10V6.5h9.6V10H5.2z"
          />
        )}
        {transport === "car" && (
          <path
            fill="#81b29a"
            stroke="#1f4a3a"
            strokeWidth="0.6"
            d="M4.2 9.2l1.1-3.4A1.4 1.4 0 0 1 6.7 4.8h6.6a1.4 1.4 0 0 1 1.4 1L15.8 9.2H16.6a.8.8 0 0 1 .8.8v2.2a.8.8 0 0 1-.8.8h-.8a1.9 1.9 0 0 1-3.6 0H7.8a1.9 1.9 0 0 1-3.6 0H3.4a.8.8 0 0 1-.8-.8V10a.8.8 0 0 1 .8-.8h.8zm1.9 4a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5zm7.8 0a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5zM6.8 6.2l-.7 2.2h7.8l-.7-2.2H6.8z"
          />
        )}
      </g>
    </g>
  );
}

/** Hook: animate travel progress 0→1 over durationMs */
export function useTravelProgress(
  active: boolean,
  durationMs: number,
): number | null {
  const [progress, setProgress] = useState<number | null>(null);
  const raf = useRef<number>(0);

  useEffect(() => {
    if (!active) {
      setProgress(null);
      return;
    }
    const start = performance.now();
    setProgress(0);
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      // ease-in-out
      const eased = t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
      setProgress(eased);
      if (t < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [active, durationMs]);

  return progress;
}
