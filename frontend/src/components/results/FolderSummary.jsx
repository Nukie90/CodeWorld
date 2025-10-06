import React from 'react'
import InfoTip from '../common/InfoTip'

const FOLDER_METRIC_HELP = {
  'Total files': 'Number of JavaScript files analyzed within the folder.',
  'Total lines': 'Sum of physical lines across all files (including comments and blanks).',
  'Logical LOC': 'Sum of logical lines across all files; excludes comments and blanks.',
  'Total functions': 'Total count of functions across all files.',
  'Avg. complexity': 'Average cyclomatic complexity across all files and functions.',
  'Max complexity': 'Highest cyclomatic complexity among all functions across the folder.',
}

function FolderSummary({ folderMetrics }) {
  const folderSummaryItems = [
    { label: 'Total files', value: folderMetrics?.total_files },
    { label: 'Total lines', value: folderMetrics?.total_loc },
    { label: 'Logical LOC', value: folderMetrics?.total_nloc },
    { label: 'Total functions', value: folderMetrics?.total_functions },
    { label: 'Avg. complexity', value: folderMetrics?.complexity_avg },
    { label: 'Max complexity', value: folderMetrics?.complexity_max },
  ]

  return (
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
  )
}

export default FolderSummary
