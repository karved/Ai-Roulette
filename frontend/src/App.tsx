import { GameProvider } from './contexts/GameContext'
import { AuthProvider } from './contexts/AuthContext'
import GameLobby from './components/GameLobby'
import AuthForm from './components/AuthForm'
import { useAuth } from './contexts/AuthContext'

function AppContent() {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-roulette-gold"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
      {user ? (
        <GameProvider>
          <GameLobby />
        </GameProvider>
      ) : (
        <AuthForm />
      )}
    </div>
  )
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  )
}

export default App
