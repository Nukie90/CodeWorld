import React, { useEffect, useState } from "react";
import axios from 'axios'
import InfoTip from "../common/InfoTip";
import "./result.css";
import FolderVisualizationSelector from "./FolderVisualizationSelector"
import CirclePackingVisualization from "./visualizations/CirclePackingVisualization"
import TreemapVisualization from "./visualizations/TreemapVisualization"
import ForceTreeVisualization from "./visualizations/ForceTreeVisualization"
import InteractiveCircleVisualization from "./visualizations/InteractiveCircleVisualization"
import RadarChartVisualization from "./visualizations/RadarChartVisualization"

const FOLDER_METRIC_HELP = {
  "Total files": "Number of JavaScript files analyzed within the folder.",
  "Total lines":
    "Sum of physical lines across all files (including comments and blanks).",
  "Logical LOC":
    "Sum of logical lines across all files; excludes comments and blanks.",
  "Total functions": "Total count of functions across all files.",
  "Avg. complexity":
    "Average cyclomatic complexity across all files and functions.",
  "Max complexity":
    "Highest cyclomatic complexity among all functions across the folder.",
};

/* FunctionTreeItem component for recursive rendering */
function FunctionTreeItem({ fn }) {
  const hasChildren = fn.children && fn.children.length > 0;
  
  // Prefer total_cognitive_complexity if available, otherwise cognitive_complexity, otherwise cyclomatic_complexity
  const complexity = fn.total_cognitive_complexity ?? fn.cognitive_complexity ?? fn.cyclomatic_complexity ?? 0;
  // Label: Total CC if hierarchical data is present, else just CC
  const complexityLabel = fn.total_cognitive_complexity !== undefined ? "Total CC" : "CC";

  return (
    <div className="function-item-container">
      <div className="function-item">
        <span className="function-name" title={fn.long_name || fn.name}>{fn.name}</span>
        <span className="function-sub">lloc: {fn.lloc}</span>
        <span className="function-sub">{complexityLabel}: {complexity}</span>
      </div>
      {hasChildren && (
        <div className="function-children" style={{ marginLeft: '20px', borderLeft: '1px solid #444', paddingLeft: '8px' }}>
          {fn.children.map((child, index) => (
            <FunctionTreeItem key={index} fn={child} />
          ))}
        </div>
      )}
    </div>
  );
}

