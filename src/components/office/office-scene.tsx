'use client';

import { useEffect, useRef, useState } from 'react';
import { PixelCharacter } from './office-character';
import { characters, hippoRotationOrder } from './office-data';

// ─── Types ────────────────────────────────────────────────────────────────────
type Pos = { x: number; y: number };
type PosMap = Record<string, Pos>;

// ─── Ping-pong table obstacle ─────────────────────────────────────────────────
// Table rendered at x=338, y=346, w=160, h=85 → x2=498, y2=431
// Characters (half-width ~14px) must not enter this zone
const TABLE_ZONE = { x1: 324, y1: 332, x2: 512, y2: 445 }; // with 14px margin

function pushOutOfTable(pos: Pos): Pos {
  const { x1, y1, x2, y2 } = TABLE_ZONE;
  if (pos.x <= x1 || pos.x >= x2 || pos.y <= y1 || pos.y >= y2) return pos;
  // Inside — push out along shortest axis
  const dLeft   = pos.x - x1;
  const dRight  = x2 - pos.x;
  const dTop    = pos.y - y1;
  const dBottom = y2 - pos.y;
  const min = Math.min(dLeft, dRight, dTop, dBottom);
  if (min === dLeft)   return { x: x1,     y: pos.y };
  if (min === dRight)  return { x: x2,     y: pos.y };
  if (min === dTop)    return { x: pos.x,  y: y1    };
  return                      { x: pos.x,  y: y2    };
}

// ─── Leisure waypoints for idle wandering ─────────────────────────────────────
// Open-floor spots in the lower half — avoids desks, ping-pong table, arcade cabinet
const LEISURE_WP: Pos[] = [
  { x: 164, y: 412 }, // near coffee table
  { x: 270, y: 454 }, // coffee table zone
  { x: 292, y: 392 }, // left of pingis table
  { x: 528, y: 392 }, // right of pingis table
  { x: 634, y: 424 }, // open floor right-mid
  { x: 784, y: 464 }, // far right bottom
  { x: 864, y: 388 }, // far right mid
  { x: 694, y: 340 }, // right of coordinator
  { x: 564, y: 316 }, // mid open
  { x: 430, y: 490 }, // bottom center
];

// Per-character starting offset so they spread out immediately
const IDLE_OFFSET: Record<string, number> = {
  quan: 0, jerry: 2, kicko: 4, david: 6, hippo: 8,
  jan: 1, krister: 3, tony: 5,
};

function leisureWp(charId: string, idx: number): Pos {
  const off = IDLE_OFFSET[charId] ?? 0;
  return LEISURE_WP[(off + idx) % LEISURE_WP.length];
}

// ─── Stand positions ───────────────────────────────────────────────────────────
// Desk layout (all along back wall, y=108): BACKEND=x60, APP/WEB=x250, SALES=x440, DESIGN=x630, COORD=x830(w=110)
// Pingis table: x=338 to x=498 (w=160), y=346–431; chars stand at sides x≈314 / x≈510
const standPos: Record<string, Pos> = {
  backend:      { x: 135, y: 168 },
  appWebsite:   { x: 325, y: 168 },
  sales:        { x: 515, y: 168 },
  design:       { x: 705, y: 168 },
  coordinator:  { x: 885, y: 168 },
  pingis_left:  { x: 314, y: 392 }, // left side of table
  pingis_right: { x: 510, y: 392 }, // right side of table
  arcade:       { x: 148, y: 392 },
  patrol_0:     { x:  58, y: 290 },
  patrol_1:     { x: 196, y: 440 },
  patrol_2:     { x:  96, y: 464 },
  patrol_3:     { x:  28, y: 356 },
};

