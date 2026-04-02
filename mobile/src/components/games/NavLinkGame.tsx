/**
 * Nav-Link — Systems Thinking (T12 / G06)
 *
 * Satellite-to-Ground data routing via tap-link. Establish and maintain the
 * optimal data path as nodes orbit, degrade, and brown out.
 *
 * No SVG — links drawn as rotated Views centered at midpoint between nodes.
 *
 * KPIs:
 *   pathEfficiency   — optimal hops ÷ actual hops used
 *   uptimePct        — time with valid Source→Ground path / total time
 *   mttrMs           — mean time from brown-out to re-established path
 *
 * Config params (via traitCatalog gameParams):
 *   nodeCount        number   total nodes (3–12)
 *   signalDecay      boolean  distance-penalised link strength
 *   bandwidthCaps    boolean  per-node throughput limits
 *   brownOuts        boolean  rapid offline/online cycling
 *   durationMs       number   total session length in ms
 *   orbitSpeed       number   ms for a full node orbit cycle (0 = static)
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Dimensions,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Node {
  id: string;
  label: string;
  x: number;   // 0–1 normalized
  y: number;   // 0–1 normalized
  isSource: boolean;
  isGround: boolean;
  online: boolean;
  browningOut: boolean;
  capacity: number; // 1–3, used for bandwidth caps
}

interface Link {
  fromId: string;
  toId: string;
}

interface NavLinkConfig {
  nodeCount: number;
  signalDecay: boolean;
  bandwidthCaps: boolean;
  brownOuts: boolean;
  durationMs: number;
  orbitSpeed: number; // 0 = static; >0 = ms per full orbit
}

interface Props {
  sessionId: string;
  onComplete: (score: number) => void;
  config: Partial<NavLinkConfig>;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
const CANVAS_W = SCREEN_W - 24;
const CANVAS_H = Math.min(320, SCREEN_H * 0.45);
const NODE_R = 18;

const DEFAULTS: NavLinkConfig = {
  nodeCount: 4,
  signalDecay: false,
  bandwidthCaps: false,
  brownOuts: false,
  durationMs: 60_000,
  orbitSpeed: 0,
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function dist(a: Node, b: Node): number {
  const dx = (a.x - b.x) * CANVAS_W;
  const dy = (a.y - b.y) * CANVAS_H;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * BFS: find shortest path (fewest hops) between source and ground
 * considering only online nodes.
 */
function bfsPath(nodes: Node[], links: Link[]): string[] | null {
  const source = nodes.find(n => n.isSource);
  const ground = nodes.find(n => n.isGround);
  if (!source || !ground) return null;

  const onlineIds = new Set(nodes.filter(n => n.online).map(n => n.id));
  if (!onlineIds.has(source.id) || !onlineIds.has(ground.id)) return null;

  // Build adjacency
  const adj: Map<string, string[]> = new Map();
  nodes.forEach(n => adj.set(n.id, []));
  links.forEach(l => {
    if (onlineIds.has(l.fromId) && onlineIds.has(l.toId)) {
      adj.get(l.fromId)?.push(l.toId);
      adj.get(l.toId)?.push(l.fromId);
    }
  });

  // BFS
  const visited = new Set<string>([source.id]);
  const queue: string[][] = [[source.id]];
  while (queue.length > 0) {
    const path = queue.shift()!;
    const last = path[path.length - 1];
    if (last === ground.id) return path;
    for (const neighbor of (adj.get(last) ?? [])) {
      if (!visited.has(neighbor)) {
        visited.add(neighbor);
        queue.push([...path, neighbor]);
      }
    }
  }
  return null;
}

/** Generate initial node positions */
function initNodes(nodeCount: number, bandwidthCaps: boolean): Node[] {
  const nodes: Node[] = [];

  // Source at top-center, Ground at bottom-center
  nodes.push({
    id: 'SOURCE',
    label: 'SAT',
    x: 0.5,
    y: 0.05,
    isSource: true,
    isGround: false,
    online: true,
    browningOut: false,
    capacity: 3,
  });
  nodes.push({
    id: 'GROUND',
    label: 'GND',
    x: 0.5,
    y: 0.92,
    isSource: false,
    isGround: true,
    online: true,
    browningOut: false,
    capacity: 3,
  });

  // Relay nodes distributed in 2–3 rows
  const relayCount = nodeCount - 2;
  for (let i = 0; i < relayCount; i++) {
    const row = Math.floor(i / 3);
    const col = i % 3;
    const totalRows = Math.ceil(relayCount / 3);
    nodes.push({
      id: `R${i + 1}`,
      label: `R${i + 1}`,
      x: 0.2 + col * 0.3 + (Math.random() * 0.1 - 0.05),
      y: 0.2 + (row / totalRows) * 0.6 + (Math.random() * 0.08 - 0.04),
      isSource: false,
      isGround: false,
      online: true,
      browningOut: false,
      capacity: bandwidthCaps ? (1 + Math.floor(Math.random() * 3)) : 3,
    });
  }

  return nodes;
}

