import { useEffect, useState } from 'react'
import axios from 'axios'
import JSZip from 'jszip'
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
  const [selectedFolder, setSelectedFolder] = useState(null)
  const [uploadType, setUploadType] = useState('folder') // 'file' or 'folder'
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
      // Create a zip file from the selected files
      const zip = new JSZip()

      // Group files by their relative paths
      const folderName = files[0].webkitRelativePath.split('/')[0]
      
      files.forEach(file => {
        const relativePath = file.webkitRelativePath.substring(folderName.length + 1)
        if (relativePath && (file.name.endsWith('.js') || file.name.endsWith('.jsx'))) {
          zip.file(relativePath, file)
        }
      })

      // Generate zip blob
      const zipBlob = await zip.generateAsync({ type: 'blob' })
      
      // Create a file object that looks like a regular file upload
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
    
    if (uploadType === 'folder') {
      // For folder drops, we'll handle it through the webkitdirectory input
      return
    }
    
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
    
    if (!fileToUpload || status === 'uploading') {
      return
    }

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
      setStatusMessage('Analysis complete!')
      setAnalysisResult(payload)
      if (payload) {
        setView('results')
      }
    } catch (error) {
      setStatus('error')
      setStatusMessage(
        error?.response?.data?.detail ||
          error?.message ||
          'Analysis failed. Please try again.',
      )
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

  const handleReturnToUpload = () => {
    handleRemoveFile()
  }

  const getSelectedFileName = () => {
    if (uploadType === 'folder' && selectedFolder) {
      return selectedFolder.name
    }
    if (uploadType === 'file' && selectedFile) {
      return selectedFile.name
    }
    return null
  }

  const getSelectedFileSize = () => {
    if (uploadType === 'folder' && selectedFolder) {
      return selectedFolder.size
    }
    if (uploadType === 'file' && selectedFile) {
      return selectedFile.size
    }
    return 0
  }

  useEffect(() => {
    const file = uploadType === 'file' ? selectedFile : null
    if (!file || !file.type.startsWith('image/')) {
      setPreviewUrl(null)
      return
    }

    const url = URL.createObjectURL(file)
    setPreviewUrl(url)

    return () => URL.revokeObjectURL(url)
  }, [selectedFile, uploadType])

  const renderUploadView = () => (
    <div className="upload-page">
      <header className="upload-header">
        <h1>Code Analysis Tool</h1>
        <p>Upload JavaScript files or folders for complexity analysis.</p>
        
        <div className="upload-type-selector">
          <button 
            type="button"
            className={`type-button ${uploadType === 'folder' ? 'active' : ''}`}
            onClick={() => {
              setUploadType('folder')
              handleRemoveFile()
            }}
          >
            Upload Folder
          </button>
          <button 
            type="button"
            className={`type-button ${uploadType === 'file' ? 'active' : ''}`}
            onClick={() => {
              setUploadType('file')
              handleRemoveFile()
            }}
          >
            Upload Single File
          </button>
        </div>
      </header>

      <main>
        <form className="upload-card" onSubmit={handleUpload}>
          <label
            htmlFor={uploadType === 'folder' ? 'folder-input' : 'file-input'}
            className={`drop-zone${(selectedFile || selectedFolder) ? ' has-file' : ''}`}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
          >
            {uploadType === 'folder' ? (
              <input
                id="folder-input"
                className="file-input"
                type="file"
                webkitdirectory=""
                directory=""
                multiple
                onChange={handleFolderInput}
              />
            ) : (
              <input
                id="file-input"
                className="file-input"
                type="file"
                accept=".js,.jsx"
                onChange={handleFileInput}
              />
            )}

            {(selectedFile || selectedFolder) ? (
              <div className="file-preview">
                {previewUrl ? (
                  <img
                    src={previewUrl}
                    alt={`Preview of ${getSelectedFileName()}`}
                    className="image-preview"
                  />
                ) : (
                  <div className="file-icon" aria-hidden="true">
                    <span>{uploadType === 'folder' ? 'FOLDER' : 'FILE'}</span>
                  </div>
                )}

                <div className="file-details">
                  <span className="file-name">{getSelectedFileName()}</span>
                  <span className="file-size">{formatFileSize(getSelectedFileSize())}</span>
                </div>

                <button type="button" className="clear-button" onClick={handleRemoveFile}>
                  Choose another {uploadType}
                </button>
              </div>
            ) : (
              <div className="placeholder">
                <div className="icon" aria-hidden="true">
                  <span>{uploadType === 'folder' ? 'FOLDER' : 'UPLOAD'}</span>
                </div>
                <p>
                  {uploadType === 'folder' 
                    ? 'Click to select a folder containing JavaScript files'
                    : 'Drag and drop a JavaScript file here, or click to browse'
                  }
                </p>
                <span>
                  {uploadType === 'folder' 
                    ? 'Supports folders with .js and .jsx files'
                    : 'Supports .js and .jsx files'
                  }
                </span>
              </div>
            )}
          </label>

          <button
            className="upload-button"
            type="submit"
            disabled={!(selectedFile || selectedFolder) || status === 'uploading'}
          >
            {status === 'uploading' 
              ? `Analyzing... ${progress}%` 
              : `Analyze ${uploadType}`
            }
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
            <p className="status info">All set. Hit analyze when you are ready.</p>
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

    // Handle both single file and folder analysis results
    const isFolder = analysisResult.analysis?.folder_metrics !== undefined
    
    if (isFolder) {
      return renderFolderResults()
    } else {
      return renderSingleFileResults()
    }
  }

  const renderSingleFileResults = () => {
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
            Analyze another file
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

  const renderFolderResults = () => {
    const { folder_name, analysis } = analysisResult
    const { folder_metrics, individual_files } = analysis

    const folderSummaryItems = [
      { label: 'Total files', value: folder_metrics?.total_files },
      { label: 'Total lines', value: folder_metrics?.total_loc },
      { label: 'Logical LOC', value: folder_metrics?.total_nloc },
      { label: 'Total functions', value: folder_metrics?.total_functions },
      { label: 'Avg. complexity', value: folder_metrics?.complexity_avg },
      { label: 'Max complexity', value: folder_metrics?.complexity_max },
    ]

    return (
      <div className="results-page">
        <header className="results-header">
          <h1>Folder Analysis Results</h1>
          <p>
            Metrics for folder <span className="results-filename">{folder_name}</span>
          </p>
          <button type="button" className="secondary-button" onClick={handleReturnToUpload}>
            Analyze another folder
          </button>
        </header>

        <main className="results-content">
          <section className="results-card">
            <h2>Folder Summary</h2>
            <div className="metrics-grid">
              {folderSummaryItems.map((item) => (
                <div key={item.label} className="metric">
                  <span className="metric-label">{item.label}</span>
                  <span className="metric-value">{item.value ?? '—'}</span>
                </div>
              ))}
            </div>
          </section>

          <section className="results-card">
            <h2>Individual Files</h2>
            {individual_files?.length ? (
              <div className="files-grid">
                {individual_files.map((file, index) => (
                  <div key={index} className="file-card">
                    <h3 className="file-name">{file.filename}</h3>
                    <div className="file-metrics">
                      <div className="metric-row">
                        <span>Lines: {file.total_loc}</span>
                        <span>Functions: {file.function_count}</span>
                      </div>
                      <div className="metric-row">
                        <span>Avg Complexity: {file.complexity_avg}</span>
                        <span>Max Complexity: {file.complexity_max}</span>
                      </div>
                    </div>
                    
                    {file.functions?.length > 0 && (
                      <details className="function-details">
                        <summary>Functions ({file.functions.length})</summary>
                        <div className="function-list">
                          {file.functions.map((fn, fnIndex) => (
                            <div key={fnIndex} className="function-item">
                              <span className="function-name">{fn.name}</span>
                              <span className="function-complexity">CC: {fn.cyclomatic_complexity}</span>
                            </div>
                          ))}
                        </div>
                      </details>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="empty-state">No JavaScript files found in this folder.</p>
            )}
          </section>
        </main>
      </div>
    )
  }

  return view === 'results' ? renderResultsView() : renderUploadView()
}

export default App
