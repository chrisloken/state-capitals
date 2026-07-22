import { capitals, type Capital } from "./capitals";

export type Transport = "car" | "train" | "plane";

export type Route = {
  from: string;
  to: string;
  distanceMiles: number;
  transport: Transport;
};

function haversineMiles(a: Capital, b: Capital): number {
  const R = 3958.8;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function transportForDistance(miles: number): Transport {
  if (miles < 280) return "car";
  if (miles < 650) return "train";
  return "plane";
}

/** Forced long-haul links so Alaska & Hawaii join the chase network. */
const SPECIAL_LINKS: [string, string][] = [
  ["AK", "WA"],
  ["AK", "OR"],
  ["HI", "CA"],
  ["HI", "OR"],
];

function buildRouteGraph(neighborsPerCity = 3): Map<string, Route[]> {
  const graph = new Map<string, Route[]>();
  for (const c of capitals) graph.set(c.id, []);

  const addEdge = (from: Capital, to: Capital) => {
    const distanceMiles = haversineMiles(from, to);
    const transport = transportForDistance(distanceMiles);
    const forward: Route = {
      from: from.id,
      to: to.id,
      distanceMiles,
      transport,
    };
    const back: Route = {
      from: to.id,
      to: from.id,
      distanceMiles,
      transport,
    };
    const fromList = graph.get(from.id)!;
    const toList = graph.get(to.id)!;
    if (!fromList.some((r) => r.to === to.id)) fromList.push(forward);
    if (!toList.some((r) => r.to === from.id)) toList.push(back);
  };

  for (const from of capitals) {
    const ranked = capitals
      .filter((c) => c.id !== from.id)
      .map((to) => ({ to, d: haversineMiles(from, to) }))
      .sort((a, b) => a.d - b.d);

    // Mainland: nearest neighbors. AK/HI rely more on special links.
    const count =
      from.id === "AK" || from.id === "HI" ? 1 : neighborsPerCity;
    for (const { to } of ranked.slice(0, count)) {
      addEdge(from, to);
    }
  }

  for (const [a, b] of SPECIAL_LINKS) {
    const from = capitals.find((c) => c.id === a)!;
    const to = capitals.find((c) => c.id === b)!;
    addEdge(from, to);
  }

  // Ensure every node has at least 2 connections when possible.
  for (const from of capitals) {
    const list = graph.get(from.id)!;
    if (list.length >= 2) continue;
    const ranked = capitals
      .filter((c) => c.id !== from.id && !list.some((r) => r.to === c.id))
      .map((to) => ({ to, d: haversineMiles(from, to) }))
      .sort((a, b) => a.d - b.d);
    for (const { to } of ranked) {
      if (list.length >= 2) break;
      addEdge(from, to);
    }
  }

  return graph;
}

export const routeGraph = buildRouteGraph(3);

export function routesFrom(id: string): Route[] {
  return routeGraph.get(id) ?? [];
}

export function getRoute(from: string, to: string): Route | undefined {
  return routesFrom(from).find((r) => r.to === to);
}

export function connectedIds(id: string): string[] {
  return routesFrom(id).map((r) => r.to);
}

/** Unique undirected edges for map drawing. */
export function allUniqueRoutes(): Route[] {
  const seen = new Set<string>();
  const out: Route[] = [];
  for (const list of routeGraph.values()) {
    for (const r of list) {
      const key = [r.from, r.to].sort().join("-");
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(r);
    }
  }
  return out;
}
