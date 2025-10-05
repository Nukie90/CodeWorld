import React from 'react'
import { formatFileSize } from '../utils/formatFileSize'

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
}) {
  return (
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
}

export default UploadView 