// All chars start at leisure positions (agent status unknown until first fetch)
function buildInitialPositions(): PosMap {
  const result: PosMap = {};
  for (const char of characters) {
    if (char.id === 'anton') {
      result[char.id] = { ...standPos.patrol_0 };
    } else if (char.id === 'jan') {
      result[char.id] = { ...standPos.pingis_left };
    } else if (char.id === 'krister') {
      result[char.id] = { ...standPos.pingis_right };
    } else if (char.id === 'tony') {
      result[char.id] = { ...standPos.arcade };
    } else {
      result[char.id] = { ...leisureWp(char.id, 0) };
    }
  }
  return result;
}

// ─── Static decorations ───────────────────────────────────────────────────────

function Desk({ x, y, label }: { x: number; y: number; label: string }) {
  const dw = 150;
  const mx = x + dw / 2 - 46;
  const standX = x + dw / 2 - 3;
  return (
    <g>
      {/* PC tower */}
      <rect x={x + 4} y={y - 44} width={20} height={42} fill="#1a1a1a" rx={2} />
      <rect x={x + 7} y={y - 36} width={12} height={5} fill="#2a2a2a" />
      <circle cx={x + 20} cy={y - 10} r={2.5} fill="#00ff00" />
      <circle cx={x + 20} cy={y - 20} r={2.5} fill="#ffaa00" />
      {/* Monitor stand */}
      <rect x={standX} y={y - 24} width={7} height={24} fill="#444" />
      <rect x={standX - 10} y={y - 24} width={27} height={5} fill="#555" />
      {/* Monitor — larger and bolder */}
      <rect x={mx} y={y - 90} width={92} height={66} rx={3} fill="#111" />
      <rect x={mx + 4} y={y - 86} width={84} height={52} fill="#0a1e30" />
      <text
        x={mx + 46} y={y - 60}
        textAnchor="middle" dominantBaseline="middle"
        fontSize={12} fontFamily="monospace" fontWeight="bold" fill="white"
        letterSpacing="1"
      >{label}</text>
      {/* Screen glow line */}
      <rect x={mx + 4} y={y - 86} width={84} height={3} fill="#1a4a70" opacity={0.8} />
      {/* Desk surface */}
      <rect x={x} y={y} width={dw} height={22} fill="#c8a96e" />
      {/* Isometric front face — 3D depth */}
      <rect x={x} y={y + 22} width={dw} height={16} fill="#8a5e28" />
      {/* Keyboard on surface */}
      <rect x={x + 48} y={y + 6} width={58} height={12} fill="#333" rx={2} />
      <rect x={x + 51} y={y + 9} width={52} height={7} fill="#444" rx={1} />
      {/* Desk legs */}
      <rect x={x + 10} y={y + 38} width={9} height={38} fill="#7a5a28" />
      <rect x={x + 131} y={y + 38} width={9} height={38} fill="#7a5a28" />
    </g>
  );
}

function CoordDesk({ x, y }: { x: number; y: number }) {
  const dw = 110;
  const mx = x + dw / 2 - 32;
  const standX = x + dw / 2 - 3;
  return (
    <g>
      {/* Monitor stand */}
      <rect x={standX} y={y - 20} width={6} height={20} fill="#444" />
      <rect x={standX - 8} y={y - 20} width={22} height={4} fill="#444" />
      {/* Monitor */}
      <rect x={mx} y={y - 64} width={66} height={46} rx={3} fill="#111" />
      <rect x={mx + 4} y={y - 60} width={58} height={35} fill="#0d2a44" />
      <text x={mx + 33} y={y - 42} textAnchor="middle" dominantBaseline="middle"
        fontSize={9} fontFamily="monospace" fontWeight="bold" fill="white">COORD</text>
      {/* Desk surface */}
      <rect x={x} y={y} width={dw} height={18} fill="#c8a96e" />
      {/* Isometric front face */}
      <rect x={x} y={y + 18} width={dw} height={12} fill="#8a5e28" />
      {/* Keyboard */}
      <rect x={x + 36} y={y + 5} width={40} height={9} fill="#333" rx={1} />
      <rect x={x + 39} y={y + 7} width={34} height={5} fill="#444" rx={1} />
      {/* Desk legs */}
      <rect x={x + 8} y={y + 30} width={7} height={30} fill="#7a5a28" />
      <rect x={x + 95} y={y + 30} width={7} height={30} fill="#7a5a28" />
    </g>
  );
}

