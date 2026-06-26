import { useId, useEffect, useState } from 'react'
import type { PetType } from '../lib/storage'
import './PetAvatar.css'

export type Emotion = 'idle' | 'happy' | 'talking' | 'excited'
type Frame = 0 | 1 | 2  // 0=closed 1=slight 2=wide

// ── per-breed config ──────────────────────────────────────────────────────────
interface PetCfg {
  kind: 'cat' | 'dog'
  faceMain: string; faceHi: string; faceShadow: string
  muzzle: string
  earOut: string; earIn: string; earTip?: string
  irisA: string; irisB: string   // inner bright / outer dark
  pupil: 'slit' | 'round'
  nose: string
  cheekPatch?: string            // shiba white area
  bodyBase: string; bodyHi: string
  hasWhiskers: boolean
  hasTabby: boolean
  hasTabbyM: boolean
  hasFloppy: boolean
  hasCurly: boolean
  faceRx: number; faceRy: number
  eyeY: number                   // eye center y
}

const CFG: Record<PetType, PetCfg> = {
  british_shorthair: {
    kind: 'cat',
    faceMain: '#7AAABB', faceHi: '#AAC8D8', faceShadow: '#4E7890',
    muzzle: '#BDDAE8',
    earOut: '#5E90A8', earIn: '#FFB0C8',
    irisA: '#E87828', irisB: '#A84800',
    pupil: 'slit', nose: '#E070A8',
    bodyBase: '#5E90A8', bodyHi: '#88B8CC',
    hasWhiskers: true, hasTabby: false, hasTabbyM: false,
    hasFloppy: false, hasCurly: false,
    faceRx: 155, faceRy: 162, eyeY: 193,
  },
  american_shorthair: {
    kind: 'cat',
    faceMain: '#A0A078', faceHi: '#C0C098', faceShadow: '#707058',
    muzzle: '#C8C8A8',
    earOut: '#888868', earIn: '#FFB0C8',
    irisA: '#58A840', irisB: '#2A6020',
    pupil: 'slit', nose: '#D870A0',
    bodyBase: '#808060', bodyHi: '#A0A080',
    hasWhiskers: true, hasTabby: true, hasTabbyM: true,
    hasFloppy: false, hasCurly: false,
    faceRx: 148, faceRy: 155, eyeY: 195,
  },
  teddy: {
    kind: 'dog',
    faceMain: '#D2A458', faceHi: '#ECC07A', faceShadow: '#9E7630',
    muzzle: '#EED4A0',
    earOut: '#BE9050', earIn: '#D8AF70',
    irisA: '#2C1200', irisB: '#0C0400',
    pupil: 'round', nose: '#0E0600',
    bodyBase: '#B88040', bodyHi: '#D8A060',
    hasWhiskers: false, hasTabby: false, hasTabbyM: false,
    hasFloppy: true, hasCurly: true,
    faceRx: 144, faceRy: 150, eyeY: 200,
  },
  shiba: {
    kind: 'dog',
    faceMain: '#D45E18', faceHi: '#EE8040', faceShadow: '#9E360C',
    muzzle: '#EEE4B8',
    earOut: '#BC4C14', earIn: '#E0C898', earTip: '#1A0800',
    irisA: '#4A1800', irisB: '#1A0800',
    pupil: 'round', nose: '#1A0800',
    cheekPatch: '#EDE4BE',
    bodyBase: '#C05018', bodyHi: '#E07838',
    hasWhiskers: false, hasTabby: false, hasTabbyM: false,
    hasFloppy: false, hasCurly: false,
    faceRx: 142, faceRy: 148, eyeY: 198,
  },
  golden: {
    kind: 'dog',
    faceMain: '#C48820', faceHi: '#E8AC38', faceShadow: '#8C5E0C',
    muzzle: '#E6CC60',
    earOut: '#AC7018', earIn: '#D09430',
    irisA: '#7C3810', irisB: '#3A1808',
    pupil: 'round', nose: '#180E08',
    bodyBase: '#AC7018', bodyHi: '#D89030',
    hasWhiskers: false, hasTabby: false, hasTabbyM: false,
    hasFloppy: true, hasCurly: false,
    faceRx: 158, faceRy: 152, eyeY: 198,
  },
}

