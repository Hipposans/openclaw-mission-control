'use client';

export type CharacterFacing = 'front' | 'back';

interface PixelCharacterProps {
  name: string;
  shirtColor: string;
  pantsColor: string;
  x: number;
  y: number;
  state: 'working' | 'idle' | 'patrolling';
  isActive?: boolean;
  facing?: CharacterFacing;
}

export function PixelCharacter({ name, shirtColor, pantsColor, x, y, state, isActive, facing }: PixelCharacterProps) {
  const isFront = facing !== undefined ? facing === 'front' : state !== 'working';
  const isWorking = state === 'working';

  // Character drawn centered at (x, y = bottom)
  // Scaled up to ~80px tall for better visibility (1.3x from original 60px)
  const cx = x;
  const by = y;

  // From bottom up (1.3x scale):
  const shoeH = 7, shoeW = 14;
  const legH = 18, legW = 14;
  const torsoH = 23, torsoW = 32;
  const neckH = 7, neckW = 11;
  const headH = 24, headW = 26;
  const hairH = 9;
  const armH = 18, armW = 9;

  const shoeY  = by - shoeH;
  const legY   = shoeY - legH;
  const torsoY = legY - torsoH;
  const neckY  = torsoY - neckH;
  const headY  = neckY - headH;
  const totalH = shoeH + legH + torsoH + neckH + headH; // ~79px

  // Label above head
  const labelText = name.toUpperCase();
  const labelW = labelText.length * 5.5 + 14;
  const labelX = cx - labelW / 2;
  const labelY = headY - 10;
  // Dot is blue if the agent is active (even while walking to their desk), gray otherwise
  const dotColor = isActive ? '#3b82f6' : '#888888';

  // ── Working / sitting (back-facing) ──────────────────────────────────────
  if (isWorking) {
    const sitOffset = 10;
    const sy = by - sitOffset;
    const sShoeY  = sy - 6;
    const sLegY   = sShoeY - 12;
    const sTorsoY = sLegY - 22;
    const sNeckY  = sTorsoY - 6;
    const sHeadY  = sNeckY - 22;
    const sLabelY = sHeadY - 10;
    const sLabelX = cx - labelW / 2;
    return (
      <g aria-label={name}>
        {/* Shoes */}
        <rect x={cx - 14} y={sShoeY}  width={12} height={6} fill="#1a1a1a" />
        <rect x={cx + 2}  y={sShoeY}  width={12} height={6} fill="#1a1a1a" />
        {/* Legs (short, sitting) */}
        <rect x={cx - 13} y={sLegY}   width={11} height={12} fill={pantsColor} />
        <rect x={cx + 2}  y={sLegY}   width={11} height={12} fill={pantsColor} />
        {/* Torso */}
        <rect x={cx - 13} y={sTorsoY} width={26} height={22} fill={shirtColor} />
        {/* Arms reaching forward */}
        <rect x={cx - 21} y={sTorsoY + 2} width={9} height={16} fill={shirtColor} />
        <rect x={cx + 12} y={sTorsoY + 2} width={9} height={16} fill={shirtColor} />
        {/* Neck */}
        <rect x={cx - 5}  y={sNeckY}  width={10} height={6}  fill="#f0c896" />
        {/* Head */}
        <rect x={cx - 11} y={sHeadY}  width={22} height={22} rx={2} fill="#f0c896" />
        {/* Hair (back) */}
        <rect x={cx - 11} y={sHeadY}  width={22} height={8}  rx={2} fill="#000000" />
        {/* Name label */}
        <rect x={sLabelX - 2} y={sLabelY - 9} width={labelW + 4} height={12} rx={2} fill="#111" opacity={0.88} />
        <circle cx={sLabelX + 6} cy={sLabelY - 3} r={2.5} fill={dotColor} />
        <text
          x={cx + 3} y={sLabelY - 2}
          textAnchor="middle" dominantBaseline="middle"
          fontSize={8} fontFamily="monospace" fontWeight="bold" fill="white"
        >{labelText}</text>
      </g>
    );
  }

  // ── Idle / front-facing ───────────────────────────────────────────────────
  return (
    <g aria-label={name}>
      {/* Shoes */}
      <rect x={cx - 15} y={shoeY}  width={shoeW} height={shoeH} fill="#1a1a1a" />
      <rect x={cx + 1}  y={shoeY}  width={shoeW} height={shoeH} fill="#1a1a1a" />
      {/* Legs */}
      <rect x={cx - 14} y={legY}   width={legW}  height={legH}  fill={pantsColor} />
      <rect x={cx + 0}  y={legY}   width={legW}  height={legH}  fill={pantsColor} />
      {/* Torso */}
      <rect x={cx - 14} y={torsoY} width={torsoW} height={torsoH} fill={shirtColor} />
      {/* Arms */}
      <rect x={cx - 23} y={torsoY + 2} width={armW} height={armH} fill={shirtColor} />
      <rect x={cx + 14} y={torsoY + 2} width={armW} height={armH} fill={shirtColor} />
      {/* Neck */}
      <rect x={cx - 5}  y={neckY}  width={neckW}  height={neckH}  fill="#f0c896" />
      {/* Head */}
      <rect x={cx - 13} y={headY}  width={headW}  height={headH}  rx={2} fill="#f0c896" />
      {/* Hair */}
      <rect x={cx - 13} y={headY}  width={headW}  height={hairH}  rx={2} fill="#000000" />
      {/* Eyes */}
      <rect x={cx - 8}  y={headY + hairH + 4} width={4} height={4} fill="#1a1a1a" />
      <rect x={cx + 4}  y={headY + hairH + 4} width={4} height={4} fill="#1a1a1a" />
      {/* Name label */}
      <rect x={labelX - 2} y={labelY - 9} width={labelW + 4} height={12} rx={2} fill="#111" opacity={0.88} />
      <circle cx={labelX + 6} cy={labelY - 3} r={2.5} fill={dotColor} />
      <text
        x={cx + 3} y={labelY - 2}
        textAnchor="middle" dominantBaseline="middle"
        fontSize={8} fontFamily="monospace" fontWeight="bold" fill="white"
      >{labelText}</text>
    </g>
  );
}
