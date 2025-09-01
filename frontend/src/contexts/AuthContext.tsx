import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { createClient, SupabaseClient, User } from '@supabase/supabase-js'
import { authService } from '../services/authService'

interface AuthContextType {
  user: User | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<{ error?: string }>
  signUp: (email: string, password: string, username: string) => Promise<{ error?: string }>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://tdisxnbzdpgzexbeopni.supabase.co'
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRkaXN4bmJ6ZHBnemV4YmVvcG5pIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY2NzcxMTUsImV4cCI6MjA3MjI1MzExNX0.MUODImjtrdw__9jw4F_Uw9mS3LyP587GZGmVl7kjRtE'

const supabase: SupabaseClient = createClient(supabaseUrl, supabaseKey)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    let initialized = false
    
    // Get initial session
    const initializeAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (mounted && !initialized) {
          initialized = true
          setUser(session?.user ?? null)
          if (session?.access_token) {
            authService.setToken(session.access_token)
          }
          setLoading(false)
        }
      } catch (error) {
        console.error('Auth initialization error:', error)
        if (mounted && !initialized) {
          initialized = true
          setLoading(false)
        }
      }
    }
    
    initializeAuth()

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (mounted) {
        // Only update loading state if we're not in the middle of initialization
        if (initialized || event === 'SIGNED_IN' || event === 'SIGNED_OUT') {
          setUser(session?.user ?? null)
          if (session?.access_token) {
            authService.setToken(session.access_token)
          } else {
            authService.clearToken()
          }
          setLoading(false)
        }
      }
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  const signIn = async (email: string, password: string) => {
    setLoading(true)
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) {
        setLoading(false)
        return { error: error.message }
      }
      
      // Store the JWT token for API calls
      if (data.session?.access_token) {
        authService.setToken(data.session.access_token)
      }
      
      // Loading will be set to false by onAuthStateChange
      return { error: undefined }
    } catch (error) {
      setLoading(false)
      return { error: 'Sign in failed' }
    }
  }

  const signUp = async (email: string, password: string, username: string) => {
    setLoading(true)
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { username },
          emailRedirectTo: undefined // Disable email confirmation
        }
      })
      if (error) {
        setLoading(false)
        return { error: error.message }
      }
      
      // Store the JWT token for API calls
      if (data.session?.access_token) {
        authService.setToken(data.session.access_token)
      }
      
      // Loading will be set to false by onAuthStateChange
      return { error: undefined }
    } catch (error) {
      setLoading(false)
      return { error: 'Sign up failed' }
    }
  }

  const signOut = async () => {
    setLoading(true)
    try {
      // Add timeout to prevent hanging
      const signOutPromise = supabase.auth.signOut()
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Logout timeout')), 5000)
      )
      
      try {
        await Promise.race([signOutPromise, timeoutPromise])
      } catch (supabaseError) {
        // Continue with local logout if Supabase fails
        console.warn('Supabase signOut failed, proceeding with local logout')
      }
      
      // Clear the stored token and local state
      authService.clearToken()
      setUser(null)
      setLoading(false)
      
      // Navigation will be handled by the ProtectedRoute component
      // when it detects user is null
    } catch (error) {
      console.error('Error during sign out:', error)
      // Force logout even if there's an error
      authService.clearToken()
      setUser(null)
      setLoading(false)
    }
  }

  const value = {
    user,
    loading,
    signIn,
    signUp,
    signOut
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