// ── emotion modifier params ───────────────────────────────────────────────────
const EMOTION_P = {
  idle:    { browLift: 0,  blushA: 0,    eyeWide: 0 },
  happy:   { browLift: 6,  blushA: 0.38, eyeWide: 1 },
  talking: { browLift: 1,  blushA: 0,    eyeWide: 0 },
  excited: { browLift: 9,  blushA: 0.55, eyeWide: 3 },
}

// ── <defs> gradients & filters ───────────────────────────────────────────────
function Defs({ cfg, g }: { cfg: PetCfg; g: string }) {
  return (
    <defs>
      {/* face radial gradient – light from upper-left */}
      <radialGradient id={`face-${g}`} cx="35%" cy="28%" r="72%" gradientUnits="objectBoundingBox">
        <stop offset="0%"  stopColor={cfg.faceHi} />
        <stop offset="55%" stopColor={cfg.faceMain} />
        <stop offset="100%" stopColor={cfg.faceShadow} />
      </radialGradient>

      {/* muzzle gradient */}
      <radialGradient id={`mzl-${g}`} cx="50%" cy="40%" r="60%">
        <stop offset="0%"  stopColor="#FFFFFF" stopOpacity="0.3" />
        <stop offset="100%" stopColor={cfg.muzzle} />
      </radialGradient>

      {/* iris gradients (same shape for left/right) */}
      <radialGradient id={`iris-${g}`} cx="38%" cy="30%" r="65%">
        <stop offset="0%"  stopColor={cfg.irisA} />
        <stop offset="55%" stopColor={cfg.irisB} />
        <stop offset="88%" stopColor={cfg.irisB} />
        <stop offset="100%" stopColor="#0A0606" />
      </radialGradient>

      {/* body gradient */}
      <radialGradient id={`body-${g}`} cx="40%" cy="20%" r="80%">
        <stop offset="0%"  stopColor={cfg.bodyHi} />
        <stop offset="100%" stopColor={cfg.bodyBase} />
      </radialGradient>

      {/* soft drop-shadow filter */}
      <filter id={`sh-${g}`} x="-25%" y="-25%" width="150%" height="150%">
        <feDropShadow dx="0" dy="5" stdDeviation="10" floodOpacity="0.16" />
      </filter>

      {/* ear inner gradient */}
      <radialGradient id={`earIn-${g}`} cx="50%" cy="50%" r="60%">
        <stop offset="0%" stopColor="#FFD0E0" />
        <stop offset="100%" stopColor={cfg.earIn} />
      </radialGradient>
    </defs>
  )
}