// Ping-pong table — clean overhead view matching reference style
// Table occupies x=340–500, y=340–430 — chars stand at x≈312 and x≈520 (the sides)
function PingPongTable({ x, y }: { x: number; y: number }) {
  const w = 160, h = 85;
  const cy = y + h / 2;
  return (
    <g>
      {/* Table surface */}
      <rect x={x} y={y} width={w} height={h} fill="#2a9a4a" rx={2} />
      {/* Isometric front face */}
      <rect x={x} y={y + h} width={w} height={10} fill="#1a6a30" />
      {/* White border lines */}
      <rect x={x + 4} y={y + 4} width={w - 8} height={h - 8} fill="none" stroke="white" strokeWidth={2} />
      {/* Center net — vertical line */}
      <rect x={x + w / 2 - 2} y={y} width={4} height={h} fill="#f0f0f0" />
      {/* Net shadow on table */}
      <rect x={x + w / 2 - 1} y={y} width={2} height={h} fill="#ccc" opacity={0.5} />
      {/* Table legs */}
      <rect x={x + 8}      y={y + h + 10} width={8} height={12} fill="#155225" />
      <rect x={x + w - 16} y={y + h + 10} width={8} height={12} fill="#155225" />
      {/* Paddles — small rectangles on sides, NOT on the table */}
      <rect x={x - 14} y={cy - 7} width={10} height={14} rx={2} fill="#cc3322" />
      <rect x={x - 12} y={cy - 5} width={6} height={10} rx={1} fill="#dd4433" />
      <rect x={x + w + 4} y={cy - 7} width={10} height={14} rx={2} fill="#2233cc" />
      <rect x={x + w + 6} y={cy - 5} width={6} height={10} rx={1} fill="#3344dd" />
      {/* Animated ball */}
      <circle r={4} fill="white" opacity={0.95} stroke="#ddd" strokeWidth={0.5}>
        <animate attributeName="cx"
          values={`${x + 26};${x + w - 26};${x + 26}`}
          dur="1.6s" repeatCount="indefinite"
          calcMode="linear" />
        <animate attributeName="cy"
          values={`${cy - 3};${cy + 3};${cy - 3}`}
          dur="0.8s" repeatCount="indefinite"
          calcMode="linear" />
      </circle>
    </g>
  );
}

function ArcadeMachine({ x, y }: { x: number; y: number }) {
  const w = 60, h = 120;
  const bx = x + (w - 44) / 2;
  const cpY = y + 52;
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} fill="#1a2a6a" rx={3} />
      <rect x={bx} y={y + 8} width={44} height={38} fill="#0a0a0a" rx={2} />
      <rect x={bx + 3} y={y + 11} width={38} height={32} fill="#f0a000" rx={1} />
      <rect x={bx + 6}  y={y + 14} width={6} height={6} fill="#00cc00" />
      <rect x={bx + 15} y={y + 14} width={6} height={6} fill="#cc0000" />
      <rect x={bx + 24} y={y + 14} width={6} height={6} fill="white" />
      <rect x={bx + 10} y={y + 22} width={18} height={4} fill="#00aaff" />
      <text x={x + w / 2} y={y + 54} textAnchor="middle" fontSize={8}
        fontFamily="monospace" fontWeight="bold" fill="#cc0000">ARCADE</text>
      <rect x={bx} y={cpY} width={44} height={18} fill="#2a3a8a" rx={1} />
      <line x1={bx + 8} y1={cpY + 5} x2={bx + 8} y2={cpY + 15} stroke="#555" strokeWidth={2} />
      <circle cx={bx + 8} cy={cpY + 5} r={4} fill="#aaa" />
      <circle cx={bx + 24} cy={cpY + 9} r={3} fill="#cc0000" />
      <circle cx={bx + 32} cy={cpY + 6} r={3} fill="#cc0000" />
      <circle cx={bx + 32} cy={cpY + 14} r={3} fill="#cc0000" />
      <rect x={x - 4} y={y + h} width={w + 8} height={8} fill="#0a1a5a" rx={1} />
    </g>
  );
}

