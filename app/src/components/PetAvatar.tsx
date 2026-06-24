import { useId, useEffect, useState } from 'react'
import type { PetType } from '../lib/storage'
import { PET_META } from './PetSelector'
import './PetAvatar.css'

type Frame = 0 | 1 | 2

interface PetCfg {
  kind: 'cat' | 'dog'
  faceLight: string
  faceDark: string
  earOuter: string
  muzzle: string
  eyeIris: string
  earStyle: 'pointed' | 'floppy'
  stripes?: boolean
  cheeks?: boolean
}

const PET_CFG: Record<PetType, PetCfg> = {
  british_shorthair: {
    kind: 'cat', faceLight: '#9DBBD0', faceDark: '#5E8BA8',
    earOuter: '#7AA0BC', muzzle: '#C0D8E8', eyeIris: '#D4830A', earStyle: 'pointed',
  },
  american_shorthair: {
    kind: 'cat', faceLight: '#C8A870', faceDark: '#987040',
    earOuter: '#A88050', muzzle: '#E8CCA0', eyeIris: '#4A8828', earStyle: 'pointed', stripes: true,
  },
  teddy: {
    kind: 'dog', faceLight: '#D8B880', faceDark: '#A07840',
    earOuter: '#B09060', muzzle: '#EED8B0', eyeIris: '#3A2008', earStyle: 'floppy',
  },
  shiba: {
    kind: 'dog', faceLight: '#E87838', faceDark: '#B85010',
    earOuter: '#C86020', muzzle: '#F5E8C8', eyeIris: '#2A1808', earStyle: 'pointed', cheeks: true,
  },
  golden: {
    kind: 'dog', faceLight: '#D8A828', faceDark: '#A07010',
    earOuter: '#C09018', muzzle: '#F0D878', eyeIris: '#2A1808', earStyle: 'floppy',
  },
}

function MouthPath({ frame, isCat }: { frame: Frame; isCat: boolean }) {
  if (frame === 0) {
    return (
      <path
        d="M182,278 Q200,293 218,278"
        stroke="#807060" strokeWidth="2.5" fill="none" strokeLinecap="round"
      />
    )
  }
  if (frame === 1) {
    return (
      <g>
        <path d="M177,275 Q200,296 223,275" stroke="#604840" strokeWidth="2" fill="none" strokeLinecap="round" />
        <ellipse cx="200" cy="287" rx="20" ry="12" fill="#B03050" />
        {!isCat && <ellipse cx="200" cy="292" rx="14" ry="7" fill="#F06080" />}
      </g>
    )
  }
  return (
    <g>
      <path d="M172,272 Q200,302 228,272" stroke="#503830" strokeWidth="2" fill="none" strokeLinecap="round" />
      <ellipse cx="200" cy="288" rx="26" ry="16" fill="#B03050" />
      <ellipse cx="200" cy="296" rx="18" ry="9" fill="#F06080" />
    </g>
  )
}

