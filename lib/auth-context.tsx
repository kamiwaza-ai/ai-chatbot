'use client'

import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { UserData, verifyToken } from '@/lib/kamiwazaApi'

interface AuthContextType {
  user: UserData | null
  loading: boolean
  logout: () => Promise<void>
  setUser: (user: UserData | null) => void
  checkAuth: () => Promise<void>
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  logout: async () => {},
  setUser: () => {},
  checkAuth: async () => {}
})

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserData | null>(null)
  const [loading, setLoading] = useState(true)

  const checkAuth = async () => {
    console.log('AuthContext checkAuth: Starting verification')
    try {
      const userData = await verifyToken()
      console.log('AuthContext checkAuth: Verify token result:', userData)
      if (userData) {
        console.log('AuthContext checkAuth: Setting user state:', userData.id)
        setUser(userData)
      } else {
        console.log('AuthContext checkAuth: No user data, setting null')
        setUser(null)
      }
    } catch (error) {
      console.error('AuthContext checkAuth: Error verifying token:', error)
      setUser(null)
    } finally {
      console.log('AuthContext checkAuth: Setting loading false')
      setLoading(false)
    }
  }

  useEffect(() => {
    console.log('AuthContext: Initial mount effect running')
    checkAuth()
  }, [])

  useEffect(() => {
    console.log('AuthContext: User state changed:', user?.id)
  }, [user])

  const logout = async () => {
    console.log('AuthContext: Starting logout')
    try {
      // Clear all cookies
      console.log('AuthContext: Clearing cookies')
      document.cookie = 'access_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT'
      document.cookie = 'refresh_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT'
      document.cookie = 'token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT'
      
      // Clear localStorage
      console.log('AuthContext: Clearing localStorage')
      if (typeof window !== 'undefined') {
        localStorage.removeItem('access_token')
        localStorage.removeItem('refreshToken')
      }
      
      console.log('AuthContext: Setting user to null')
      setUser(null)
      
      // Wait for state update
      await new Promise(resolve => setTimeout(resolve, 0))
      
      console.log('AuthContext: Logout complete')
    } catch (error) {
      console.error('AuthContext: Error during logout:', error)
    }
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        logout,
        setUser,
        checkAuth
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
