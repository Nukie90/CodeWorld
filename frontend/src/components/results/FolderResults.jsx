import React, { useMemo, useState } from 'react'
import InfoTip from '../common/InfoTip'
import FolderCirclePackingChart from './FolderCirclePackingChart'
import Complexity3DBarChart from './Complexity3DBarChart'

const FOLDER_METRIC_HELP = {
  'Total files': 'Number of JavaScript files analyzed within the folder.',
  'Total lines': 'Sum of physical lines across all files (including comments and blanks).',
  'Logical LOC': 'Sum of logical lines across all files; excludes comments and blanks.',
  'Total functions': 'Total count of functions across all files.',
  'Avg. complexity': 'Average cyclomatic complexity across all files and functions.',
  'Max complexity': 'Highest cyclomatic complexity among all functions across the folder.',
}

function FolderResults({ analysisResult, onBack }) {
  if (!analysisResult) return null

  const { folder_name, analysis } = analysisResult
  const { folder_metrics, individual_files } = analysis

  const [activeTab, setActiveTab] = useState('circle')

  const chartTabs = useMemo(
    () => [
      { id: 'circle', label: 'Circle packing' },
      { id: 'bars', label: '3D complexity bars' },
    ],
    []
  )

  const hasFiles = Boolean(individual_files?.length)

  const tabDescription =
    activeTab === 'circle'
      ? 'Circle packing visualization: The outer ring represents the folder. Inner circles show files sized by logical LOC and colored by average complexity.'
      : '3D bar visualization: Bar height represents logical LOC, width encodes function count, and color reflects average cyclomatic complexity.'

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
        <button type="button" className="secondary-button" onClick={onBack}>
          Analyze another folder
        </button>
      </header>

      <main className="results-content">
        <section className="results-card">
          <h2>
            Folder Summary
            <InfoTip text="Aggregated metrics computed across all analyzed files in the folder." ariaLabel="Help: Folder Summary" />
          </h2>
          <div className="metrics-grid">
            {folderSummaryItems.map((item) => (
              <div key={item.label} className="metric">
                <span className="metric-label">
                  {item.label}
                  <InfoTip text={FOLDER_METRIC_HELP[item.label]} ariaLabel={`Help: ${item.label}`} />
                </span>
                <span className="metric-value">{item.value ?? '—'}</span>
              </div>
            ))}
          </div>
        </section>

        {hasFiles && (
          <section className="results-card">
            <div className="results-card-header">
              <div className="results-card-title">
                <h2>Complexity Visualization</h2>
                <InfoTip text={tabDescription} ariaLabel="Help: Complexity Visualization" />
              </div>
              <div className="chart-tab-buttons" role="tablist" aria-label="Complexity visualizations">
                {chartTabs.map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    role="tab"
                    aria-selected={activeTab === tab.id}
                    className={`chart-tab-button ${activeTab === tab.id ? 'active' : ''}`}
                    onClick={() => setActiveTab(tab.id)}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="chart-tab-panel" role="tabpanel">
              {activeTab === 'circle' ? (
                <FolderCirclePackingChart folderName={folder_name} files={individual_files} />
              ) : (
                <Complexity3DBarChart files={individual_files} />
              )}
            </div>
          </section>
        )}

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