function PetSVG({ petType, frame, uid }: { petType: PetType; frame: Frame; uid: string }) {
  const cfg = PET_CFG[petType]
  const g = uid   // gradient/filter id prefix
  const isCat = cfg.kind === 'cat'
  const eyeY = isCat ? 218 : 212
  const faceCY = isCat ? 232 : 230

  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" style={{ width: '100%', height: '100%' }}>
      <defs>
        <radialGradient id={`face-${g}`} cx="40%" cy="35%" r="65%">
          <stop offset="0%" stopColor={cfg.faceLight} />
          <stop offset="100%" stopColor={cfg.faceDark} />
        </radialGradient>
        {isCat && (
          <radialGradient id={`ear-${g}`} cx="50%" cy="50%" r="60%">
            <stop offset="0%" stopColor="#FFC0D0" />
            <stop offset="100%" stopColor="#FF90B0" />
          </radialGradient>
        )}
        <filter id={`sh-${g}`} x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="5" stdDeviation="8" floodOpacity="0.18" />
        </filter>
      </defs>

      {/* ground shadow */}
      <ellipse cx="200" cy="372" rx="90" ry="16" fill="rgba(0,0,0,0.10)" />

      {/* EARS */}
      {isCat ? (
        <>
          <polygon points="95,178 132,72 175,178" fill={cfg.earOuter} />
          <polygon points="225,178 268,72 305,178" fill={cfg.earOuter} />
          <polygon points="112,170 136,98 168,170" fill={`url(#ear-${g})`} />
          <polygon points="232,170 264,98 288,170" fill={`url(#ear-${g})`} />
        </>
      ) : cfg.earStyle === 'floppy' ? (
        <>
          <ellipse cx="88" cy="235" rx="55" ry="78" fill={cfg.earOuter} filter={`url(#sh-${g})`} />
          <ellipse cx="312" cy="235" rx="55" ry="78" fill={cfg.earOuter} filter={`url(#sh-${g})`} />
        </>
      ) : (
        <>
          <polygon points="90,190 118,75 158,188" fill={cfg.earOuter} />
          <polygon points="242,188 282,75 310,190" fill={cfg.earOuter} />
          <polygon points="103,182 120,95 150,180" fill="#FFD0C0" opacity="0.8" />
          <polygon points="250,180 280,95 297,182" fill="#FFD0C0" opacity="0.8" />
        </>
      )}

      {/* FACE */}
      <circle cx="200" cy={faceCY} r="138" fill={`url(#face-${g})`} filter={`url(#sh-${g})`} />

      {/* face highlight */}
      <ellipse cx="158" cy={isCat ? 178 : 175} rx="40" ry="30" fill="rgba(255,255,255,0.18)" />

      {/* american shorthair tabby stripes */}
      {cfg.stripes && (
        <>
          <path d="M183,155 Q200,145 217,155" stroke={cfg.faceDark} strokeWidth="3.5" fill="none" strokeLinecap="round" opacity="0.45" />
          <path d="M177,170 Q200,157 223,170" stroke={cfg.faceDark} strokeWidth="3" fill="none" strokeLinecap="round" opacity="0.35" />
          <path d="M175,185 Q200,173 225,185" stroke={cfg.faceDark} strokeWidth="2.5" fill="none" strokeLinecap="round" opacity="0.25" />
        </>
      )}

      {/* shiba white cheeks */}
      {cfg.cheeks && (
        <>
          <ellipse cx="148" cy="262" rx="38" ry="30" fill="#F5E8C0" opacity="0.80" />
          <ellipse cx="252" cy="262" rx="38" ry="30" fill="#F5E8C0" opacity="0.80" />
        </>
      )}

      {/* muzzle area */}
      <ellipse
        cx="200" cy={isCat ? 270 : 278}
        rx={isCat ? 52 : 58} ry={isCat ? 38 : 44}
        fill={cfg.muzzle} opacity="0.68"
      />

      {/* EYES – outer dark / iris / pupil / shine */}
      <ellipse cx="158" cy={eyeY} rx="30" ry={isCat ? 24 : 25} fill="#180800" />
      <ellipse cx="242" cy={eyeY} rx="30" ry={isCat ? 24 : 25} fill="#180800" />
      <ellipse cx="158" cy={eyeY} rx="22" ry="20" fill={cfg.eyeIris} />
      <ellipse cx="242" cy={eyeY} rx="22" ry="20" fill={cfg.eyeIris} />
      {isCat ? (
        <>
          <ellipse cx="160" cy={eyeY} rx="11" ry="15" fill="#080808" />
          <ellipse cx="244" cy={eyeY} rx="11" ry="15" fill="#080808" />
        </>
      ) : (
        <>
          <ellipse cx="160" cy={eyeY} rx="12" ry="14" fill="#080808" />
          <ellipse cx="244" cy={eyeY} rx="12" ry="14" fill="#080808" />
        </>
      )}
      {/* primary shine */}
      <circle cx="150" cy={eyeY - 10} r="6" fill="white" />
      <circle cx="234" cy={eyeY - 10} r="6" fill="white" />
      {/* secondary shine */}
      <circle cx="163" cy={eyeY + 7} r="3" fill="white" opacity="0.55" />
      <circle cx="247" cy={eyeY + 7} r="3" fill="white" opacity="0.55" />

      {/* NOSE */}
      {isCat ? (
        <>
          <path d="M192,261 L200,256 L208,261 Q200,270 192,261Z" fill="#FF70A0" />
          <line x1="200" y1="261" x2="200" y2="278" stroke="#FF70A0" strokeWidth="1.5" />
        </>
      ) : (
        <>
          <ellipse cx="200" cy="263" rx="20" ry="14" fill="#180800" />
          <ellipse cx="195" cy="258" rx="7" ry="4" fill="rgba(255,255,255,0.22)" />
        </>
      )}

      {/* whiskers (cats only) */}
      {isCat && (
        <>
          <line x1="72" y1="258" x2="178" y2="263" stroke="rgba(200,220,240,0.65)" strokeWidth="1.5" />
          <line x1="72" y1="270" x2="178" y2="270" stroke="rgba(200,220,240,0.65)" strokeWidth="1.5" />
          <line x1="72" y1="282" x2="178" y2="277" stroke="rgba(200,220,240,0.65)" strokeWidth="1.5" />
          <line x1="328" y1="258" x2="222" y2="263" stroke="rgba(200,220,240,0.65)" strokeWidth="1.5" />
          <line x1="328" y1="270" x2="222" y2="270" stroke="rgba(200,220,240,0.65)" strokeWidth="1.5" />
          <line x1="328" y1="282" x2="222" y2="277" stroke="rgba(200,220,240,0.65)" strokeWidth="1.5" />
        </>
      )}

      <MouthPath frame={frame} isCat={isCat} />
    </svg>
  )
}

type Props = {
  petType: PetType
  petName: string
  remoteLevel: number
  speaking: boolean
}

export function PetAvatar({ petType, petName, remoteLevel, speaking }: Props) {
  const rawUid = useId()
  const uid = rawUid.replace(/[^a-zA-Z0-9]/g, '')
  const [frame, setFrame] = useState<Frame>(0)

  useEffect(() => {
    if (!speaking) {
      setFrame(0)
      return
    }
    const id = window.setInterval(() => {
      setFrame(remoteLevel > 0.4 ? 2 : remoteLevel > 0.05 ? 1 : 0)
    }, 100)
    return () => window.clearInterval(id)
  }, [speaking, remoteLevel])

  const meta = PET_META[petType]
  const scale = 1 + Math.max(0, remoteLevel) * 0.12

  return (
    <div className="pet-avatar-wrap">
      <p className="pet-display-name">{petName || meta.label}</p>
      <div
        className={`pet-glow ${speaking ? 'speaking' : ''}`}
        style={{ transform: `scale(${scale})` }}
      >
        <PetSVG petType={petType} frame={frame} uid={uid} />
      </div>
    </div>
  )
}
