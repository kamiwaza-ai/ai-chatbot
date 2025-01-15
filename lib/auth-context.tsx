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
    try {
      const userData = await verifyToken()
      if (userData) {
        setUser(userData)
      } else {
        setUser(null)
      }
    } catch (error) {
      console.error('AuthContext checkAuth: Error verifying token:', error)
      setUser(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    checkAuth()
  }, [])

  const logout = async () => {
    try {
      // Clear all cookies
      document.cookie = 'access_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT'
      document.cookie = 'refresh_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT'
      document.cookie = 'token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT'
      
      // Clear localStorage
      if (typeof window !== 'undefined') {
        localStorage.removeItem('access_token')
        localStorage.removeItem('refreshToken')
      }
      
      setUser(null)
      
      // Wait for state update
      await new Promise(resolve => setTimeout(resolve, 0))
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
