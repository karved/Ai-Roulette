import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { GameProvider } from './contexts/GameContext'
import { AuthProvider } from './contexts/AuthContext'
import GameLobby from './components/GameLobby'
import AuthForm from './components/AuthForm'
import { useAuth } from './contexts/AuthContext'
import { useAuthNavigation } from './hooks/useAuthNavigation'

// Protected Route Component
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-roulette-gold"></div>
      </div>
    )
  }

  return user ? <>{children}</> : <Navigate to="/login" replace />
}

// Public Route Component (redirects to game if already authenticated)
function PublicRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-roulette-gold"></div>
      </div>
    )
  }

  return user ? <Navigate to="/" replace /> : <>{children}</>
}

function AppContent() {
  // Handle automatic navigation after auth state changes
  useAuthNavigation()
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
      <Routes>
        <Route 
          path="/login" 
          element={
            <PublicRoute>
              <AuthForm />
            </PublicRoute>
          } 
        />
        <Route 
          path="/" 
          element={
            <ProtectedRoute>
              <GameProvider>
                <GameLobby />
              </GameProvider>
            </ProtectedRoute>
          } 
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  )
}

function App() {
  return (
    <Router>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </Router>
  )
}

export default App
