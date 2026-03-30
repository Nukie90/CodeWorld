import { useEffect, useState } from 'react'
import { authService } from '../services/api'

export function useGithubAuth() {
  const [token, setToken] = useState('')
  const [username, setUsername] = useState('')
  const [statusMessage, setStatusMessage] = useState('')
  const [isInitialized, setIsInitialized] = useState(false)

  // Initialize auth state from localStorage on mount
  useEffect(() => {
    const storedToken = localStorage.getItem('access_token')
    const storedUsername = localStorage.getItem('username')

    if (storedToken) {
      setToken(storedToken)
      setUsername(storedUsername || '')
    }
    setIsInitialized(true)
  }, [])

  // Handle OAuth callback from URL params
  useEffect(() => {
    if (!isInitialized) return

    const params = new URLSearchParams(window.location.search)
    const accessToken = params.get('token')
    const ghUsername = params.get('username')

    if (accessToken) {
      setToken(accessToken)
      setUsername(ghUsername || '')
      localStorage.setItem('access_token', accessToken)
      localStorage.setItem('username', ghUsername || '')
      setStatusMessage('Logged in with GitHub')

      // Clean up URL params without reloading the page
      const newUrl = window.location.pathname
      window.history.replaceState({}, document.title, newUrl)
    }
  }, [isInitialized])

  const login = async () => {
    console.log('Initiating GitHub login...')
    try {
      const resp = await authService.login()
      if (resp.data?.auth_url) {
        window.location.assign(resp.data.auth_url)
        console.log('GitHub auth URL:', resp.data.auth_url);

      } else {
        setStatusMessage('Failed to get GitHub auth URL')
      }
    } catch (error) {
      console.error('GitHub login error', error)
      setStatusMessage('GitHub login failed: ' + (error.response?.data?.detail || error.message))
    }
  }

  const logout = async () => {
    if (!token) {
      // Clear state even if no token (in case of stale state)
      setToken('')
      setUsername('')
      localStorage.removeItem('access_token')
      localStorage.removeItem('username')
      setStatusMessage('Logged out')
      return
    }

    try {
      await authService.logout(token)
    } catch (error) {
      console.error('Logout error', error)
      // Continue with logout even if backend call fails
    }

    setToken('')
    setUsername('')
    localStorage.removeItem('access_token')
    localStorage.removeItem('username')
    setStatusMessage('Logged out')
  }

  return {
    token,
    username,
    statusMessage,
    setStatusMessage,
    login,
    logout
  }
}
