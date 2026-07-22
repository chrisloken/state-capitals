import { useMemo, useRef, useState, useEffect } from "react";
import { geoAlbersUsa, geoPath, type GeoPermissibleObjects } from "d3-geo";
import { feature } from "topojson-client";
import type { FeatureCollection, Geometry } from "geojson";
import type { Topology, GeometryCollection } from "topojson-specification";
import { capitals, capitalByFips, type Capital } from "../data/capitals";
import { allUniqueRoutes, connectedIds, type Transport } from "../data/routes";
import statesTopo from "../data/states-10m.json";

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
/** Never zoom so tight that nearby NE capitals still overlap. */
const MIN_FOCUS_SPAN = 110;
const MAX_SCALE = 4.2;
const LABEL_H = 22;

type StatesTopology = Topology<{ states: GeometryCollection }>;
type Pt = [number, number];
type LabelPlace = { dx: number; dy: number; width: number };

function buildStatesCollection(): FeatureCollection<Geometry> {
  const topo = statesTopo as unknown as StatesTopology;
  return feature(topo, topo.objects.states) as FeatureCollection<Geometry>;
}

const STATES = buildStatesCollection();

function labelWidth(name: string): number {
  return Math.min(name.length * 6.8 + 18, 150);
}

/** Greedy placement in screen-space so zoomed NE labels stay separated. */
function placeLabels(
  items: { id: string; name: string; x: number; y: number }[],
  zoomScale: number,
): Map<string, LabelPlace> {
  const placed: { x: number; y: number; w: number; h: number }[] = [];
  const result = new Map<string, LabelPlace>();
  const s = Math.max(zoomScale, 1);

  // Prefer ring of offsets in screen pixels, then convert to map units.
  const screenSlots: Pt[] = [
    [0, -28],
    [0, 30],
    [34, -16],
    [-34, -16],
    [34, 20],
    [-34, 20],
    [46, 2],
    [-46, 2],
    [0, -48],
    [0, 52],
    [56, -34],
    [-56, -34],
    [56, 36],
    [-56, 36],
    [22, -44],
    [-22, -44],
    [70, 10],
    [-70, 10],
  ];

  const overlaps = (
    ax: number,
    ay: number,
    aw: number,
    ah: number,
    bx: number,
    by: number,
    bw: number,
    bh: number,
  ) =>
    Math.abs(ax - bx) < (aw + bw) / 2 + 6 &&
    Math.abs(ay - by) < (ah + bh) / 2 + 6;

  // Reserve space around every labeled city dot in screen space.
  for (const item of items) {
    placed.push({
      x: item.x * s,
      y: item.y * s,
      w: 18,
      h: 18,
    });
  }

  for (const item of items) {
    const w = labelWidth(item.name);
    const sx = item.x * s;
    const sy = item.y * s;
    let best: LabelPlace | null = null;

    for (const [sdx, sdy] of screenSlots) {
      const lx = sx + sdx;
      const ly = sy + sdy;
      const hit = placed.some((p) =>
        overlaps(lx, ly, w, LABEL_H, p.x, p.y, p.w, p.h),
      );
      if (!hit) {
        best = { dx: sdx / s, dy: sdy / s, width: w };
        placed.push({ x: lx, y: ly, w, h: LABEL_H });
        break;
      }
    }

    if (!best) {
      const sdx = ((result.size % 5) - 2) * 24;
      const sdy = -28 - Math.floor(result.size / 2) * 26;
      best = { dx: sdx / s, dy: sdy / s, width: w };
      placed.push({ x: sx + sdx, y: sy + sdy, w, h: LABEL_H });
    }

    result.set(item.id, best);
  }

  return result;
}

