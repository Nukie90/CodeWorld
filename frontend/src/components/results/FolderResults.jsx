import React from 'react'
import FolderHeader from './FolderHeader'
import FolderSummary from './FolderSummary'
import FolderVisualization from './FolderVisualization'

function FolderResults({ analysisResult, onBack }) {
  if (!analysisResult) return null

  const { folder_name, analysis } = analysisResult
  const { folder_metrics, individual_files } = analysis

  return (
    <div className="results-page">
      <FolderHeader folderName={folder_name} onBack={onBack} />

      <main className="results-content">
        <FolderSummary folderMetrics={folder_metrics} />

        <FolderVisualization 
          individualFiles={individual_files} 
          folderName={folder_name} 
        />

        <section className="results-card">
          <h2>Individual Files</h2>
          {individual_files?.length ? (
            <div className="files-grid">
              {individual_files.map((file, index) => (
                <div key={index} className="file-card">
                  <h3 className="file-name">{file.filename}</h3>
                  <div className="file-metrics">
                    <div className="metric-row">
                      <span>Logical LOC: {file.total_nloc ?? file.total_loc ?? '—'}</span>
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
                            <span className="function-sub">nloc: {fn.nloc}</span>
                            {/* <span className="function-sub">tc: {fn.token_count}</span> */}
                            <span className="function-sub">CC: {fn.cyclomatic_complexity}</span>
                            {/* <span className="function-sub">msd: {fn.max_nesting_depth}</span> */}
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

export default FolderResults