// ── ears ─────────────────────────────────────────────────────────────────────
function Ears({ cfg, emotion, g }: { cfg: PetCfg; emotion: Emotion; g: string }) {
  const lift = emotion === 'excited' ? -8 : emotion === 'happy' ? -4 : 0

  if (cfg.hasFloppy) {
    // Golden / Teddy — large hanging ears
    return (
      <g>
        {/* left ear */}
        <ellipse cx={88} cy={252 + lift} rx={58} ry={82} fill={cfg.earOut} filter={`url(#sh-${g})`} />
        <ellipse cx={88} cy={252 + lift} rx={38} ry={62} fill={`url(#earIn-${g})`} opacity="0.55" />
        {/* right ear */}
        <ellipse cx={312} cy={252 + lift} rx={58} ry={82} fill={cfg.earOut} filter={`url(#sh-${g})`} />
        <ellipse cx={312} cy={252 + lift} rx={38} ry={62} fill={`url(#earIn-${g})`} opacity="0.55" />
        {cfg.hasCurly && (
          <>
            {/* teddy curly fur arcs */}
            {[0, 1, 2, 3].map(i => (
              <path key={i}
                d={`M${68 + i * 7},${230 + lift} Q${75 + i * 7},${222 + lift} ${82 + i * 7},${230 + lift}`}
                fill="none" stroke={cfg.earOut} strokeWidth="2" opacity="0.5"
              />
            ))}
            {[0, 1, 2, 3].map(i => (
              <path key={i}
                d={`M${292 + i * 7},${230 + lift} Q${299 + i * 7},${222 + lift} ${306 + i * 7},${230 + lift}`}
                fill="none" stroke={cfg.earOut} strokeWidth="2" opacity="0.5"
              />
            ))}
          </>
        )}
      </g>
    )
  }

  if (cfg.earTip) {
    // Shiba — pointed, triangular, black-tipped
    return (
      <g>
        <polygon points={`86,${190 + lift} 128,${62 + lift} 165,${185 + lift}`}
          fill={cfg.earTip} />
        <polygon points={`235,${185 + lift} 272,${62 + lift} 314,${190 + lift}`}
          fill={cfg.earTip} />
        <polygon points={`97,${183 + lift} 128,${80 + lift} 154,${180 + lift}`}
          fill={cfg.earOut} />
        <polygon points={`246,${180 + lift} 272,${80 + lift} 303,${183 + lift}`}
          fill={cfg.earOut} />
        <polygon points={`107,${178 + lift} 128,${98 + lift} 148,${175 + lift}`}
          fill={cfg.earIn} opacity="0.75" />
        <polygon points={`252,${175 + lift} 272,${98 + lift} 293,${178 + lift}`}
          fill={cfg.earIn} opacity="0.75" />
      </g>
    )
  }

  // Cat pointed ears (BSH / American SH)
  return (
    <g>
      {/* left ear */}
      <polygon points={`88,${183 + lift} 132,${62 + lift} 172,${183 + lift}`}
        fill={cfg.earOut} filter={`url(#sh-${g})`} />
      <polygon points={`103,${177 + lift} 132,${82 + lift} 160,${177 + lift}`}
        fill={`url(#earIn-${g})`} />
      {/* right ear */}
      <polygon points={`228,${183 + lift} 268,${62 + lift} 312,${183 + lift}`}
        fill={cfg.earOut} filter={`url(#sh-${g})`} />
      <polygon points={`240,${177 + lift} 268,${82 + lift} 297,${177 + lift}`}
        fill={`url(#earIn-${g})`} />
    </g>
  )
}

// ── body (chest + paw hints) ─────────────────────────────────────────────────
function Body({ cfg, g }: { cfg: PetCfg; g: string }) {
  return (
    <g>
      {/* chest torso */}
      <ellipse cx={200} cy={390} rx={118} ry={78}
        fill={`url(#body-${g})`} filter={`url(#sh-${g})`} />
      {/* chest highlight */}
      <ellipse cx={192} cy={372} rx={52} ry={38}
        fill="rgba(255,255,255,0.14)" />
      {/* paws */}
      <ellipse cx={138} cy={430} rx={38} ry={22} fill={cfg.bodyBase} />
      <ellipse cx={262} cy={430} rx={38} ry={22} fill={cfg.bodyBase} />
      {/* paw toe lines */}
      {[0, 1, 2].map(i => (
        <line key={`lp-${i}`}
          x1={122 + i * 10} y1={420} x2={122 + i * 10} y2={436}
          stroke={cfg.faceShadow} strokeWidth="1.2" strokeLinecap="round" opacity="0.4"
        />
      ))}
      {[0, 1, 2].map(i => (
        <line key={`rp-${i}`}
          x1={246 + i * 10} y1={420} x2={246 + i * 10} y2={436}
          stroke={cfg.faceShadow} strokeWidth="1.2" strokeLinecap="round" opacity="0.4"
        />
      ))}
    </g>
  )
}