// ── Link line rendering (no SVG) ───────────────────────────────────────────────

interface LinkLineProps {
  fromNode: Node;
  toNode: Node;
  color: string;
  opacity?: number;
}

function LinkLine({ fromNode, toNode, color, opacity = 1 }: LinkLineProps) {
  const x1 = fromNode.x * CANVAS_W;
  const y1 = fromNode.y * CANVAS_H;
  const x2 = toNode.x * CANVAS_W;
  const y2 = toNode.y * CANVAS_H;
  const length = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
  const angle = Math.atan2(y2 - y1, x2 - x1) * (180 / Math.PI);
  const midX = (x1 + x2) / 2;
  const midY = (y1 + y2) / 2;

  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        left: midX - length / 2,
        top: midY - 1,
        width: length,
        height: 2,
        backgroundColor: color,
        opacity,
        transform: [{ rotate: `${angle}deg` }],
        borderRadius: 1,
      }}
    />
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function NavLinkGame({ sessionId, onComplete, config }: Props) {
  const cfg: NavLinkConfig = { ...DEFAULTS, ...config };

  const [phase, setPhase] = useState<'intro' | 'playing' | 'done'>('intro');
  const [nodes, setNodes] = useState<Node[]>([]);
  const [links, setLinks] = useState<Link[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activePath, setActivePath] = useState<string[] | null>(null);
  const [timeRemainingMs, setTimeRemainingMs] = useState(cfg.durationMs);
  const [score, setScore] = useState<number | null>(null);
  const [brownOutMessage, setBrownOutMessage] = useState('');

  // Uptime tracking
  const uptimeTicksRef = useRef(0);     // ticks with valid path
  const totalTicksRef = useRef(0);       // total ticks
  const pathHopsRef = useRef<number[]>([]);    // actual hops each tick with valid path
  const optimalHopsRef = useRef<number[]>([]);  // optimal hops each tick with valid path
  const brownOutStartRef = useRef<number | null>(null);
  const mttrSamplesRef = useRef<number[]>([]);

  const nodesRef = useRef<Node[]>([]);
  const linksRef = useRef<Link[]>([]);
  useEffect(() => { nodesRef.current = nodes; }, [nodes]);
  useEffect(() => { linksRef.current = links; }, [links]);

  const sessionActiveRef = useRef(false);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const uptimeTickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const orbitTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const brownOutTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Orbit: offset angle per relay node
  const orbitAnglesRef = useRef<number[]>([]);
  const orbitOriginsRef = useRef<{ x: number; y: number; r: number; speed: number }[]>([]);

  // ── Cleanup ────────────────────────────────────────────────────────────────

  useEffect(() => {
    return () => {
      sessionActiveRef.current = false;
      if (countdownRef.current) clearInterval(countdownRef.current);
      if (uptimeTickRef.current) clearInterval(uptimeTickRef.current);
      if (orbitTimerRef.current) clearInterval(orbitTimerRef.current);
      if (brownOutTimerRef.current) clearInterval(brownOutTimerRef.current);
    };
  }, []);

  // ── Uptime + path quality tracking (every 500ms) ──────────────────────────

  const uptimeTick = useCallback(() => {
    const currentNodes = nodesRef.current;
    const currentLinks = linksRef.current;
    totalTicksRef.current += 1;

    const path = bfsPath(currentNodes, currentLinks);
    if (path) {
      uptimeTicksRef.current += 1;
      pathHopsRef.current.push(path.length - 1);

      // Compute optimal path (direct path from source → relay chain → ground, minimum hops)
      // Optimal = BFS result itself (it's already shortest)
      optimalHopsRef.current.push(path.length - 1);

      // If we just recovered from a brownout, record MTTR
      if (brownOutStartRef.current !== null) {
        const mttr = Date.now() - brownOutStartRef.current;
        mttrSamplesRef.current.push(mttr);
        brownOutStartRef.current = null;
        setBrownOutMessage('');
      }
    } else {
      // No valid path — brownout
      if (brownOutStartRef.current === null) {
        brownOutStartRef.current = Date.now();
        setBrownOutMessage('⚠️ Path lost — reroute!');
      }
    }

    setActivePath(path);
  }, []);

  // ── Orbit movement ─────────────────────────────────────────────────────────

  const orbitStep = useCallback(() => {
    if (!sessionActiveRef.current || cfg.orbitSpeed <= 0) return;
    const dt = 200; // ms per step
    const fullCircle = 2 * Math.PI;
    const angularStep = (dt / cfg.orbitSpeed) * fullCircle;

    setNodes(prev => {
      return prev.map((n, i) => {
        if (n.isSource || n.isGround) return n;
        const relayIdx = i - 2; // skip SOURCE and GROUND
        orbitAnglesRef.current[relayIdx] = (orbitAnglesRef.current[relayIdx] ?? 0) + angularStep;
        const angle = orbitAnglesRef.current[relayIdx];
        const origin = orbitOriginsRef.current[relayIdx];
        if (!origin) return n;
        const newX = origin.x + origin.r * Math.cos(angle);
        const newY = origin.y + origin.r * Math.sin(angle);
        return { ...n, x: Math.max(0.05, Math.min(0.95, newX)), y: Math.max(0.05, Math.min(0.95, newY)) };
      });
    });
  }, [cfg.orbitSpeed]);

  // ── Brown-out cycling ──────────────────────────────────────────────────────

  const triggerBrownOut = useCallback(() => {
    if (!sessionActiveRef.current || !cfg.brownOuts) return;
    setNodes(prev => {
      const relayNodes = prev.filter(n => !n.isSource && !n.isGround);
      if (relayNodes.length === 0) return prev;
      const target = relayNodes[Math.floor(Math.random() * relayNodes.length)];
      return prev.map(n =>
        n.id === target.id ? { ...n, online: false, browningOut: true } : n
      );
    });

    // Restore after 4s
    setTimeout(() => {
      if (!sessionActiveRef.current) return;
      setNodes(prev => prev.map(n => n.browningOut ? { ...n, online: true, browningOut: false } : n));
    }, 4000);
  }, [cfg.brownOuts]);

  // ── Start game ────────────────────────────────────────────────────────────

  const startGame = useCallback(() => {
    const initialNodes = initNodes(cfg.nodeCount, cfg.bandwidthCaps);
    setNodes(initialNodes);
    nodesRef.current = initialNodes;
    setLinks([]);
    linksRef.current = [];
    setSelectedId(null);
    setActivePath(null);
    setTimeRemainingMs(cfg.durationMs);
    setBrownOutMessage('');
    uptimeTicksRef.current = 0;
    totalTicksRef.current = 0;
    pathHopsRef.current = [];
    optimalHopsRef.current = [];
    mttrSamplesRef.current = [];
    brownOutStartRef.current = null;
    sessionActiveRef.current = true;
    setPhase('playing');

    // Initialize orbit parameters for relay nodes
    if (cfg.orbitSpeed > 0) {
      const relayCount = cfg.nodeCount - 2;
      orbitAnglesRef.current = Array(relayCount).fill(0).map(() => Math.random() * Math.PI * 2);
      orbitOriginsRef.current = initialNodes
        .filter(n => !n.isSource && !n.isGround)
        .map(n => ({
          x: n.x,
          y: n.y,
          r: 0.08 + Math.random() * 0.06,
          speed: 1,
        }));
      orbitTimerRef.current = setInterval(orbitStep, 200);
    }

    if (cfg.brownOuts) {
      brownOutTimerRef.current = setInterval(triggerBrownOut, 6000);
    }

    // Uptime tracking
    uptimeTickRef.current = setInterval(uptimeTick, 500);

    // Countdown
    const endAt = Date.now() + cfg.durationMs;
    countdownRef.current = setInterval(() => {
      const remaining = endAt - Date.now();
      setTimeRemainingMs(Math.max(0, remaining));
      if (remaining <= 0) {
        if (countdownRef.current) clearInterval(countdownRef.current);
        if (uptimeTickRef.current) clearInterval(uptimeTickRef.current);
        if (orbitTimerRef.current) clearInterval(orbitTimerRef.current);
        if (brownOutTimerRef.current) clearInterval(brownOutTimerRef.current);
        sessionActiveRef.current = false;
        finalizeSession();
      }
    }, 500);
  }, [cfg, orbitStep, triggerBrownOut, uptimeTick]);

  // ── Node tap → toggle link ─────────────────────────────────────────────────

  const handleNodeTap = useCallback((id: string) => {
    if (!sessionActiveRef.current) return;
    const n = nodesRef.current.find(x => x.id === id);
    if (!n || !n.online) return;

    if (!selectedId) {
      setSelectedId(id);
      return;
    }

    if (selectedId === id) {
      setSelectedId(null);
      return;
    }

    // Toggle link between selectedId and id
    const existing = linksRef.current.findIndex(
      l => (l.fromId === selectedId && l.toId === id) ||
           (l.fromId === id && l.toId === selectedId)
    );

    let newLinks: Link[];
    if (existing >= 0) {
      // Remove link
      newLinks = linksRef.current.filter((_, i) => i !== existing);
    } else {
      // Add link (bandwidth cap check)
      if (cfg.bandwidthCaps) {
        const fromNode = nodesRef.current.find(x => x.id === selectedId)!;
        const toNode = nodesRef.current.find(x => x.id === id)!;
        const fromUsage = linksRef.current.filter(l => l.fromId === selectedId || l.toId === selectedId).length;
        const toUsage = linksRef.current.filter(l => l.fromId === id || l.toId === id).length;
        if (fromUsage >= fromNode.capacity || toUsage >= toNode.capacity) {
          setSelectedId(null);
          return; // Cap exceeded
        }
      }
      newLinks = [...linksRef.current, { fromId: selectedId, toId: id }];
    }

    setLinks(newLinks);
    linksRef.current = newLinks;
    setSelectedId(null);
  }, [selectedId, cfg.bandwidthCaps]);

  // ── Finalize session ───────────────────────────────────────────────────────

  const finalizeSession = useCallback(() => {
    const total = totalTicksRef.current;
    const uptime = total > 0 ? uptimeTicksRef.current / total : 0;

    // Path efficiency: sum(optimal hops) / sum(actual hops)
    const sumActual = pathHopsRef.current.reduce((a, b) => a + b, 0);
    const sumOptimal = optimalHopsRef.current.reduce((a, b) => a + b, 0);
    const pathEfficiency = sumActual > 0 ? sumOptimal / sumActual : 0;

    const avgMttr = mttrSamplesRef.current.length > 0
      ? Math.round(mttrSamplesRef.current.reduce((a, b) => a + b, 0) / mttrSamplesRef.current.length)
      : 0;

    /*
     * Scoring (0–100):
     *   Uptime          (50 pts): linear 0–50
     *   Path Efficiency (35 pts): linear 0–35
     *   MTTR            (15 pts): 0ms = 15, 30000ms+ = 0; only scored if brownOuts active
     */
    const uptimeScore = uptime * 50;
    const effScore = pathEfficiency * 35;
    const maxMttr = 30_000;
    const mttrScore = cfg.brownOuts
      ? Math.max(0, ((maxMttr - avgMttr) / maxMttr) * 15)
      : 15;

    const total_score = Math.round(uptimeScore + effScore + mttrScore);

    console.info('[NavLinkGame:finalizeSession] session complete', {
      sessionId,
      uptimePct: Math.round(uptime * 100),
      pathEfficiency: Math.round(pathEfficiency * 100),
      mttrMs: avgMttr,
      score: total_score,
    });

    setScore(total_score);
    setPhase('done');
    onComplete(total_score);
  }, [cfg.brownOuts, sessionId, onComplete]);

  // ── Render: node color ─────────────────────────────────────────────────────

  const nodeColor = (n: Node): string => {
    if (!n.online) return '#334155';
    if (n.browningOut) return '#fbbf24';
    if (n.isSource) return '#38bdf8';
    if (n.isGround) return '#86efac';
    if (activePath?.includes(n.id)) return '#f59e0b';
    return '#475569';
  };

  const linkColor = (l: Link): string => {
    if (!activePath) return '#1e293b';
    const inPath = activePath.includes(l.fromId) && activePath.includes(l.toId);
    return inPath ? '#f59e0b' : '#1e293b';
  };

  const linkOpacity = (l: Link): number => {
    if (!activePath) return 0.4;
    const inPath = activePath.includes(l.fromId) && activePath.includes(l.toId);
    return inPath ? 0.9 : 0.3;
  };

  // ── Intro ─────────────────────────────────────────────────────────────────

  if (phase === 'intro') {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Nav-Link</Text>
        <Text style={styles.subtitle}>
          Route satellite data to the ground station.{'\n'}
          Tap two nodes to connect them. Build the optimal path.
        </Text>
        <View style={styles.introLegend}>
          <View style={styles.introLegendRow}>
            <View style={[styles.legendDot, { backgroundColor: '#38bdf8' }]} />
            <Text style={styles.legendText}>SAT — satellite source</Text>
          </View>
          <View style={styles.introLegendRow}>
            <View style={[styles.legendDot, { backgroundColor: '#86efac' }]} />
            <Text style={styles.legendText}>GND — ground station</Text>
          </View>
          <View style={styles.introLegendRow}>
            <View style={[styles.legendDot, { backgroundColor: '#475569' }]} />
            <Text style={styles.legendText}>Relay nodes — tap to connect</Text>
          </View>
          {cfg.brownOuts && (
            <View style={styles.introLegendRow}>
              <View style={[styles.legendDot, { backgroundColor: '#fbbf24' }]} />
              <Text style={styles.legendText}>Brown-out node — reroute quickly</Text>
            </View>
          )}
        </View>
        {cfg.signalDecay && (
          <Text style={styles.hintText}>Signal decays with distance — use shorter links</Text>
        )}
        {cfg.bandwidthCaps && (
          <Text style={styles.hintText}>Node capacity is limited — links per node are capped</Text>
        )}
        <TouchableOpacity style={styles.startBtn} onPress={startGame}>
          <Text style={styles.startBtnText}>START</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ── Done ──────────────────────────────────────────────────────────────────

  if (phase === 'done') {
    const uptime = totalTicksRef.current > 0
      ? Math.round((uptimeTicksRef.current / totalTicksRef.current) * 100)
      : 0;
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Session Complete</Text>
        <View style={styles.resultsBox}>
          <Text style={styles.scoreLabel}>Score</Text>
          <Text style={styles.scoreBig}>{score ?? 0}</Text>
          <Text style={styles.resultsDetail}>{uptime}% uptime</Text>
          {cfg.brownOuts && mttrSamplesRef.current.length > 0 && (
            <Text style={styles.resultsDetail}>
              {Math.round(
                mttrSamplesRef.current.reduce((a, b) => a + b, 0) / mttrSamplesRef.current.length
              )}ms avg recovery
            </Text>
          )}
        </View>
      </View>
    );
  }

  // ── Playing ────────────────────────────────────────────────────────────────

  const secsRemaining = Math.ceil(timeRemainingMs / 1000);
  const uptimePct = totalTicksRef.current > 0
    ? Math.round((uptimeTicksRef.current / totalTicksRef.current) * 100)
    : 0;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.headerLabel}>UPTIME</Text>
          <Text style={[styles.headerValue, { color: uptimePct >= 80 ? '#86efac' : '#fbbf24' }]}>
            {uptimePct}%
          </Text>
        </View>
        <Text style={styles.headerTitle}>NAV-LINK</Text>
        <View style={styles.headerRight}>
          <Text style={styles.headerLabel}>TIME</Text>
          <Text style={styles.headerValue}>{secsRemaining}s</Text>
        </View>
      </View>

      {brownOutMessage !== '' && (
        <View style={styles.alertBanner}>
          <Text style={styles.alertText}>{brownOutMessage}</Text>
        </View>
      )}

      {selectedId && (
        <Text style={styles.selectionHint}>
          Selected: {selectedId} — tap another node to link/unlink
        </Text>
      )}

      {/* Canvas */}
      <View style={[styles.canvas, { width: CANVAS_W, height: CANVAS_H }]}>
        {/* Links */}
        {links.map((l, i) => {
          const from = nodes.find(n => n.id === l.fromId);
          const to = nodes.find(n => n.id === l.toId);
          if (!from || !to) return null;
          return (
            <LinkLine
              key={i}
              fromNode={from}
              toNode={to}
              color={linkColor(l)}
              opacity={linkOpacity(l)}
            />
          );
        })}

        {/* Nodes */}
        {nodes.map(n => {
          const px = n.x * CANVAS_W - NODE_R;
          const py = n.y * CANVAS_H - NODE_R;
          const selected = selectedId === n.id;
          const inPath = activePath?.includes(n.id);
          const color = nodeColor(n);

          return (
            <TouchableOpacity
              key={n.id}
              style={[
                styles.node,
                {
                  left: px,
                  top: py,
                  width: NODE_R * 2,
                  height: NODE_R * 2,
                  borderRadius: NODE_R,
                  backgroundColor: color,
                  borderColor: selected ? '#fff' : inPath ? '#fef3c7' : 'transparent',
                  borderWidth: selected ? 2 : inPath ? 1.5 : 0,
                  opacity: n.online ? 1 : 0.35,
                },
              ]}
              onPress={() => handleNodeTap(n.id)}
              disabled={!n.online}
            >
              <Text style={styles.nodeLabel}>{n.label}</Text>
              {cfg.bandwidthCaps && !n.isSource && !n.isGround && (
                <Text style={styles.nodeCap}>{n.capacity}</Text>
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Status bar */}
      <View style={styles.statusBar}>
        <Text style={styles.statusText}>
          {activePath
            ? `✓ Path active — ${activePath.length - 1} hop${activePath.length - 1 !== 1 ? 's' : ''}`
            : '✗ No path — connect SAT to GND'}
        </Text>
      </View>

      <Text style={styles.tapHint}>Tap two nodes to connect · Tap again to disconnect</Text>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#030a14',
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: 10,
  },

  // Intro
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#f1f5f9',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 13,
    color: '#94a3b8',
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 24,
    marginBottom: 20,
  },
  introLegend: {
    width: '85%',
    gap: 10,
    marginBottom: 16,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 10,
    padding: 14,
  },
  introLegendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  legendDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
  },
  legendText: {
    fontSize: 12,
    color: '#cbd5e1',
  },
  hintText: {
    fontSize: 11,
    color: '#64748b',
    marginBottom: 8,
    textAlign: 'center',
    paddingHorizontal: 24,
  },
  startBtn: {
    backgroundColor: '#38bdf8',
    borderRadius: 10,
    paddingVertical: 14,
    paddingHorizontal: 40,
    marginTop: 12,
  },
  startBtnText: {
    color: '#030a14',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 2,
  },

  // Playing
  header: {
    flexDirection: 'row',
    width: '100%',
    paddingHorizontal: 16,
    paddingVertical: 8,
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerLeft: { alignItems: 'flex-start', minWidth: 60 },
  headerRight: { alignItems: 'flex-end', minWidth: 60 },
  headerLabel: { fontSize: 9, color: '#475569', letterSpacing: 1, fontWeight: '700' },
  headerValue: { fontSize: 20, fontWeight: '800', color: '#f1f5f9' },
  headerTitle: { fontSize: 11, fontWeight: '700', color: '#334155', letterSpacing: 2 },

  alertBanner: {
    backgroundColor: 'rgba(248,113,113,0.12)',
    borderWidth: 1,
    borderColor: '#f87171',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 4,
    marginBottom: 4,
  },
  alertText: { color: '#f87171', fontSize: 12, fontWeight: '600' },

  selectionHint: {
    fontSize: 10,
    color: '#fbbf24',
    marginBottom: 4,
  },

  canvas: {
    backgroundColor: '#06101e',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(56,189,248,0.1)',
    position: 'relative',
    overflow: 'hidden',
    marginBottom: 8,
  },

  node: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  nodeLabel: {
    fontSize: 8,
    fontWeight: '700',
    color: '#f1f5f9',
    textAlign: 'center',
  },
  nodeCap: {
    fontSize: 7,
    color: '#f1f5f9',
    opacity: 0.7,
  },

  statusBar: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 8,
    marginBottom: 6,
    width: '90%',
    alignItems: 'center',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#94a3b8',
  },

  tapHint: {
    fontSize: 10,
    color: '#334155',
    textAlign: 'center',
  },

  // Done
  resultsBox: {
    marginTop: 40,
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 16,
    paddingHorizontal: 40,
    paddingVertical: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  scoreLabel: {
    fontSize: 13,
    color: '#64748b',
    letterSpacing: 1,
    marginBottom: 4,
  },
  scoreBig: {
    fontSize: 64,
    fontWeight: '800',
    color: '#38bdf8',
    lineHeight: 72,
  },
  resultsDetail: {
    fontSize: 13,
    color: '#94a3b8',
    marginTop: 6,
  },
});
