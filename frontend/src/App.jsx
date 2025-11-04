import { useEffect, useState } from 'react'
import axios from 'axios'
import JSZip from 'jszip'
import './App.css'
import UploadView from './components/UploadView'
import Results from './components/results/Results'

function App() {
  const [selectedFile, setSelectedFile] = useState(null)
  const [selectedFolder, setSelectedFolder] = useState(null)
  const [uploadType, setUploadType] = useState('folder')
  const [previewUrl, setPreviewUrl] = useState(null)
  const [status, setStatus] = useState('idle')
  const [statusMessage, setStatusMessage] = useState('')
  const [progress, setProgress] = useState(0)
  const [analysisResult, setAnalysisResult] = useState(null)
  const [view, setView] = useState('upload')
  const [repoUrl, setRepoUrl] = useState('')
  const [token, setToken] = useState('')
  const [username, setUsername] = useState('')

  const handleFileSelection = (file) => {
    if (!file) return
    if (uploadType === 'folder') {
      setSelectedFolder(file)
      setSelectedFile(null)
    } else {
      setSelectedFile(file)
      setSelectedFolder(null)
    }
    setStatus('ready')
    setStatusMessage('')
    setProgress(0)
  }

  const handleFileInput = (event) => {
    const file = event.target.files?.[0]
    handleFileSelection(file)
  }

  const handleFolderInput = async (event) => {
    const files = Array.from(event.target.files)
    if (files.length === 0) return
    try {
      const zip = new JSZip()
      const folderName = files[0].webkitRelativePath.split('/')[0]
      files.forEach(file => {
        const relativePath = file.webkitRelativePath.substring(folderName.length + 1)
        zip.file(relativePath, file)
      })
      const zipBlob = await zip.generateAsync({ type: 'blob' })
      const zipFile = new File([zipBlob], `${folderName}.zip`, { type: 'application/zip' })
      handleFileSelection(zipFile)
    } catch (error) {
      console.error('Error creating zip:', error)
      setStatus('error')
      setStatusMessage('Error processing folder. Please try again.')
    }
  }

  const handleDrop = (event) => {
    event.preventDefault()
    if (uploadType === 'folder') return
    const file = event.dataTransfer.files?.[0]
    handleFileSelection(file)
  }

  const handleDragOver = (event) => {
    event.preventDefault()
    event.dataTransfer.dropEffect = 'copy'
  }

  const handleUpload = async (event) => {
    event.preventDefault()
    const fileToUpload = uploadType === 'folder' ? selectedFolder : selectedFile
    if (!fileToUpload || status === 'uploading') return
    const formData = new FormData()
    formData.append('file', fileToUpload)
    const endpoint = uploadType === 'folder' ? 'uploadfolder' : 'uploadfile'
    setStatus('uploading')
    setStatusMessage(uploadType === 'folder' ? 'Analyzing your folder...' : 'Uploading your file...')
    setProgress(0)
    try {
      const response = await axios.post(
        `http://127.0.0.1:8000/api/${endpoint}`,
        formData,
        {
          headers: { 'Content-Type': 'multipart/form-data' },
          onUploadProgress: (event) => {
            if (event.total) setProgress(Math.round((event.loaded / event.total) * 100))
            else setProgress((previous) => (previous >= 95 ? previous : previous + 5))
          },
        },
      )
      setProgress(100)
      const payload = response?.data || null
      setStatus('success')
      setStatusMessage('Analysis complete!')
      setAnalysisResult(payload)
      if (payload) setView('results')
    } catch (error) {
      setStatus('error')
      setStatusMessage(error?.response?.data?.detail || error?.message || 'Analysis failed. Please try again.')
    }
  }

  const handleGithubLogin = async () => {
    try {
      const resp = await axios.get('http://127.0.0.1:8000/api/auth/github/login')
      const { auth_url } = resp.data || {}
      if (auth_url) window.location.href = auth_url
    } catch (err) {
      console.error('Login error', err)
      setStatus('error')
      setStatusMessage('Failed to start GitHub login')
    }
  }

  const handleGithubLogout = async () => {
    if (!token) { setStatusMessage('No token to logout'); return }
    try {
      await axios.post('http://127.0.0.1:8000/api/auth/logout', { token })
      setToken('')
      setUsername('')
      localStorage.removeItem('access_token')
      localStorage.removeItem('username')
      setStatus('idle')
      setStatusMessage('Logged out')
    } catch (err) {
      console.error('Logout error', err)
      setStatus('error')
      setStatusMessage('Logout failed')
    }
  }

  const handleAnalyzeRepo = async () => {
    if (!repoUrl) return
    setStatus('uploading')
    setStatusMessage('Cloning and analyzing repository...')
    setProgress(5)
    try {
      const resp = await axios.post('http://127.0.0.1:8000/api/analyze/repo', { repo_url: repoUrl, token: token || null })
      setProgress(100)
      setStatus('success')
      setStatusMessage('Analysis complete!')
      setAnalysisResult(resp.data)
      setView('results')
    } catch (err) {
      console.error('Analyze repo error', err)
      setStatus('error')
      setStatusMessage(err?.response?.data?.detail || err.message || 'Failed to analyze repo')
    }
  }

  const handleRemoveFile = () => {
    setSelectedFile(null)
    setSelectedFolder(null)
    setPreviewUrl(null)
    setStatus('idle')
    setProgress(0)
    setStatusMessage('')
    setAnalysisResult(null)
    setView('upload')
  }

  const handleReturnToUpload = () => handleRemoveFile()

  const getSelectedFileName = () => {
    if (uploadType === 'folder' && selectedFolder) return selectedFolder.name
    if (uploadType === 'file' && selectedFile) return selectedFile.name
    return null
  }

  const getSelectedFileSize = () => {
    if (uploadType === 'folder' && selectedFolder) return selectedFolder.size
    if (uploadType === 'file' && selectedFile) return selectedFile.size
    return 0
  }

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const access_token = params.get('access_token')
    const user = params.get('username')
    if (access_token) {
      setToken(access_token)
      setUsername(user || '')
      localStorage.setItem('access_token', access_token)
      if (user) localStorage.setItem('username', user)
      const newUrl = window.location.origin + window.location.pathname
      window.history.replaceState({}, document.title, newUrl)
    } else {
      const stored = localStorage.getItem('access_token')
      const storedUser = localStorage.getItem('username')
      if (stored) setToken(stored)
      if (storedUser) setUsername(storedUser)
    }

    const file = uploadType === 'file' ? selectedFile : null
    if (!file || !file.type.startsWith('image/')) { setPreviewUrl(null); return }
    const url = URL.createObjectURL(file)
    setPreviewUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [selectedFile, uploadType])

  return (
    <div style={{
      minHeight: '100vh',
      margin: 0,
      padding: '3rem 1.5rem',
      background: 'linear-gradient(160deg, #f3f4f6 0%, #e2e8f0 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      boxSizing: 'border-box'
    }}>
      {view === 'results' ? (
        <Results analysisResult={analysisResult} onBack={handleReturnToUpload} token={token} setAnalysisResult={setAnalysisResult} username={username} />
      ) : (
        <UploadView
          uploadType={uploadType}
          setUploadType={setUploadType}
          selectedFile={selectedFile}
          selectedFolder={selectedFolder}
          previewUrl={previewUrl}
          status={status}
          statusMessage={statusMessage}
          progress={progress}
          handleFileInput={handleFileInput}
          handleFolderInput={handleFolderInput}
          handleDragOver={handleDragOver}
          handleDrop={handleDrop}
          handleUpload={handleUpload}
          handleRemoveFile={handleRemoveFile}
          getSelectedFileName={getSelectedFileName}
          getSelectedFileSize={getSelectedFileSize}
          // github props
          repoUrl={repoUrl}
          setRepoUrl={setRepoUrl}
          token={token}
          setToken={setToken}
          handleGithubLogin={handleGithubLogin}
          handleGithubLogout={handleGithubLogout}
          handleAnalyzeRepo={handleAnalyzeRepo}
          username={username}
        />
      )}
    </div>
  )
}

export default App