function ServerRack({ x, y }: { x: number; y: number }) {
  const w = 40, h = 140;
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} fill="#2a2a2a" rx={2} />
      {[0,1,2,3,4].map(i => (
        <line key={i} x1={x + 2} y1={y + 20 + i * 24} x2={x + w - 2} y2={y + 20 + i * 24}
          stroke="#444" strokeWidth={1} />
      ))}
      <circle cx={x + w - 6} cy={y + 16} r={3} fill="#00ff00" />
      <circle cx={x + w - 6} cy={y + 40} r={3} fill="#ffaa00" />
      <circle cx={x + w - 6} cy={y + 64} r={3} fill="#00ff00" />
      <text x={x + w / 2} y={y + h + 12} textAnchor="middle" fontSize={7} fontFamily="monospace" fill="#888">SERVER</text>
    </g>
  );
}

function Plant({ x, y }: { x: number; y: number }) {
  return (
    <g>
      {/* Pot */}
      <rect x={x + 4} y={y + 18} width={18} height={14} rx={2} fill="#c46a30" />
      {/* Pot front face */}
      <rect x={x + 4} y={y + 28} width={18} height={6} rx={1} fill="#a04a18" />
      {/* Foliage — chunky square blocks like reference */}
      <rect x={x} y={y} width={26} height={22} rx={2} fill="#3a8e3a" />
      {/* Foliage top highlight */}
      <rect x={x + 2} y={y + 2} width={22} height={8} rx={1} fill="#4aaa4a" />
      {/* Foliage shadow */}
      <rect x={x} y={y + 16} width={26} height={6} rx={1} fill="#2a6e2a" />
    </g>
  );
}

function BulletinBoard({ x, y }: { x: number; y: number }) {
  const w = 60, h = 80;
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} fill="#c8a060" rx={2} />
      <rect x={x} y={y} width={w} height={h} fill="none" stroke="#8a6040" strokeWidth={3} rx={2} />
      <rect x={x + 6}  y={y + 8}  width={22} height={14} fill="white"   rx={1} />
      <rect x={x + 32} y={y + 8}  width={20} height={14} fill="#ffffc0"  rx={1} />
      <rect x={x + 6}  y={y + 28} width={18} height={22} fill="#fff0f0"  rx={1} />
      <rect x={x + 28} y={y + 28} width={24} height={10} fill="white"    rx={1} />
      <rect x={x + 28} y={y + 44} width={24} height={10} fill="#f0fff0"  rx={1} />
      <rect x={x + 8}  y={y + 58} width={44} height={10} fill="#ffffc0"  rx={1} />
      <circle cx={x + 4}      cy={y + 4}      r={3} fill="#cc2222" />
      <circle cx={x + w - 4}  cy={y + 4}      r={3} fill="#cc2222" />
      <circle cx={x + 4}      cy={y + h - 4}  r={3} fill="#cc2222" />
      <circle cx={x + w - 4}  cy={y + h - 4}  r={3} fill="#cc2222" />
    </g>
  );
}

function CoffeeTable({ x, y }: { x: number; y: number }) {
  const w = 80, h = 30;
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} fill="#b08040" rx={2} />
      <rect x={x + 8}      y={y + h} width={8} height={14} fill="#8a6030" />
      <rect x={x + w - 16} y={y + h} width={8} height={14} fill="#8a6030" />
      <rect x={x + 16} y={y + 6} width={12} height={14} fill="white" rx={1} />
      <rect x={x + 52} y={y + 6} width={12} height={14} fill="white" rx={1} />
    </g>
  );
}

