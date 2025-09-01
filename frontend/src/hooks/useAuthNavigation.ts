import { useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export function useAuthNavigation() {
  const { user, loading } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  useEffect(() => {
    if (!loading) {
      // If user just logged in and we're on login page, redirect to home
      if (user && location.pathname === '/login') {
        navigate('/', { replace: true })
      }
      // If user logged out and we're not on login page, redirect to login
      else if (!user && location.pathname !== '/login') {
        navigate('/login', { replace: true })
      }
    }
  }, [user, loading, navigate, location.pathname])
}