// ── face base + muzzle ───────────────────────────────────────────────────────
function FaceBase({ cfg, g }: { cfg: PetCfg; g: string }) {
  const { faceRx, faceRy } = cfg
  const cy = 218
  return (
    <g>
      {/* main face */}
      <ellipse cx={200} cy={cy} rx={faceRx} ry={faceRy}
        fill={`url(#face-${g})`} filter={`url(#sh-${g})`} />
      {/* face inner light */}
      <ellipse cx={172} cy={cy - 48} rx={62} ry={48}
        fill="rgba(255,255,255,0.10)" />
      {/* chin shadow */}
      <ellipse cx={200} cy={cy + faceRy - 22} rx={80} ry={25}
        fill="rgba(0,0,0,0.07)" />
    </g>
  )
}

// ── face detail — muzzle, shiba cheek patches, tabby marks ──────────────────
function FaceDetail({ cfg, g }: { cfg: PetCfg; g: string }) {
  const isCat = cfg.kind === 'cat'
  const muzzleCy = isCat ? 268 : 275

  return (
    <g>
      {/* shiba white cheek surround */}
      {cfg.cheekPatch && (
        <>
          <ellipse cx={146} cy={262} rx={42} ry={32} fill={cfg.cheekPatch} opacity="0.88" />
          <ellipse cx={254} cy={262} rx={42} ry={32} fill={cfg.cheekPatch} opacity="0.88" />
        </>
      )}

      {/* muzzle area */}
      <ellipse cx={200} cy={muzzleCy}
        rx={isCat ? 52 : 58} ry={isCat ? 40 : 46}
        fill={`url(#mzl-${g})`} opacity="0.78" />

      {/* tabby stripes on forehead */}
      {cfg.hasTabby && (
        <g opacity="0.42">
          <path d="M185,148 Q200,138 215,148" stroke={cfg.faceShadow} strokeWidth="3.5" fill="none" strokeLinecap="round" />
          <path d="M178,163 Q200,150 222,163" stroke={cfg.faceShadow} strokeWidth="3"   fill="none" strokeLinecap="round" />
          <path d="M174,178 Q200,166 226,178" stroke={cfg.faceShadow} strokeWidth="2.5" fill="none" strokeLinecap="round" />
        </g>
      )}

      {/* tabby M on forehead */}
      {cfg.hasTabbyM && (
        <g opacity="0.35">
          <path d="M182,128 L190,112 L200,122 L210,112 L218,128" stroke={cfg.faceShadow} strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </g>
      )}

      {/* teddy curly fur texture hints on face edge */}
      {cfg.hasCurly && (
        <g opacity="0.28">
          {[-80, -60, -40, 40, 60, 80].map((dx, i) => (
            <path key={i}
              d={`M${200 + dx - 8},${218 + 150 - Math.abs(dx)} Q${200 + dx},${218 + 142 - Math.abs(dx)} ${200 + dx + 8},${218 + 150 - Math.abs(dx)}`}
              fill="none" stroke={cfg.faceShadow} strokeWidth="2" />
          ))}
        </g>
      )}
    </g>
  )
}