function StairsBlock({ x, y }: { x: number; y: number }) {
  return (
    <g>
      <rect x={x}      y={y + 24} width={40} height={8}  fill="#b0a090" />
      <rect x={x + 6}  y={y + 16} width={34} height={8}  fill="#c0b0a0" />
      <rect x={x + 12} y={y + 8}  width={28} height={8}  fill="#d0c0b0" />
      <rect x={x + 18} y={y}      width={22} height={8}  fill="#e0d0c0" />
    </g>
  );
}

function StaticScene() {
  return (
    <>
      {/* Floor — warm grey like the reference */}
      <rect x={0} y={0} width={960} height={560} fill="#b8b4ac" />
      {/* Back wall — solid with slight blue tint, gives the "room" feel */}
      <rect x={0} y={0} width={960} height={200} fill="#8ab8d8" />
      {/* Wall-to-floor transition shadow */}
      <rect x={0} y={196} width={960} height={12} fill="#5a7a90" opacity={0.5} />
      {/* Wall baseboard */}
      <rect x={0} y={186} width={960} height={10} fill="#4a6a80" opacity={0.6} />
      {/* Floor separator line */}
      <line x1={0} y1={208} x2={960} y2={208} stroke="#888" strokeWidth={1} opacity={0.3} />
      {/* Server rack in corner */}
      <ServerRack x={18} y={60} />
      {/* Desks — all along back wall y=108: BACKEND, APP/WEB, SALES, DESIGN, COORD */}
      <Desk x={60}  y={108} label="BACKEND" />
      <Desk x={250} y={108} label="APP/WEB" />
      <Desk x={440} y={108} label="SALES" />
      <Desk x={630} y={108} label="DESIGN" />
      <CoordDesk x={830} y={108} />
      {/* Plants in wall gaps between stations */}
      <Plant x={218} y={68} />
      <Plant x={788} y={68} />
      {/* Bulletin board in open floor area */}
      <BulletinBoard x={820} y={370} />
      {/* Leisure area */}
      <ArcadeMachine x={118} y={316} />
      <PingPongTable x={338} y={346} />
      <CoffeeTable x={196} y={432} />
      <StairsBlock x={48} y={436} />
      {/* Legend */}
      <rect x={330} y={526} width={300} height={24} rx={4} fill="#222" />
      <rect x={344} y={534} width={8} height={8} fill="#3b82f6" />
      <text x={358} y={543} fontSize={10} fontFamily="monospace" fill="white" dominantBaseline="middle">WORKING (at computer)</text>
      <rect x={520} y={534} width={8} height={8} fill="#555" />
      <text x={534} y={543} fontSize={10} fontFamily="monospace" fill="white" dominantBaseline="middle">IDLE</text>
      <text x={952} y={16} textAnchor="end" fontSize={11} fontFamily="monospace" fill="#cce" letterSpacing="2">OFFICE</text>
    </>
  );
}

// ─── Agent id/name → character id mapping ────────────────────────────────────
// Maps actual openclaw agent IDs and lowercased names → office character ID
const AGENT_ID_TO_CHAR: Record<string, string> = {
  // by agent id (preferred — stable)
  'backend':           'quan',
  'app':               'jerry',
  'website':           'jerry',
  'coord':             'hippo',
  'security-sentinel': 'anton',
  // by lowercased agent name (fallback)
  'backend agent':     'quan',
  'app agent':         'jerry',
  'website agent':     'jerry',
  'coordinator':       'hippo',
  'security sentinel': 'anton',
  // direct name match (future-proof)
  'quan': 'quan', 'jerry': 'jerry', 'kicko': 'kicko',
  'david': 'david', 'hippo': 'hippo', 'anton': 'anton',
};

// Work station for each char (single primary station)
const PRIMARY_STATION: Record<string, string> = {
  quan: 'backend', jerry: 'appWebsite', kicko: 'sales',
  david: 'design', hippo: 'coordinator',
};

