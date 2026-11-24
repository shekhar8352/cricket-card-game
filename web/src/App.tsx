import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
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
import { ProfilePage } from './pages/Profile'
import { LeaderboardPage } from './pages/Leaderboard'
import { HistoryPage } from './pages/History'
import { SquadPage } from './pages/Squad'
import { AccountPage } from './pages/Account'
import { EnginePage } from './pages/Engine'
import { JoinRoomPage } from './pages/JoinRoom'
import { TournamentPage } from './pages/Tournament'
import { PublicShell } from './components/layout/PublicShell'
import type { ReactNode } from 'react'

function Guard({ children }: { children: ReactNode }) {
  const loc = useLocation()
  // Remember where they were going (e.g. an invite link) so sign-in comes back to it.
  if (!getToken()) return <Navigate to="/auth" replace state={{ from: loc.pathname + loc.search }} />
  return children
}

export default function App() {
  return (
    <Routes>
      <Route path="/auth" element={<AuthPage />} />
      <Route path="/how-it-works" element={getToken() ? <Navigate to="/engine" replace /> : <PublicShell><EnginePage /></PublicShell>} />
      <Route
        element={
          <Guard>
            <AppShell />
          </Guard>
        }
      >
        <Route path="/" element={<HomePage />} />
        <Route path="/play" element={<PlayPage />} />
        <Route path="/join/:code" element={<JoinRoomPage />} />
        <Route path="/tournaments/:id" element={<TournamentPage />} />
        <Route path="/squad" element={<SquadPage />} />
        <Route path="/collection" element={<CollectionPage />} />
        <Route path="/training" element={<TrainingPage />} />
        <Route path="/leaderboard" element={<LeaderboardPage />} />
        <Route path="/players/:id" element={<ProfilePage />} />
        <Route path="/history" element={<HistoryPage />} />
        <Route path="/account" element={<AccountPage />} />
        <Route path="/engine" element={<EnginePage />} />
        <Route path="/match/:id/lineup" element={<LineupPage />} />
        <Route path="/match/:id/live" element={<LiveMatchPage />} />
        <Route path="/match/:id/result" element={<ResultPage />} />
      </Route>
    </Routes>
  )
}
