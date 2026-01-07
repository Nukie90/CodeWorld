import { useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'

/**
 * This page handles GitHub OAuth callbacks that might be redirected to the frontend.
 * It extracts the code and redirects to the backend callback endpoint.
 * 
 * Note: The GitHub OAuth app should be configured to redirect to:
 * http://127.0.0.1:8000/api/auth/github/callback (backend)
 * NOT to the frontend URL.
 */
function GitHubCallbackPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const code = searchParams.get('code')
  const error = searchParams.get('error')

  useEffect(() => {
    if (error) {
      // If there's an error from GitHub, show it and redirect home
      console.error('GitHub OAuth error:', error)
      navigate('/?error=' + encodeURIComponent(error), { replace: true })
      return
    }

    if (code) {
      // If we have a code, redirect to backend callback
      // The backend will handle the token exchange and redirect back to frontend
      const backendCallbackUrl = `http://127.0.0.1:8000/api/auth/github/callback?code=${code}`
      window.location.href = backendCallbackUrl
    } else {
      // No code, redirect home
      navigate('/', { replace: true })
    }
  }, [code, error, navigate])

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-slate-100 flex items-center justify-center">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">
          Processing GitHub authentication...
        </h2>
        <p className="text-gray-600">Please wait while we complete your login.</p>
      </div>
    </div>
  )
}

export default GitHubCallbackPage