// ── eyes (the centerpiece of realism) ───────────────────────────────────────
function SingleEye({
  cx, cy, cfg, emotion, blink, g, isLeft,
}: {
  cx: number; cy: number; cfg: PetCfg; emotion: Emotion; blink: boolean; g: string; isLeft: boolean
}) {
  const ep = EMOTION_P[emotion]
  const baseRy = 21
  const eyeRx = 27
  const eyeRy = blink ? 4 : (baseRy + ep.eyeWide)
  const irisR = 16 + ep.eyeWide * 0.5

  // Pupil size varies with emotion
  const pupilScale = emotion === 'excited' ? 0.7 : 1.0  // excited = dilated round, or narrower slit

  const browY = cy - eyeRy - 12 - ep.browLift
  const irisId = `iris-${g}`

  return (
    <g>
      {/* eye socket shadow */}
      <ellipse cx={cx} cy={cy + 3} rx={eyeRx + 7} ry={eyeRy + 6}
        fill="rgba(0,0,0,0.10)" />

      {/* sclera — warm, not pure white */}
      <ellipse cx={cx} cy={cy} rx={eyeRx} ry={eyeRy} fill="#F4EEE6" />

      {!blink && (
        <>
          {/* iris */}
          <clipPath id={`ci-${isLeft ? 'l' : 'r'}-${g}`}>
            <ellipse cx={cx} cy={cy} rx={eyeRx - 1} ry={eyeRy - 1} />
          </clipPath>
          <circle cx={cx} cy={cy} r={irisR}
            fill={`url(#${irisId})`}
            clipPath={`url(#ci-${isLeft ? 'l' : 'r'}-${g})`} />

          {/* pupil */}
          {cfg.pupil === 'slit'
            ? <ellipse cx={cx} cy={cy}
                rx={6 * pupilScale} ry={emotion === 'excited' ? 11 : 14}
                fill="#0A0606" />
            : <circle cx={cx} cy={cy}
                r={emotion === 'excited' ? 10 : 8.5}
                fill="#0A0606" />
          }

          {/* primary catchlight — white, upper-left */}
          <circle cx={cx - 5} cy={cy - 6} r={5.5} fill="white" />
          {/* secondary catchlight — small arc, lower */}
          <ellipse cx={cx + 6} cy={cy + 6} rx={2.5} ry={1.8} fill="rgba(255,255,255,0.65)" />
          {/* excited: extra sparkle */}
          {emotion === 'excited' && (
            <circle cx={cx + 4} cy={cy - 10} r={2} fill="rgba(255,255,255,0.8)" />
          )}

          {/* upper eyelid shadow — casts subtle shadow on iris */}
          <path
            d={`M${cx - eyeRx},${cy} Q${cx},${cy - eyeRy - 2} ${cx + eyeRx},${cy}`}
            fill="rgba(0,0,0,0.09)" />

          {/* happy / excited outer eye crinkle */}
          {(emotion === 'happy' || emotion === 'excited') && (
            <path
              d={`M${cx + eyeRx - 5},${cy + 5} Q${cx + eyeRx + 10},${cy + 12} ${cx + eyeRx + 16},${cy + 4}`}
              fill="none" stroke={cfg.faceShadow}
              strokeWidth="1.5" strokeLinecap="round" opacity="0.45"
            />
          )}
        </>
      )}

      {/* eyelid (blink: thin sliver) */}
      {blink && (
        <ellipse cx={cx} cy={cy} rx={eyeRx + 1} ry={eyeRy + 1} fill={cfg.faceMain} />
      )}

      {/* eyebrow/brow fur arc */}
      <path
        d={`M${cx - 20},${browY + 3} Q${cx},${browY - 3} ${cx + 20},${browY + 3}`}
        fill="none"
        stroke={cfg.faceShadow}
        strokeWidth={cfg.kind === 'cat' ? 1.8 : 2.5}
        strokeLinecap="round"
        opacity={0.38 + (ep.browLift > 0 ? 0.1 : 0)}
      />
    </g>
  )
}

function EyePair({ cfg, emotion, blink, g }: {
  cfg: PetCfg; emotion: Emotion; blink: boolean; g: string
}) {
  const cy = cfg.eyeY
  return (
    <g>
      <SingleEye cx={153} cy={cy} cfg={cfg} emotion={emotion} blink={blink} g={g} isLeft />
      <SingleEye cx={247} cy={cy} cfg={cfg} emotion={emotion} blink={blink} g={g} isLeft={false} />
    </g>
  )
}

// ── nose ─────────────────────────────────────────────────────────────────────
function Nose({ cfg }: { cfg: PetCfg }) {
  const isCat = cfg.kind === 'cat'

  if (isCat) {
    // Heart-shaped cat nose
    return (
      <g>
        {/* nose base */}
        <path d="M192,261 L200,255 L208,261 Q200,272 192,261Z" fill={cfg.nose} />
        {/* nose highlight */}
        <ellipse cx={197} cy={259} rx={4} ry={2.5}
          fill="rgba(255,255,255,0.30)" />
        {/* philtrum line */}
        <line x1={200} y1={272} x2={200} y2={285}
          stroke={cfg.faceShadow} strokeWidth="1.5" strokeLinecap="round" opacity="0.5" />
      </g>
    )
  }

  // Broad dog nose
  return (
    <g>
      <ellipse cx={200} cy={270} rx={22} ry={15} fill={cfg.nose} />
      {/* nostrils */}
      <ellipse cx={191} cy={270} rx={6} ry={4.5} fill="rgba(0,0,0,0.30)" />
      <ellipse cx={209} cy={270} rx={6} ry={4.5} fill="rgba(0,0,0,0.30)" />
      {/* highlight */}
      <ellipse cx={194} cy={264} rx={5} ry={3} fill="rgba(255,255,255,0.25)" />
    </g>
  )
}

