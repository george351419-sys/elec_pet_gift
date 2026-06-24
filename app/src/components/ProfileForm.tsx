import type { PetProfile } from '../lib/storage'
import './ProfileForm.css'

const PERSONALITY_TAGS = ['活泼', '安静', '好奇', '敏感', '爱笑', '粘人', '独立', '胆大', '害羞', '温柔', '倔强']

type Props = {
  values: Partial<PetProfile>
  onChange: (next: Partial<PetProfile>) => void
}

export function ProfileForm({ values, onChange }: Props) {
  const set = (key: keyof PetProfile, value: unknown) => onChange({ ...values, [key]: value })

  const toggleTag = (tag: string) => {
    const current = values.personality ?? []
    const next = current.includes(tag) ? current.filter((t) => t !== tag) : [...current, tag]
    set('personality', next)
  }

  return (
    <div className="profile-form">
      <h3 className="form-title">孩子档案</h3>
      <p className="form-hint">以下信息由 AI 根据访谈整理，请确认或修改</p>

      <div className="field-row">
        <div className="field">
          <label>孩子昵称</label>
          <input
            type="text"
            placeholder="宝宝的小名"
            value={values.nickname ?? ''}
            onChange={(e) => set('nickname', e.target.value)}
          />
        </div>
        <div className="field field-sm">
          <label>年龄</label>
          <input
            type="number"
            min={1}
            max={12}
            placeholder="岁"
            value={values.age || ''}
            onChange={(e) => set('age', Number(e.target.value))}
          />
        </div>
      </div>

      <div className="field">
        <label>性格描述 <span className="label-hint">（AI 总结，可修改）</span></label>
        <textarea
          placeholder="例如：活泼开朗，好奇心旺盛，有些黏人，遇到陌生人会害羞"
          value={values.personalitySummary ?? ''}
          onChange={(e) => set('personalitySummary', e.target.value)}
        />
      </div>

      <div className="field">
        <label>性格补充标签 <span className="label-hint">（可多选）</span></label>
        <div className="chip-group">
          {PERSONALITY_TAGS.map((tag) => (
            <button
              key={tag}
              type="button"
              className={`chip ${(values.personality ?? []).includes(tag) ? 'active' : ''}`}
              onClick={() => toggleTag(tag)}
            >
              {tag}
            </button>
          ))}
        </div>
      </div>

      <div className="field">
        <label>喜欢的事</label>
        <input
          type="text"
          placeholder="例如：恐龙、画画、唱歌"
          value={values.likes ?? ''}
          onChange={(e) => set('likes', e.target.value)}
        />
      </div>

      <div className="field">
        <label>害怕的事</label>
        <input
          type="text"
          placeholder="例如：打雷、黑暗、分离"
          value={values.fears ?? ''}
          onChange={(e) => set('fears', e.target.value)}
        />
      </div>

      <div className="field">
        <label>安抚方式</label>
        <input
          type="text"
          placeholder="例如：唱摇篮曲、讲故事"
          value={values.comfort ?? ''}
          onChange={(e) => set('comfort', e.target.value)}
        />
      </div>

      <div className="field">
        <label>亲子回忆</label>
        <textarea
          placeholder="写下 1–2 段特别的家庭故事，宠物会记住…"
          value={values.memories ?? ''}
          onChange={(e) => set('memories', e.target.value)}
        />
      </div>

      <div className="field">
        <label>鼓励方式</label>
        <input
          type="text"
          placeholder="例如：你最棒了！我相信你！"
          value={values.encouragement ?? ''}
          onChange={(e) => set('encouragement', e.target.value)}
        />
      </div>

      <div className="field">
        <label>其他重要信息 <span className="label-hint">（AI 摘录的其他关键细节）</span></label>
        <textarea
          placeholder="访谈中提到的其他值得记住的事情…"
          value={values.extras ?? ''}
          onChange={(e) => set('extras', e.target.value)}
        />
      </div>

      <div className="field">
        <label>给宠物起个名字（可选）</label>
        <input
          type="text"
          placeholder="例如：球球、小饼干"
          value={values.petName ?? ''}
          onChange={(e) => set('petName', e.target.value)}
        />
      </div>
    </div>
  )
}
