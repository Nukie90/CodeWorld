import { useEffect, useState } from 'react'
import axios from 'axios'
import './App.css'

const formatFileSize = (bytes) => {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return '0 B'
  }

  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const exponent = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    units.length - 1,
  )
  const size = bytes / 1024 ** exponent

  return `${size.toFixed(size >= 10 || exponent === 0 ? 0 : 1)} ${units[exponent]}`
}

function App() {
  const [selectedFile, setSelectedFile] = useState(null)
  const [previewUrl, setPreviewUrl] = useState(null)
  const [status, setStatus] = useState('idle')
  const [statusMessage, setStatusMessage] = useState('')
  const [progress, setProgress] = useState(0)
  const [analysisResult, setAnalysisResult] = useState(null)
  const [view, setView] = useState('upload')

  const handleFileSelection = (file) => {
    if (!file) {
      return
    }

    setSelectedFile(file)
    setStatus('ready')
    setStatusMessage('')
    setProgress(0)
  }

  const handleFileInput = (event) => {
    const file = event.target.files?.[0] //?. = optinal chaining; make it 2
    handleFileSelection(file)
  }

  const handleDrop = (event) => {
    event.preventDefault()
    const file = event.dataTransfer.files?.[0]
    handleFileSelection(file)
  }

  const handleDragOver = (event) => {
    event.preventDefault()
    event.dataTransfer.dropEffect = 'copy'
  }

  const handleUpload = async (event) => {
    event.preventDefault()
    if (!selectedFile || status === 'uploading') {
      return
    }

    const formData = new FormData()
    console.log(selectedFile)
    formData.append('file', selectedFile)

    setStatus('uploading')
    setStatusMessage('Uploading your file...')
    setProgress(0)

    try {
      const response = await axios.post(
        'http://127.0.0.1:8000/api/uploadfile',
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
          onUploadProgress: (event) => {
            if (event.total) {
              const percent = Math.round((event.loaded / event.total) * 100)
              setProgress(percent)
            } else {
              setProgress((previous) => (previous >= 95 ? previous : previous + 5))
            }
          },
        },
      )

      setProgress(100)
      const payload = response?.data || null
      setStatus('success')
      setStatusMessage('Upload complete!')
      setAnalysisResult(payload)
      if (payload) {
        setView('results')
      }
    } catch (error) {
      setStatus('error')
      setStatusMessage(
        error?.response?.data?.detail ||
          error?.message ||
          'Upload failed. Please try again.',
      )
    }
  }

  const handleRemoveFile = () => {
    setSelectedFile(null)
    setPreviewUrl(null)
    setStatus('idle')
    setProgress(0)
    setStatusMessage('')
    setAnalysisResult(null)
    setView('upload')
  }

  const handleReturnToUpload = () => {
    handleRemoveFile()
  }

  useEffect(() => {
    if (!selectedFile || !selectedFile.type.startsWith('image/')) {
      setPreviewUrl(null)
      return
    }

    const url = URL.createObjectURL(selectedFile)
    setPreviewUrl(url)

    return () => URL.revokeObjectURL(url)
  }, [selectedFile])

  const renderUploadView = () => (
    <div className="upload-page">
      <header className="upload-header">
        <h1>Upload a file</h1>
        <p>Choose a file from your device or drag it into the drop area below.</p>
      </header>

      <main>
        <form className="upload-card" onSubmit={handleUpload}>
          <label
            htmlFor="file-input"
            className={`drop-zone${selectedFile ? ' has-file' : ''}`}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
          >
            <input
              id="file-input"
              className="file-input"
              type="file"
              onChange={handleFileInput}
            />

            {selectedFile ? (
              <div className="file-preview">
                {previewUrl ? (
                  <img
                    src={previewUrl}
                    alt={`Preview of ${selectedFile.name}`}
                    className="image-preview"
                  />
                ) : (
                  <div className="file-icon" aria-hidden="true">
                    <span>FILE</span>
                  </div>
                )}

                <div className="file-details">
                  <span className="file-name">{selectedFile.name}</span>
                  <span className="file-size">{formatFileSize(selectedFile.size)}</span>
                </div>

                <button type="button" className="clear-button" onClick={handleRemoveFile}>
                  Choose another file
                </button>
              </div>
            ) : (
              <div className="placeholder">
                <div className="icon" aria-hidden="true">
                  <span>UPLOAD</span>
                </div>
                <p>Drag and drop a file here, or click to browse</p>
                <span>Supports documents, images, audio, and more.</span>
              </div>
            )}
          </label>

          <button
            className="upload-button"
            type="submit"
            disabled={!selectedFile || status === 'uploading'}
          >
            {status === 'uploading' ? `Uploading... ${progress}%` : 'Upload file'}
          </button>

          {status === 'uploading' && (
            <div
              className="progress-bar"
              role="progressbar"
              aria-valuenow={progress}
              aria-valuemin="0"
              aria-valuemax="100"
            >
              <div className="progress" style={{ width: `${progress}%` }} />
            </div>
          )}

          {status === 'ready' && (
            <p className="status info">All set. Hit upload when you are ready.</p>
          )}

          {status === 'success' && statusMessage && (
            <p className="status success">{statusMessage}</p>
          )}

          {status === 'error' && statusMessage && (
            <p className="status error">{statusMessage}</p>
          )}
        </form>
      </main>
    </div>
  )

  const renderResultsView = () => {
    if (!analysisResult) {
      return null
    }

    const { filename, analysis } = analysisResult
    const summaryItems = [
      { label: 'Total lines', value: analysis?.total_loc },
      { label: 'Logical LOC', value: analysis?.total_nloc },
      { label: 'Functions', value: analysis?.function_count },
      { label: 'Avg. complexity', value: analysis?.complexity_avg },
      { label: 'Max complexity', value: analysis?.complexity_max },
      { label: 'Language', value: analysis?.language },
    ]

    const functions = (analysis?.functions || []).map((fn) => ({
      name: fn.name,
      startLine: fn.start_line,
      nloc: fn.nloc,
      complexity: fn.cyclomatic_complexity,
    }))

    return (
      <div className="results-page">
        <header className="results-header">
          <h1>Analysis results</h1>
          <p>
            Metrics for <span className="results-filename">{analysis?.filename || filename}</span>
          </p>
          <button type="button" className="secondary-button" onClick={handleReturnToUpload}>
            Upload another file
          </button>
        </header>

        <main className="results-content">
          <section className="results-card">
            <h2>File summary</h2>
            <div className="metrics-grid">
              {summaryItems.map((item) => (
                <div key={item.label} className="metric">
                  <span className="metric-label">{item.label}</span>
                  <span className="metric-value">{item.value ?? '—'}</span>
                </div>
              ))}
            </div>
          </section>

          <section className="results-card">
            <h2>Function breakdown</h2>
            {functions.length ? (
              <div className="function-table-wrapper">
                <table className="function-table">
                  <thead>
                    <tr>
                      <th scope="col">Function</th>
                      <th scope="col">Start line</th>
                      <th scope="col">Logical LOC</th>
                      <th scope="col">Cyclomatic complexity</th>
                    </tr>
                  </thead>
                  <tbody>
                    {functions.map((fn) => (
                      <tr key={`${fn.name}-${fn.startLine}`}>
                        <td>{fn.name}</td>
                        <td>{fn.startLine}</td>
                        <td>{fn.nloc}</td>
                        <td>{fn.complexity}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="empty-state">No functions detected in this file.</p>
            )}
          </section>
        </main>
      </div>
    )
  }

  return view === 'results' ? renderResultsView() : renderUploadView()
}

export default App
