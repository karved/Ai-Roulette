import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { createClient, SupabaseClient, User } from '@supabase/supabase-js'

interface AuthContextType {
  user: User | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<{ error?: string }>
  signUp: (email: string, password: string, username: string) => Promise<{ error?: string }>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'mock-url'
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'mock-key'

// Mock client for development
const createMockClient = () => ({
  auth: {
    signInWithPassword: async ({ email }: { email: string, password: string }) => ({
      data: { user: { id: 'mock-user', email, user_metadata: { username: email.split('@')[0] } }, session: { access_token: 'mock-token' } },
      error: null
    }),
    signUp: async ({ email, password, options }: any) => ({
      data: { user: { id: 'mock-user', email, user_metadata: options?.data }, session: null },
      error: null
    }),
    signOut: async () => ({ error: null }),
    onAuthStateChange: (callback: any) => {
      // Mock user session
      setTimeout(() => {
        callback('SIGNED_IN', { user: { id: 'mock-user', email: 'test@example.com', user_metadata: { username: 'testuser' } } })
      }, 100)
      return { data: { subscription: { unsubscribe: () => {} } } }
    },
    getSession: async () => ({
      data: { session: { user: { id: 'mock-user', email: 'test@example.com', user_metadata: { username: 'testuser' } } } },
      error: null
    })
  }
})

const supabase: SupabaseClient = supabaseUrl.includes('mock') 
  ? createMockClient() as any
  : createClient(supabaseUrl, supabaseKey)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      setLoading(false)
    })

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      setLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [])

  const signIn = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) return { error: error.message }
    return { error: undefined }
  }

  const signUp = async (email: string, password: string, username: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { username }
      }
    })
    if (error) return { error: error.message }
    return { error: undefined }
  }

  const signOut = async () => {
    await supabase.auth.signOut()
    // Ensure local state resets immediately (mock mode may not emit an event)
    setUser(null)
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
