import { useState } from 'react'
import type { LevelDef } from './game/levels'
import type { ScoreResult } from './game/scoring'
import { saveBestScore } from './game/scoring'
import Title from './screens/Title'
import LevelSelect from './screens/LevelSelect'
import Play from './screens/Play'
import Results from './screens/Results'

export interface PlayOutcome {
  result: ScoreResult
  targetUrl: string
  userUrl: string | null
  secondsUsed: number
  usedFallback: boolean
  inliers: number
  totalMatches: number
}

type Screen =
  | { name: 'title' }
  | { name: 'levels' }
  | { name: 'play'; level: LevelDef }
  | { name: 'results'; level: LevelDef; outcome: PlayOutcome }

export default function App() {
  const [screen, setScreen] = useState<Screen>({ name: 'title' })

  switch (screen.name) {
    case 'title':
      return <Title onStart={() => setScreen({ name: 'levels' })} />
    case 'levels':
      return (
        <LevelSelect
          onBack={() => setScreen({ name: 'title' })}
          onPick={(level) => setScreen({ name: 'play', level })}
        />
      )
    case 'play':
      return (
        <Play
          level={screen.level}
          onQuit={() => setScreen({ name: 'levels' })}
          onFinish={(outcome) => {
            saveBestScore(screen.level.id, outcome.result.score)
            setScreen({ name: 'results', level: screen.level, outcome })
          }}
        />
      )
    case 'results':
      return (
        <Results
          level={screen.level}
          outcome={screen.outcome}
          onRetry={() => setScreen({ name: 'play', level: screen.level })}
          onLevels={() => setScreen({ name: 'levels' })}
          onPlay={(level) => setScreen({ name: 'play', level })}
        />
      )
  }
}
