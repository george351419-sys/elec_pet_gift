import { useState } from 'react'
import { ParentTab } from './tabs/ParentTab'
import { PetTab } from './tabs/PetTab'
import './App.css'

type Tab = 'parent' | 'pet'

export function App() {
  const [tab, setTab] = useState<Tab>('parent')

  return (
    <div className="app-shell">
      <header className="app-header">
        <span className="app-logo">🐾 魔法宠物</span>
        <nav className="app-tabs">
          <button
            className={`tab-btn ${tab === 'parent' ? 'active' : ''}`}
            onClick={() => setTab('parent')}
          >
            家长设置
          </button>
          <button
            className={`tab-btn ${tab === 'pet' ? 'active' : ''}`}
            onClick={() => setTab('pet')}
          >
            宠物陪伴
          </button>
        </nav>
      </header>

      <main className="app-main">
        <div className={`tab-panel ${tab === 'parent' ? 'visible' : ''}`}>
          <ParentTab />
        </div>
        <div className={`tab-panel ${tab === 'pet' ? 'visible' : ''}`}>
          <PetTab />
        </div>
      </main>
    </div>
  )
}
