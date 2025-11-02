import React from 'react'

function FolderHeader({ folderName, onBack }) {
  return (
    <header className="results-header">
      <h1>Folder Analysis Results</h1>
      <p>
        Metrics for folder <span className="results-filename">{folderName}</span>
      </p>
      <button type="button" className="secondary-button" onClick={onBack}>
        Analyze another folder
      </button>
    </header>
  )
}

export default FolderHeader
