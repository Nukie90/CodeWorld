// Repository Upload & Analysis Initiation Page
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useGithubAuth } from '../hooks/useGithubAuth'
import { repoService, authService, userService } from '../services/api'
import { Sun, Moon, Github, Star, Code, Clock, ChevronRight, Heart, Volume2, VolumeX } from 'lucide-react'
import { audioManager } from '../utils/audioManager'

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
  const [isMuted, setIsMuted] = useState(audioManager.isMuted)

  // Default to false explicitly so it doesn't try to inherit system or previous class implicitly and break consistency
  const [isDarkMode, setIsDarkMode] = useState(false)
  const [repos, setRepos] = useState([])
  const [isLoadingRepos, setIsLoadingRepos] = useState(false)
  const [repoError, setRepoError] = useState(null)
  const [favorites, setFavorites] = useState([])
  const [animatingFav, setAnimatingFav] = useState(null)
  const [recentRepos, setRecentRepos] = useState([])

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }, [isDarkMode])

  useEffect(() => {
    const fetchRepos = async () => {
      if (!token) {
        setRepos([])
        return
      }

      setIsLoadingRepos(true)
      setRepoError(null)
      try {
        const response = await authService.getRepos(token)
        setRepos(response.data)
      } catch (err) {
        console.error("Failed to fetch repos:", err)
        setRepoError("Could not load repositories.")
      } finally {
        setIsLoadingRepos(false)
      }
    }

    fetchRepos()
  }, [token])

  // Manage Favorites
  useEffect(() => {
    if (username && token) {
      userService.getFavouriteRepos(token).then((res) => {
        // use full_name as the identifier
        setFavorites(res.data.map(repo => repo.repo_full_name))
      }).catch(err => {
        console.error("Failed to fetch favorites", err)
      });
    }
  }, [username, token])

  const toggleFavorite = async (e, repo) => {
    e.stopPropagation() // Prevent selecting the repo when clicking heart
    const repoFullName = repo.full_name || repo.name
    const isAdding = !favorites.includes(repoFullName)

    // Optimistic UI Update
    const newFavorites = isAdding
      ? [...favorites, repoFullName]
      : favorites.filter(id => id !== repoFullName)

    setFavorites(newFavorites)

    if (isAdding) {
      setAnimatingFav(repoFullName)
      setTimeout(() => setAnimatingFav(null), 300)
    }

    if (token) {
      try {
        if (isAdding) {
          await userService.addFavouriteRepo(token, repoFullName, repo.html_url || `https://github.com/${repoFullName}`)
        } else {
          await userService.removeFavouriteRepo(token, repoFullName)
        }
      } catch (err) {
        console.error("Failed to update favorite status", err)
        // Optionally revert state on failure
      }
    }
  }

  // Manage Recent Repos
  useEffect(() => {
    if (username && token) {
      userService.getRecentRepos(token).then((res) => {
        // The endpoint returns { repo_full_name, repo_url, accessed_at }
        // We will map it to match the expected structure
        setRecentRepos(res.data.map(item => ({
             name: item.repo_full_name.split('/').pop(),
             full_name: item.repo_full_name,
             html_url: item.repo_url,
             private: false // Missing this data, but we can display normally
        })))
      }).catch(err => {
         console.error("Failed to fetch recent repos", err)
      });
    }
  }, [username, token])

  const addToRecent = (repo) => {
    // With backend storing recents on checkout, we don't strictly need to do manual localStorage
    // but we can update state optimistically
    if (!username || !repo) return

    const repoSummary = {
      name: repo.name,
      full_name: repo.full_name || repo.name,
      html_url: repo.html_url || `https://github.com/${repo.full_name}`,
      private: repo.private || false
    }

    const newRecent = [
      repoSummary,
      ...recentRepos.filter(r => r.html_url !== repoSummary.html_url)
    ].slice(0, 6)

    setRecentRepos(newRecent)
  }

  const sortedRepos = [...repos].sort((a, b) => {
    const aFav = favorites.includes(a.full_name)
    const bFav = favorites.includes(b.full_name)
    if (aFav && !bFav) return -1
    if (!aFav && bFav) return 1
    return 0
  })

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
      // Find the repo object from the current list if possible to get full metadata for recents
      const currentRepo = repos.find(r => r.html_url === repoUrl) || {
        id: repoUrl,
        name: repoUrl.split('/').pop().replace(/\.git$/, ''),
        html_url: repoUrl,
        full_name: repoUrl.replace('https://github.com/', '')
      }
      addToRecent(currentRepo)

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

  const handleToggleMute = () => {
    audioManager.init()
    const newMutedState = audioManager.toggleMute()
    setIsMuted(newMutedState)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-white via-sky-50 to-blue-200 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 flex flex-col transition-colors duration-500">
      {/* Header */}
      <header className="bg-gradient-to-r from-sky-100 to-blue-300 dark:from-gray-800 dark:to-gray-900 text-slate-800 dark:text-white py-4 shadow-sm border-b border-white/50 dark:border-gray-700/50 transition-colors duration-500">
        <div className="w-full px-8 flex items-center justify-between">
          <div className="text-2xl font-bold tracking-tight hover:opacity-90 transition-opacity">
            CodeWorld
          </div>

          <div className="flex items-center gap-4">
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
                className="bg-white dark:bg-blue-600 text-blue-600 dark:text-white px-4 py-2 rounded-lg font-semibold text-sm hover:bg-blue-50 dark:hover:bg-blue-500 transition-colors shadow-sm"
              >
                Login with GitHub
              </button>
            )}
            <button
              onClick={handleToggleMute}
              className="p-3 rounded-2xl bg-white/10 dark:bg-black/20 backdrop-blur-xl shadow-md transition-all text-slate-800 dark:text-white border border-white/40 dark:border-white/10 hover:scale-105 hover:bg-white/30 dark:hover:bg-black/30"
              title={isMuted ? "Unmute Sound" : "Mute Sound"}
            >
              {isMuted ? <VolumeX size={22} strokeWidth={2.5} /> : <Volume2 size={22} strokeWidth={2.5} />}
            </button>
            <button
              onClick={() => setIsDarkMode(!isDarkMode)}
              className="p-3 rounded-2xl bg-white/10 dark:bg-black/20 backdrop-blur-xl shadow-md transition-all text-slate-800 dark:text-white border border-white/40 dark:border-white/10 hover:scale-105 hover:bg-white/30 dark:hover:bg-black/30"
              title="Toggle Dark/Light Mode"
            >
              {isDarkMode ? <Sun size={22} strokeWidth={2.5} /> : <Moon size={22} strokeWidth={2.5} />}
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center px-6 py-20">
        <div className="w-full max-w-4xl">
          <div className="text-center mb-8">
            <h2 className="text-4xl font-bold text-gray-900 dark:text-white mb-3 transition-colors">
              Code Analysis Tool
            </h2>
            <p className="text-gray-600 dark:text-gray-300 transition-colors">
              Select github repo for complexity analysis
            </p>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 transition-colors duration-300">
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-6">
              Upload from GitHub URL
            </h3>

            <div className="flex gap-3 mb-6">
              <input
                type="text"
                placeholder="Enter GitHub repository URL"
                value={repoUrl}
                onChange={e => setRepoUrl(e.target.value)}
                className="flex-1 px-4 py-3 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-400 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-colors"
                disabled={uploadStatus === 'uploading'}
              />
              <button
                onClick={handleAnalyzeRepo}
                disabled={!repoUrl || uploadStatus === 'uploading'}
                className="px-6 py-3 bg-blue-500 text-white font-semibold rounded-lg hover:bg-blue-600 disabled:bg-gray-300 dark:disabled:bg-gray-600 disabled:text-gray-500 dark:disabled:text-gray-400 disabled:cursor-not-allowed transition-colors"
              >
                Next
              </button>
            </div>

            {uploadStatus === 'error' && (
              <div className="mt-4 p-4 bg-red-50 dark:bg-red-900/30 border border-red-300 dark:border-red-800 rounded-lg transition-colors">
                <p className="text-red-700 dark:text-red-400 font-medium">❌ Error</p>
                <p className="text-red-600 dark:text-red-300 text-sm mt-1">
                  {statusMessage}
                </p>
              </div>
            )}

            {uploadStatus === 'uploading' && (
              <div className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300 truncate mr-4">
                      {statusMessage || 'Initializing...'}
                    </span>
                    <span className="text-sm text-blue-600 dark:text-blue-400 font-semibold shrink-0">
                      {progress}%
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5 overflow-hidden">
                    <div
                      className="bg-gradient-to-r from-blue-500 to-blue-400 h-full transition-all duration-500 ease-out rounded-full"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Recent Repositories Section */}
          {token && recentRepos.length > 0 && (
            <div className="mt-8 animate-in fade-in slide-in-from-bottom-4 duration-700 py-15">
              <div className="flex items-center justify-between mb-4 px-2">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                  <Clock size={20} className="text-blue-500" />
                  Recent Access
                </h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {recentRepos.map((repo) => (
                  <button
                    key={`recent-${repo.html_url}`}
                    onClick={() => {
                      setRepoUrl(repo.html_url)
                      window.scrollTo({ top: 0, behavior: 'smooth' })
                    }}
                    className="flex flex-col p-3 bg-white/60 dark:bg-gray-800/60 backdrop-blur-sm rounded-xl border border-gray-100 dark:border-gray-700 hover:border-blue-400 dark:hover:border-blue-500/50 hover:bg-white dark:hover:bg-gray-800 shadow-sm transition-all text-left group"
                  >
                    <div className="flex items-start justify-between mb-1">
                      <span className="font-semibold text-sm text-gray-900 dark:text-white truncate pr-4 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                        {repo.name.replace(/\.git$/, '')}
                      </span>
                      {repo.private && (
                        <span className="text-[8px] font-bold uppercase px-1 py-0.5 bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-400 rounded-md">
                          P
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] text-gray-400 dark:text-gray-500 truncate">
                      {repo.full_name}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Repository List Section */}
          {token && (
            <div className="mt-8 animate-in fade-in slide-in-from-bottom-4 duration-700 py-0">
              <div className="flex items-center justify-between mb-4 px-2">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                  <Github size={20} className="text-blue-500" />
                  Your Repositories
                </h3>
                {repos.length > 0 && (
                  <span className="text-xs font-medium text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded-full">
                    {repos.length} repos
                  </span>
                )}
              </div>

              {isLoadingRepos ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="h-24 bg-white dark:bg-gray-800 rounded-xl animate-pulse border border-gray-100 dark:border-gray-700" />
                  ))}
                </div>
              ) : repoError ? (
                <div className="p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/50 rounded-xl text-amber-700 dark:text-amber-400 text-sm flex items-center gap-2">
                  <span>⚠️</span> {repoError}
                </div>
              ) : repos.length === 0 ? (
                <div className="text-center py-12 bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm rounded-2xl border border-dashed border-gray-300 dark:border-gray-700">
                  <Github size={40} className="mx-auto text-gray-400 mb-3 opacity-50" />
                  <p className="text-gray-500 dark:text-gray-400">No repositories found.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {sortedRepos.slice(0, 50).map((repo) => {
                    const isFav = favorites.includes(repo.full_name)
                    return (
                      <button
                        key={repo.id}
                        onClick={() => {
                          setRepoUrl(repo.html_url)
                          addToRecent(repo)
                          window.scrollTo({ top: 0, behavior: 'smooth' })
                        }}
                        className={`group flex flex-col p-4 bg-white dark:bg-gray-800 rounded-xl border ${isFav ? 'border-pink-300 dark:border-pink-900/50 shadow-pink-50/50 dark:shadow-none bg-pink-50/10 dark:bg-pink-900/5' : 'border-gray-100 dark:border-gray-700'} hover:border-blue-400 dark:hover:border-blue-500/50 shadow-sm hover:shadow-md transition-all text-left relative overflow-hidden`}
                      >
                        <div className="absolute top-0 right-0 p-2 flex items-center gap-1">
                          <button
                            onClick={(e) => toggleFavorite(e, repo)}
                            className={`p-2 rounded-full transition-all ${isFav ? 'text-pink-500 bg-pink-50 dark:bg-pink-900/30' : 'text-gray-300 hover:text-pink-400 opacity-0 group-hover:opacity-100'} ${animatingFav === repo.full_name ? 'animate-heart-pop' : ''}`}
                            title={isFav ? "Remove from favorites" : "Add to favorites"}
                          >
                            <Heart size={18} fill={isFav ? "currentColor" : "none"} />
                          </button>
                          <div className="p-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <ChevronRight size={18} className="text-blue-500" />
                          </div>
                        </div>

                        <div className="flex items-center gap-2 mb-1 pr-16 flex-wrap">
                          <span className={`font-bold ${isFav ? 'text-pink-700 dark:text-pink-300' : 'text-gray-900 dark:text-white'} group-hover:text-blue-600 dark:group-hover:text-blue-400 truncate transition-colors`}>
                            {repo.name.replace(/\.git$/, '')}
                          </span>
                          {repo.private && (
                            <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-400 rounded-md shrink-0">
                              Private
                            </span>
                          )}
                        </div>

                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-3 line-clamp-1 h-4">
                          {repo.description || "No description provided"}
                        </p>

                        <div className="mt-auto flex items-center gap-3 text-[11px] font-medium text-gray-400 dark:text-gray-500">
                          {repo.language && (
                            <span className="flex items-center gap-1 bg-gray-50 dark:bg-gray-900 px-1.5 py-0.5 rounded">
                              <Code size={12} />
                              {repo.language}
                            </span>
                          )}
                          <span className="flex items-center gap-1">
                            <Star size={12} />
                            {repo.stargazers_count}
                          </span>
                          <span className="flex items-center gap-1 ml-auto">
                            <Clock size={12} />
                            {new Date(repo.updated_at).toLocaleDateString()}
                          </span>
                        </div>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}

export default GitHubUploadPage