function focusTransform(
  points: Pt[],
): { scale: number; tx: number; ty: number } {
  if (points.length === 0) {
    return { scale: 1, tx: 0, ty: 0 };
  }

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const [x, y] of points) {
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  }

  const pad = 56;
  let spanX = Math.max(maxX - minX, MIN_FOCUS_SPAN) + pad * 2;
  let spanY = Math.max(maxY - minY, MIN_FOCUS_SPAN) + pad * 2;

  // Match map aspect so we don't crop oddly.
  const aspect = WIDTH / HEIGHT;
  if (spanX / spanY < aspect) spanX = spanY * aspect;
  else spanY = spanX / aspect;

  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const scale = Math.min(MAX_SCALE, Math.min(WIDTH / spanX, HEIGHT / spanY));

  // Don't zoom out past the full map.
  if (scale <= 1.05) {
    return { scale: 1, tx: 0, ty: 0 };
  }

  return {
    scale,
    tx: WIDTH / 2 - cx * scale,
    ty: HEIGHT / 2 - cy * scale,
  };
}

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
  const [hoverId, setHoverId] = useState<string | null>(null);
  const states = STATES;
  const projection = useMemo(
    () => geoAlbersUsa().translate([WIDTH / 2, HEIGHT / 2]).scale(1300),
    [],
  );
  const path = useMemo(() => geoPath(projection), [projection]);

  const positions = useMemo(() => {
    const map = new Map<string, Pt>();
    for (const c of capitals) {
      const p = projection([c.lng, c.lat]);
      if (p) map.set(c.id, p as Pt);
    }
    return map;
  }, [projection]);

  const connected = useMemo(
    () => new Set(connectedIds(playerCity)),
    [playerCity],
  );

  const routes = useMemo(() => allUniqueRoutes(), []);

  const focusIds = useMemo(() => {
    const ids = new Set<string>();
    if (travelFrom) ids.add(travelFrom);
    if (travelTo) ids.add(travelTo);
    if (playerCity) ids.add(playerCity);
    if (highlightConnections || selectable) {
      for (const id of connected) ids.add(id);
    }
    return ids;
  }, [
    playerCity,
    connected,
    highlightConnections,
    selectable,
    travelFrom,
    travelTo,
  ]);

  const zoom = useMemo(() => {
    const pts: Pt[] = [];
    for (const id of focusIds) {
      const p = positions.get(id);
      if (p) pts.push(p);
    }
    return focusTransform(pts);
  }, [focusIds, positions]);

  const labelLayout = useMemo(() => {
    const items: { id: string; name: string; x: number; y: number }[] = [];
    for (const c of capitals) {
      const p = positions.get(c.id);
      if (!p) continue;
      const isPlayer = c.id === playerCity;
      const canClick = selectable && connected.has(c.id);
      if (!isPlayer && !canClick) continue;
      items.push({ id: c.id, name: c.capital, x: p[0], y: p[1] });
    }
    // Player first so it keeps a preferred slot, then north→south for stability.
    items.sort((a, b) => {
      if (a.id === playerCity) return -1;
      if (b.id === playerCity) return 1;
      return a.y - b.y || a.x - b.x;
    });
    return placeLabels(items, zoom.scale);
  }, [positions, playerCity, selectable, connected, zoom.scale]);

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
    const mx = (a[0] + b[0]) / 2;
    const my =
      (a[1] + b[1]) / 2 - Math.hypot(b[0] - a[0], b[1] - a[1]) * 0.18;
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
        <clipPath id="mapClip">
          <rect width={WIDTH} height={HEIGHT} rx="18" />
        </clipPath>
      </defs>

      <rect width={WIDTH} height={HEIGHT} fill="url(#ocean)" rx="18" />

      <g clipPath="url(#mapClip)">
        <g
          className="map-zoom"
          style={{
            transform: `translate(${zoom.tx}px, ${zoom.ty}px) scale(${zoom.scale})`,
            transformOrigin: "0 0",
          }}
        >
          <g className="states">
            {states.features.map((f) => {
              const fips = String(f.id).padStart(2, "0");
              const capital = capitalByFips[fips];
              const isPlayerState = capital?.id === playerCity;
              const isConnectedState =
                highlightConnections && capital && connected.has(capital.id);
              const isTargetHint =
                highlightConnections && capital?.id === spyTarget && false;

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
              const label = labelLayout.get(c.id);

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
                  label={label}
                  zoomScale={zoom.scale}
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
        </g>
      </g>
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
  label,
  zoomScale,
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
  label?: LabelPlace;
  zoomScale: number;
  onEnter: () => void;
  onLeave: () => void;
  onClick: () => void;
}) {
  const showLabel = isPlayer || canClick || isHover;
  const dx = label?.dx ?? 0;
  const dy = label?.dy ?? -28 / Math.max(zoomScale, 1);
  const width = label?.width ?? labelWidth(capital.capital);
  const inv = 1 / Math.max(zoomScale, 1);
  const hitR = canClick ? Math.max(10, 14 * inv) : 0;

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
      {canClick && (
        <>
          <circle className="capital-hit" r={Math.max(12, 18 * inv)} />
          <circle className="capital-pulse" r={hitR || 12} />
        </>
      )}
      <circle
        className="capital-dot"
        r={(isPlayer ? 6.5 : canClick ? 5.5 : 4) * Math.min(1.15, 0.55 + inv)}
      />
      {showLabel && (
        <g
          className="capital-label"
          transform={`translate(${dx}, ${dy}) scale(${inv})`}
        >
          {(Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5) && (
            <line
              className="capital-label-stem"
              x1={0}
              y1={0}
              x2={-dx / inv}
              y2={-dy / inv}
            />
          )}
          <rect
            x={-width / 2}
            y={-LABEL_H / 2}
            width={width}
            height={LABEL_H}
            rx={6}
            className="capital-label-bg"
          />
          <text textAnchor="middle" dominantBaseline="central">
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
      const eased = t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
      setProgress(eased);
      if (t < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [active, durationMs]);

  return progress;
}
