import type { TranscriptTurn } from '@fdv/client'
import './SubtitleArea.css'

type Props = {
  turns: TranscriptTurn[]
}

export function SubtitleArea({ turns }: Props) {
  const visible = turns.slice(-2)
  return (
    <div className="subtitle-area" aria-live="polite">
      {visible.map((turn, i) => {
        const isLatest = i === visible.length - 1
        return (
          <p
            key={`${turn.role}-${turn.sequence}`}
            className={`subtitle-line ${turn.role} ${isLatest ? 'latest' : 'prev'}`}
          >
            {turn.role === 'child' && <span className="subtitle-label">你说：</span>}
            {turn.content}
          </p>
        )
      })}
    </div>
  )
}