// ─── Main scene ───────────────────────────────────────────────────────────────
export function OfficeScene() {
  const [renderPositions, setRenderPositions] = useState<PosMap>(() => buildInitialPositions());
  const [activeAgentIds, setActiveAgentIds] = useState<Set<string>>(new Set());

  const positionsRef     = useRef<PosMap>(buildInitialPositions());
  const targetsRef       = useRef<PosMap>(buildInitialPositions());
  const rafRef           = useRef<number | null>(null);
  const lastRenderRef    = useRef<number>(0);
  const hippoIndexRef    = useRef(0);
  const antonIndexRef    = useRef(0);
  // Per-char leisure waypoint index
  const idleIndexRef     = useRef<Record<string, number>>({
    quan: 0, jerry: 0, kicko: 0, david: 0, hippo: 0, jan: 0, krister: 0, tony: 0,
  });
  // Track active state per char so we can react to changes
  const activeRef        = useRef<Set<string>>(new Set());

  // ── Agent polling ──────────────────────────────────────────────────────────
  useEffect(() => {
    async function fetchAgents() {
      try {
        const res = await fetch('/api/agents', { cache: 'no-store' });
        if (!res.ok) return;
        const data = await res.json() as { agents?: Array<{ id: string; name: string; status: string }> };
        if (!data.agents) return;
        const active = new Set<string>();
        for (const agent of data.agents) {
          const charId =
            AGENT_ID_TO_CHAR[agent.id?.toLowerCase() ?? ''] ??
            AGENT_ID_TO_CHAR[agent.name?.toLowerCase() ?? ''];
          if (charId && agent.status === 'active') active.add(charId);
        }
        setActiveAgentIds(active);
      } catch {
        // silent fail — keep previous state
      }
    }
    fetchAgents();
    const poll = setInterval(fetchAgents, 10_000);
    return () => clearInterval(poll);
  }, []);

  // ── React to activeAgentIds changes: update targets ───────────────────────
  useEffect(() => {
    const prev = activeRef.current;
    // Chars that just became active → send to work station
    for (const charId of activeAgentIds) {
      if (!prev.has(charId)) {
        const stationKey = charId === 'hippo'
          ? hippoRotationOrder[hippoIndexRef.current]
          : PRIMARY_STATION[charId];
        const sp = stationKey ? standPos[stationKey] : null;
        if (sp) targetsRef.current = { ...targetsRef.current, [charId]: { ...sp } };
      }
    }
    // Chars that just became idle → send to leisure waypoint
    for (const charId of prev) {
      if (!activeAgentIds.has(charId)) {
        const idx = idleIndexRef.current[charId] ?? 0;
        targetsRef.current = { ...targetsRef.current, [charId]: { ...leisureWp(charId, idx) } };
      }
    }
    activeRef.current = new Set(activeAgentIds);
  }, [activeAgentIds]);

  // ── Animation loop ─────────────────────────────────────────────────────────
  useEffect(() => {
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) return;

    function animate() {
      if (document.visibilityState !== 'visible') {
        rafRef.current = null;
        return;
      }
      const pos = positionsRef.current;
      const targets = targetsRef.current;
      const next: PosMap = {};
      const STEP = 0.5;
      for (const id of Object.keys(pos)) {
        const p = pos[id];
        const t = targets[id];
        if (!p || !t) { if (p) next[id] = p; continue; }
        const dx = t.x - p.x;
        const dy = t.y - p.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const raw = dist <= STEP
          ? { x: t.x, y: t.y }
          : { x: p.x + (dx / dist) * STEP, y: p.y + (dy / dist) * STEP };
        next[id] = pushOutOfTable(raw);
      }
      positionsRef.current = next;
      const now = performance.now();
      if (now - lastRenderRef.current >= 500) {
        lastRenderRef.current = now;
        setRenderPositions({ ...next });
      }
      rafRef.current = requestAnimationFrame(animate);
    }

    function start() {
      if (rafRef.current === null && document.visibilityState === 'visible')
        rafRef.current = requestAnimationFrame(animate);
    }
    const onVisibility = () => { if (document.visibilityState === 'visible') start(); };
    document.addEventListener('visibilitychange', onVisibility);
    start();

    // Hippo cycles work stations every 8s (only when active)
    const hippoTimer = setInterval(() => {
      hippoIndexRef.current = (hippoIndexRef.current + 1) % hippoRotationOrder.length;
      if (activeRef.current.has('hippo')) {
        const key = hippoRotationOrder[hippoIndexRef.current];
        const sp = standPos[key];
        if (sp) targetsRef.current = { ...targetsRef.current, hippo: { ...sp } };
      }
    }, 8000);

    // Anton patrols every 5s (always)
    const antonTimer = setInterval(() => {
      antonIndexRef.current = (antonIndexRef.current + 1) % 4;
      const sp = standPos[`patrol_${antonIndexRef.current}`];
      if (sp) targetsRef.current = { ...targetsRef.current, anton: { ...sp } };
    }, 5000);

    // Idle workers wander every 7s (only when NOT active)
    const idleWorkers = ['quan', 'jerry', 'kicko', 'david', 'hippo'];
    const idleTimers = idleWorkers.map((charId, i) =>
      setInterval(() => {
        if (!activeRef.current.has(charId)) {
          const ref = idleIndexRef.current;
          ref[charId] = (ref[charId] + 1) % LEISURE_WP.length;
          const wp = leisureWp(charId, ref[charId]);
          targetsRef.current = { ...targetsRef.current, [charId]: { ...wp } };
        }
      }, 7000 + i * 600) // stagger so they don't all move at same time
    );

    // Jan/Krister/Tony cycle pingis ↔ arcade ↔ open floor
    const leisureChars: Array<[string, string[]]> = [
      ['jan',     ['pingis_left',  'arcade']],
      ['krister', ['pingis_right', 'arcade']],
      ['tony',    ['pingis_left',  'arcade']],
    ];
    const leisureTimers = leisureChars.map(([charId, keys], i) => {
      let idx = 0;
      return setInterval(() => {
        idx = (idx + 1) % keys.length;
        const sp = standPos[keys[idx]];
        if (sp) targetsRef.current = { ...targetsRef.current, [charId]: { ...sp } };
      }, 6000 + i * 800);
    });

    return () => {
      if (rafRef.current !== null) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
      document.removeEventListener('visibilitychange', onVisibility);
      clearInterval(hippoTimer);
      clearInterval(antonTimer);
      idleTimers.forEach(clearInterval);
      leisureTimers.forEach(clearInterval);
    };
  }, []);

  function getCharState(charId: string, pos: Pos): 'working' | 'idle' | 'patrolling' {
    if (charId === 'anton') return 'patrolling';
    if (!activeAgentIds.has(charId)) return 'idle';
    // Near a work station?
    const workStations = ['backend', 'appWebsite', 'sales', 'design', 'coordinator'];
    for (const stId of workStations) {
      const sp = standPos[stId];
      if (sp && Math.abs(pos.x - sp.x) < 45 && Math.abs(pos.y - sp.y) < 45) return 'working';
    }
    return 'idle';
  }

  return (
    <svg
      viewBox="0 0 960 560"
      width={960}
      height={560}
      role="img"
      aria-label="Pixel-art office visualization showing team members at their workstations"
      style={{ display: 'block', border: '1px solid #bbb', flexShrink: 0 }}
    >
      <title>OpenClaw Office</title>
      <StaticScene />
      {characters.map(char => {
        const pos = renderPositions[char.id] ?? buildInitialPositions()[char.id];
        const state = getCharState(char.id, pos);
        return (
          <PixelCharacter
            key={char.id}
            name={char.name}
            shirtColor={char.shirtColor}
            pantsColor={char.pantsColor}
            x={pos.x}
            y={pos.y}
            state={state}
          />
        );
      })}
    </svg>
  );
}
