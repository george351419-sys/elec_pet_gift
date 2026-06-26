import { useId } from 'react'
import type { PetType } from '../lib/storage'
import { PetSVG } from './PetAvatar'
import './PetSelector.css'

export const PET_META: Record<PetType, { label: string; desc: string; emoji: string }> = {
  british_shorthair: { label: '英国短毛猫', desc: '沉稳温柔·爱撒娇', emoji: '🐱' },
  american_shorthair: { label: '美国短毛猫', desc: '活泼好奇·爱探险', emoji: '😸' },
  teddy:              { label: '泰迪贵宾犬', desc: '聪明黏人·超爱玩', emoji: '🐩' },
  shiba:              { label: '柴犬',       desc: '独立可爱·超忠诚', emoji: '🐕' },
  golden:             { label: '金毛猎犬',   desc: '温暖热情·超开朗', emoji: '🦮' },
}

const PET_TYPES = Object.keys(PET_META) as PetType[]

function MiniPet({ petType }: { petType: PetType }) {
  const rawId = useId()
  const g = rawId.replace(/[^a-zA-Z0-9]/g, '') + 'sel'
  return (
    <div style={{ width: 72, height: 72 }}>
      <PetSVG petType={petType} frame={0} emotion="idle" blink={false} g={g} />
    </div>
  )
}

type Props = {
  selected: PetType | undefined
  onSelect: (type: PetType) => void
}

export function PetSelector({ selected, onSelect }: Props) {
  return (
    <div className="pet-selector">
      <h3 className="form-title">选择宠物形象</h3>
      <div className="pet-list">
        {PET_TYPES.map((type) => {
          const meta = PET_META[type]
          return (
            <button
              key={type}
              type="button"
              className={`pet-card ${selected === type ? 'active' : ''}`}
              onClick={() => onSelect(type)}
            >
              <div className="pet-avatar-preview">
                <MiniPet petType={type} />
              </div>
              <span className="pet-name">{meta.label}</span>
              <span className="pet-desc">{meta.desc}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
