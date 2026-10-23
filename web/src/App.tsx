import { Navigate, Route, Routes } from 'react-router-dom'
import { getToken } from './api/client'
import { AppShell } from './components/layout/AppShell'
import { AuthPage } from './pages/Auth'
import { HomePage } from './pages/Home'
import { CollectionPage } from './pages/Collection'
import { PlayPage } from './pages/Play'
import { LineupPage } from './pages/Lineup'
import { LiveMatchPage } from './pages/LiveMatch'
import { ResultPage } from './pages/Result'
import { TrainingPage } from './pages/Training'
import { LeaderboardPage } from './pages/Leaderboard'
import { HistoryPage } from './pages/History'
import { SquadPage } from './pages/Squad'
import type { ReactNode } from 'react'

function Guard({ children }: { children: ReactNode }) {
  if (!getToken()) return <Navigate to="/auth" replace />
  return children
}

export default function App() {
  return (
    <Routes>
      <Route path="/auth" element={<AuthPage />} />
      <Route
        element={
          <Guard>
            <AppShell />
          </Guard>
        }
      >
        <Route path="/" element={<HomePage />} />
        <Route path="/play" element={<PlayPage />} />
        <Route path="/squad" element={<SquadPage />} />
        <Route path="/collection" element={<CollectionPage />} />
        <Route path="/training" element={<TrainingPage />} />
        <Route path="/leaderboard" element={<LeaderboardPage />} />
        <Route path="/history" element={<HistoryPage />} />
        <Route path="/match/:id/lineup" element={<LineupPage />} />
        <Route path="/match/:id/live" element={<LiveMatchPage />} />
        <Route path="/match/:id/result" element={<ResultPage />} />
      </Route>
    </Routes>
  )
}