// ── mouth ────────────────────────────────────────────────────────────────────
function Mouth({ cfg, frame, emotion }: { cfg: PetCfg; frame: Frame; emotion: Emotion }) {
  const isCat = cfg.kind === 'cat'
  const baseY = isCat ? 290 : 296

  // Neutral slight smile (idle / happy)
  if (frame === 0) {
    const smileY = emotion === 'happy' || emotion === 'excited'
      ? baseY + 4  // pulled down more = broader smile
      : baseY + 1
    return (
      <g>
        {/* upper lip outline */}
        <path
          d={`M${180},${baseY - 2} Q${200},${baseY + 2} ${220},${baseY - 2}`}
          fill="none" stroke={cfg.faceShadow} strokeWidth="1.5" strokeLinecap="round" opacity="0.4"
        />
        {/* smile curve */}
        <path
          d={`M${180},${baseY} Q${200},${smileY} ${220},${baseY}`}
          fill="none" stroke={cfg.faceShadow} strokeWidth="2.5" strokeLinecap="round" opacity="0.6"
        />
      </g>
    )
  }

  // Slightly open (talking light)
  if (frame === 1) {
    return (
      <g>
        {/* outer lip path */}
        <path d={`M${175},${baseY - 4} Q${200},${baseY + 3} ${225},${baseY - 4}`}
          fill="none" stroke={cfg.faceShadow} strokeWidth="2" strokeLinecap="round" opacity="0.5" />
        {/* mouth opening */}
        <path d={`M${178},${baseY} Q${200},${baseY + 14} ${222},${baseY}`}
          fill={cfg.faceShadow} opacity="0.7" />
        {/* inner mouth */}
        <ellipse cx={200} cy={baseY + 8} rx={20} ry={9} fill="#8B2040" />
        {/* tongue hint */}
        <ellipse cx={200} cy={baseY + 14} rx={14} ry={6} fill="#D05070" />
      </g>
    )
  }

  // Wide open (talking heavy / excited)
  return (
    <g>
      {/* outer lip path */}
      <path d={`M${170},${baseY - 6} Q${200},${baseY + 4} ${230},${baseY - 6}`}
        fill="none" stroke={cfg.faceShadow} strokeWidth="2" strokeLinecap="round" opacity="0.5" />
      {/* mouth cavity */}
      <path d={`M${172},${baseY} Q${200},${baseY + 22} ${228},${baseY}`}
        fill="#8B2040" />
      {/* inner mouth */}
      <ellipse cx={200} cy={baseY + 13} rx={25} ry={14} fill="#7A1830" />
      {/* tongue */}
      <ellipse cx={200} cy={baseY + 20} rx={18} ry={10} fill="#D05070" />
      {/* tongue highlight */}
      <ellipse cx={196} cy={baseY + 17} rx={7} ry={4} fill="rgba(255,255,255,0.18)" />
    </g>
  )
}

// ── whiskers (cats only) ─────────────────────────────────────────────────────
function Whiskers({ cfg }: { cfg: PetCfg }) {
  if (!cfg.hasWhiskers) return null
  const col = 'rgba(210,230,248,0.70)'
  const w = 1.5
  return (
    <g>
      <line x1={65}  y1={256} x2={178} y2={261} stroke={col} strokeWidth={w} />
      <line x1={62}  y1={268} x2={177} y2={268} stroke={col} strokeWidth={w} />
      <line x1={65}  y1={280} x2={178} y2={275} stroke={col} strokeWidth={w} />
      <line x1={335} y1={256} x2={222} y2={261} stroke={col} strokeWidth={w} />
      <line x1={338} y1={268} x2={223} y2={268} stroke={col} strokeWidth={w} />
      <line x1={335} y1={280} x2={222} y2={275} stroke={col} strokeWidth={w} />
    </g>
  )
}