function FolderResults({ analysisResult, onBack, token, setAnalysisResult }) {
  // Hooks must be called unconditionally at top of the component

  const [activeTab, setActiveTab] = useState("circle");
  const [branches, setBranches] = useState([])
  const [currentBranch, setCurrentBranch] = useState("")
  const [branchLoading, setBranchLoading] = useState(false)
  const circleTabId = "visualization-tab-circle";
  const barTabId = "visualization-tab-bar";
  const panelId = "visualization-tab-panel";
  useEffect(() => {
    // fetch branches when this is a repo analysis
    async function fetchBranches() {
      if (!analysisResult?.repo_url) return
      try {
        const resp = await axios.get('http://127.0.0.1:8000/api/repo/branches', { params: { repo_url: analysisResult.repo_url, token } })
        const data = resp.data || {}
        const local = data.local || []
        const remote = data.remote || []
        const current = data.current || ''
        // merge lists: prefer local branch names, but include remotes
        const combined = [...local]
        remote.forEach(r => { if (!combined.includes(r)) combined.push(r) })
        setBranches(combined)
        setCurrentBranch(current)
      } catch (err) {
        console.error('Failed to fetch branches', err)
      }
    }
    fetchBranches()
  }, [analysisResult, token])

  const handleBranchChange = async (evt) => {
    const branch = evt.target.value
    if (!branch || !analysisResult?.repo_url) return
    setBranchLoading(true)
    try {
      const resp = await axios.post('http://127.0.0.1:8000/api/repo/checkout', { repo_url: analysisResult.repo_url, branch, token })
      // server returns a new analysis payload
      if (resp.data) {
        setAnalysisResult(resp.data)
      }
    } catch (err) {
      console.error('Checkout failed', err)
      // keep UI responsive
    } finally {
      setBranchLoading(false)
    }
  }

  // safe accessors for analysis data
  const folder_name_safe = analysisResult?.folder_name || ''
  const folder_metrics = analysisResult?.analysis?.folder_metrics || {}
  const individual_files = analysisResult?.analysis?.individual_files || []

  const folderSummaryItems = [
    { label: "Total files", value: folder_metrics?.total_files },
    { label: "Total lines", value: folder_metrics?.total_loc },
    { label: "Logical LOC", value: folder_metrics?.total_lloc },
    { label: "Total functions", value: folder_metrics?.total_functions },
    { label: "Total complexity", value: folder_metrics?.total_complexity },
    { label: "Max complexity", value: folder_metrics?.complexity_max },
  ];

  return (
    <div className="results-page">
      <header className="results-header">
        <h1>Analysis Results</h1>
        <p>
          {/* Metrics for folder{" "} */}
          {/* <span className="results-filename">{folder_name_safe}</span> */}
          {analysisResult?.repo_url && (
            <span style={{ marginLeft: 16 }}>
              <label style={{ marginRight: 8, fontSize: 12 }}>Branch</label>
              <select value={currentBranch} onChange={handleBranchChange} disabled={branchLoading || branches.length === 0}>
                <option value="">Select branch</option>
                {branches.map((b) => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>
            </span>
          )}
        </p>
        <button type="button" className="secondary-button" onClick={onBack}>
          Analyze another Folder / Repo
        </button>
      </header>

      <main className="results-content">
        <section className="results-card">
          <h2>
            Folder Summary
            <InfoTip
              text="Aggregated metrics computed across all analyzed files in the folder."
              ariaLabel="Help: Folder Summary"
            />
          </h2>
          <div className="metrics-grid">
            {folderSummaryItems.map((item) => (
              <div key={item.label} className="metric">
                <span className="metric-label">
                  {item.label}
                  <InfoTip
                    text={FOLDER_METRIC_HELP[item.label]}
                    ariaLabel={`Help: ${item.label}`}
                  />
                </span>
                <span className="metric-value">{item.value ?? "—"}</span>
              </div>
            ))}
          </div>
        </section>

        {individual_files?.length > 0 && (
          <section className="results-card">
            <div className="results-card-header">
              <h2>Complexity Visualization</h2>
              <InfoTip
                text="Compare folder complexity with circle packing or bar chart views. Circle packing uses circle size for LOC and color for complexity; the bar chart uses height for LOC, width for function count, and color for average complexity."
                ariaLabel="Help: Complexity Visualization"
              />
            </div>

            <div
              className="visualization-tabs"
              role="tablist"
              aria-label="Complexity visualizations"
            >
              <FolderVisualizationSelector currentType={activeTab} onTypeChange={(t) => setActiveTab(t)} />
              {/* <button
                type="button"
                role="tab"
                aria-selected={activeTab === "circle"}
                id={circleTabId}
                aria-controls={panelId}
                tabIndex={activeTab === "circle" ? 0 : -1}
                className={`visualization-tab-button ${
                  activeTab === "circle" ? "active" : ""
                }`}
                onClick={() => setActiveTab("circle")}
              >
                Circle Packing
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === "bar"}
                id={barTabId}
                aria-controls={panelId}
                tabIndex={activeTab === "bar" ? 0 : -1}
                className={`visualization-tab-button ${
                  activeTab === "bar" ? "active" : ""
                }`}
                onClick={() => setActiveTab("bar")}
              >
                Complexity Bars
              </button> */}
            </div>

            <div
              className="visualization-tab-panel"
              role="tabpanel"
              id={panelId}
              aria-labelledby={activeTab === "circle" ? circleTabId : barTabId}
              style={{
                /* force the panel to be the scroller */
                overflowX: activeTab === "bar" ? "auto" : "hidden",
                overflowY: "hidden",
                width: "100%",
                minWidth: 0, // fixes flexbox overflow traps
                WebkitOverflowScrolling: "touch",
                paddingBottom: 8,
              }}
            >
              {activeTab === "circle" && (
                <CirclePackingVisualization individualFiles={individual_files} folderName={folder_name_safe} />
              )}
              {activeTab === "treemap" && (
                <TreemapVisualization individualFiles={individual_files} folderName={folder_name_safe} />
              )}
              {activeTab === "tree" && (
                <ForceTreeVisualization individualFiles={individual_files} folderName={folder_name_safe} />
              )}
              {/* {activeTab === "interactive" && (
                <InteractiveCircleVisualization individualFiles={individual_files} folderName={folder_name_safe} />
              )} */}
              {activeTab === "radar" && (
                <RadarChartVisualization individualFiles={individual_files} />
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
                      <span>
                        Logical LOC: {file.total_lloc ?? file.total_loc ?? "—"}
                      </span>
                      <span>Functions: {file.function_count}</span>
                    </div>
                    <div className="metric-row">
                      <span>Total Complexity: {file.total_complexity}</span>
                      <span>Max Complexity: {file.complexity_max}</span>
                    </div>
                  </div>

                  {file.functions?.length > 0 && (
                    <details className="function-details">
                      <summary>Functions ({file.function_count})</summary>
                      <div className="function-list">
                        {file.functions.map((fn, fnIndex) => (
                           <FunctionTreeItem key={fnIndex} fn={fn} />
                        ))}
                      </div>
                    </details>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="empty-state">
              No JavaScript files found in this folder.
            </p>
          )}
        </section>
      </main>
    </div>
  );
}

export default FolderResults;
