import React from 'react'
import InfoTip from '../common/InfoTip'

const METRIC_HELP = {
  'Total lines': 'Total physical lines in the file (including comments and blanks).',
  'Logical LOC': 'Executable or logical lines of code; excludes comments and blank lines.',
  'Functions': 'Number of function declarations/expressions detected in the file.',
  'Avg. complexity': 'Average cyclomatic complexity across all functions.',
  'Max complexity': 'Highest cyclomatic complexity among all functions.',
  'Language': 'Language detected by the analyzer for this file.',
}

function SingleFileResults({ analysisResult, onBack }) {
  if (!analysisResult) return null

  const { filename, analysis } = analysisResult
  const summaryItems = [
    { label: 'Total lines', value: analysis?.total_loc },
    { label: 'Logical LOC', value: analysis?.total_lloc },
    { label: 'Functions', value: analysis?.function_count },
    { label: 'Total complexity', value: analysis?.total_complexity },
    { label: 'Max complexity', value: analysis?.complexity_max },
    { label: 'Language', value: analysis?.language },
  ]

  const functions = (analysis?.functions || []).map((fn) => ({
    name: fn.name,
    startLine: fn.start_line,
    lloc: fn.lloc,
    complexity: fn.cyclomatic_complexity,
  }))

  return (
    <div className="results-page">
      <header className="results-header">
        <h1>Analysis results</h1>
        {/* <p>
          Metrics for <span className="results-filename">{analysis?.filename || filename}</span>
        </p> */}
        <button type="button" className="secondary-button" onClick={onBack}>
          Analyze another Folder / Repo
        </button>
      </header>

      <main className="results-content">
        <section className="results-card">
          <h2>File summary</h2>
          <div className="metrics-grid">
            {summaryItems.map((item) => (
              <div key={item.label} className="metric">
                <span className="metric-label">
                  {item.label}
                  <InfoTip text={METRIC_HELP[item.label]} ariaLabel={`Help: ${item.label}`} />
                </span>
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
                      <td>{fn.lloc}</td>
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

export default SingleFileResults 