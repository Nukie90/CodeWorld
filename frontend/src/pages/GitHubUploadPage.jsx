// Repository Upload & Analysis Initiation Page
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useGithubAuth } from '../hooks/useGithubAuth'
import { repoService } from '../services/api'

function GitHubUploadPage() {
  const navigate = useNavigate()

  const {
    token,
    username,
    statusMessage,
    setStatusMessage,
    login,
    logout
  } = useGithubAuth()

  const [repoUrl, setRepoUrl] = useState('')
  const [uploadStatus, setUploadStatus] = useState('idle')
  const [progress, setProgress] = useState(0)

  const handleAnalyzeRepo = async () => {
    if (!repoUrl) return

    setUploadStatus('uploading')
    setStatusMessage('Initializing analysis...')
    setProgress(0)

    const taskId = crypto.randomUUID()

    // Connect to SSE for progress updates
    const eventSource = new EventSource(`http://127.0.0.1:8000/api/analyze/progress/${taskId}`)

    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data)
      if (data.progress !== undefined) setProgress(data.progress)
      if (data.message) setStatusMessage(data.message)

      if (data.done || data.error) {
        eventSource.close()
      }
    }

    eventSource.onerror = (err) => {
      console.error("SSE Error:", err)
      eventSource.close()
    }

    try {
      const resp = await repoService.analyzeRepo({
        repo_url: repoUrl,
        token: token || null,
        task_id: taskId
      })

      setProgress(100)
      setUploadStatus('success')

      navigate('/results', {
        state: {
          analysisResult: resp.data,
          token,
          username
        }
      })
    } catch (err) {
      eventSource.close()
      setUploadStatus('error')
      setStatusMessage(
        err?.response?.data?.detail || 'Failed to analyze repo'
      )
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-slate-100 flex flex-col">
      {/* Header */}
      <header className="bg-blue-300 text-black py-4 shadow-sm">
        <div className="container mx-auto px-6 flex items-center justify-between">
          <div className="text-2xl font-bold hover:opacity-90 transition-opacity">
            CodeWorld
          </div>

          {token ? (
            <div className="flex items-center gap-3">
              <span className="text-sm font-semibold">@{username}</span>
              <button
                onClick={logout}
                className="bg-red-500 text-white px-3 py-1 rounded-lg text-sm"
              >
                Logout
              </button>
            </div>
          ) : (
            <button
              onClick={login}
              className="bg-white text-blue-600 px-4 py-2 rounded-lg font-semibold text-sm hover:bg-blue-50 transition-colors"
            >
              Login with GitHub
            </button>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-4xl">
          <div className="text-center mb-8">
            <h2 className="text-4xl font-bold text-gray-900 mb-3">
              Code Analysis Tool
            </h2>
            <p className="text-gray-600">
              Select github repo for complexity analysis
            </p>
          </div>

          <div className="bg-white rounded-2xl shadow-xl p-8">
            <h3 className="text-xl font-semibold text-gray-900 mb-6">
              Upload from GitHub URL
            </h3>

            <div className="flex gap-3 mb-6">
              <input
                type="text"
                placeholder="Enter GitHub repository URL"
                value={repoUrl}
                onChange={e => setRepoUrl(e.target.value)}
                className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                disabled={uploadStatus === 'uploading'}
              />
              <button
                onClick={handleAnalyzeRepo}
                disabled={!repoUrl || uploadStatus === 'uploading'}
                className="px-6 py-3 bg-blue-500 text-white font-semibold rounded-lg hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
              >
                Next
              </button>
            </div>

            {uploadStatus === 'error' && (
              <div className="mt-4 p-4 bg-red-50 border border-red-300 rounded-lg">
                <p className="text-red-700 font-medium">❌ Error</p>
                <p className="text-red-600 text-sm mt-1">
                  {statusMessage}
                </p>
              </div>
            )}

            {uploadStatus === 'uploading' && (
              <div className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-700">
                      Uploading...
                    </span>
                    <span className="text-sm text-blue-600 font-semibold">
                      {progress}%
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-blue-500 h-full transition-all duration-300 ease-out"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}

export default GitHubUploadPage
