import React from 'react'
import { formatFileSize } from '../utils/formatFileSize'
import './UploadView.css'

function UploadView({
  uploadType,
  setUploadType,
  selectedFile,
  selectedFolder,
  previewUrl,
  status,
  statusMessage,
  progress,
  handleFileInput,
  handleFolderInput,
  handleDragOver,
  handleDrop,
  handleUpload,
  handleRemoveFile,
  getSelectedFileName,
  getSelectedFileSize,
  // github props
  repoUrl,
  setRepoUrl,
  handleGithubLogin,
  handleGithubLogout,
  handleAnalyzeRepo,
}) {
  return (
    <div className="upload-page">
      {uploadType === 'github' && (
        <div className="github-login-button">
          <button type="button" className="login-button" onClick={handleGithubLogin}>
            <svg height="16" width="16" viewBox="0 0 16 16" fill="currentColor">
              <path d="M8 0c4.42 0 8 3.58 8 8a8.013 8.013 0 0 1-5.45 7.59c-.4.08-.55-.17-.55-.38 0-.27.01-1.13.01-2.2 0-.75-.25-1.23-.54-1.48 1.78-.2 3.65-.88 3.65-3.95 0-.88-.31-1.59-.82-2.15.08-.2.36-1.02-.08-2.12 0 0-.67-.22-2.2.82-.64-.18-1.32-.27-2-.27-.68 0-1.36.09-2 .27-1.53-1.03-2.2-.82-2.2-.82-.44 1.1-.16 1.92-.08 2.12-.51.56-.82 1.28-.82 2.15 0 3.06 1.86 3.75 3.64 3.95-.23.2-.44.55-.51 1.07-.46.21-1.61.55-2.33-.66-.15-.24-.6-.83-1.23-.82-.67.01-.27.38.01.53.34.19.73.9.82 1.13.16.45.68 1.31 2.69.94 0 .67.01 1.3.01 1.49 0 .21-.15.45-.55.38A7.995 7.995 0 0 1 0 8c0-4.42 3.58-8 8-8Z"></path>
            </svg>
            Login with GitHub
          </button>
        </div>
      )}
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
            className={`type-button ${uploadType === 'github' ? 'active' : ''}`}
            onClick={() => {
              setUploadType('github')
              handleRemoveFile()
            }}
          >
            GitHub Repo
          </button>
        </div>
      </header>

      <main>
        <form className="upload-card" onSubmit={handleUpload}>
          {uploadType !== 'github' && (
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
                  // accept=".js,.jsx"
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
                      // ? 'Click to select a folder containing JavaScript files'
                      // : 'Drag and drop a JavaScript file here, or click to browse'
                    }
                  </p>
                  <span>
                    {uploadType === 'folder' 
                      // ? 'Supports folders with .js and .jsx files'
                      // : 'Supports .js and .jsx files'
                    }
                  </span>
                </div>
              )}
            </label>
          )}

          {uploadType !== 'github' ? (
            <button
              className="upload-button"
              type="submit"
              disabled={!(selectedFile || selectedFolder) || status === 'uploading'}
            >
              {status === 'uploading'
                ? `Analyzing... ${progress}%`
                : `Analyze ${uploadType}`}
            </button>
          ) : (
            <div className="github-actions">
              <div className="github-inputs">
                <input
                  type="text"
                  placeholder="https://github.com/owner/repo or git@github.com:owner/repo.git"
                  value={repoUrl}
                  onChange={(e) => setRepoUrl(e.target.value)}
                  className="repo-input"
                />
                <button
                  className="upload-button"
                  type="button"
                  onClick={handleAnalyzeRepo}
                  disabled={!repoUrl || status === 'uploading'}
                >
                  {status === 'uploading' ? `Analyzing... ${progress}%` : 'Analyze Repo'}
                </button>
              </div>
            </div>
          )}

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
}

export default UploadView 