// ── blush cheeks ─────────────────────────────────────────────────────────────
function Blush({ cfg, emotion }: { cfg: PetCfg; emotion: Emotion }) {
  const a = EMOTION_P[emotion].blushA
  if (a === 0) return null
  const blushOffset = cfg.kind === 'cat' ? 18 : 14
  return (
    <g>
      <ellipse cx={140} cy={cfg.eyeY + blushOffset + 30} rx={30} ry={18}
        fill="#FF8090" opacity={a} />
      <ellipse cx={260} cy={cfg.eyeY + blushOffset + 30} rx={30} ry={18}
        fill="#FF8090" opacity={a} />
    </g>
  )
}

// ── ground shadow ─────────────────────────────────────────────────────────────
function GroundShadow() {
  return <ellipse cx={200} cy={438} rx={110} ry={12} fill="rgba(0,0,0,0.10)" />
}

// ── main SVG compositor ───────────────────────────────────────────────────────
export function PetSVG({
  petType, frame, emotion, blink, g,
}: {
  petType: PetType; frame: Frame; emotion: Emotion; blink: boolean; g: string
}) {
  const cfg = CFG[petType]
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 440"
      style={{ width: '100%', height: '100%' }}>
      <Defs cfg={cfg} g={g} />
      <GroundShadow />
      <Body cfg={cfg} g={g} />
      <Ears cfg={cfg} emotion={emotion} g={g} />
      <FaceBase cfg={cfg} g={g} />
      <FaceDetail cfg={cfg} g={g} />
      <EyePair cfg={cfg} emotion={emotion} blink={blink} g={g} />
      <Nose cfg={cfg} />
      <Mouth cfg={cfg} frame={frame} emotion={emotion} />
      <Whiskers cfg={cfg} />
      <Blush cfg={cfg} emotion={emotion} />
    </svg>
  )
}

// ── PetAvatar wrapper ─────────────────────────────────────────────────────────
type Props = {
  petType: PetType
  petName: string
  remoteLevel: number
  speaking: boolean
  emotion: Emotion
}

export function PetAvatar({ petType, petName, remoteLevel, speaking, emotion }: Props) {
  const rawId = useId()
  const g = rawId.replace(/[^a-zA-Z0-9]/g, '')

  // Mouth frame from remote audio level
  const [frame, setFrame] = useState<Frame>(0)
  useEffect(() => {
    if (!speaking) { setFrame(0); return }
    const id = window.setInterval(() => {
      setFrame(remoteLevel > 0.45 ? 2 : remoteLevel > 0.08 ? 1 : 0)
    }, 90)
    return () => window.clearInterval(id)
  }, [speaking, remoteLevel])

  // Random blink
  const [blink, setBlink] = useState(false)
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>
    function scheduleBlink() {
      timer = setTimeout(() => {
        setBlink(true)
        setTimeout(() => {
          setBlink(false)
          scheduleBlink()
        }, 140)
      }, 2500 + Math.random() * 4000)
    }
    scheduleBlink()
    return () => clearTimeout(timer)
  }, [])

  // Micro-scale pulse on speaking
  const scale = 1 + Math.max(0, remoteLevel - 0.05) * 0.06

  return (
    <div className="pet-avatar-wrap">
      <p className="pet-display-name">{petName || ''}</p>
      <div
        className={`pet-glow pet-glow--${emotion}`}
        style={{ transform: `scale(${scale.toFixed(3)})` }}
      >
        <PetSVG petType={petType} frame={frame} emotion={emotion} blink={blink} g={g} />
      </div>
    </div>
  )
}
