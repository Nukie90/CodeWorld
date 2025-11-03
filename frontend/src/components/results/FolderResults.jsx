import React, { useRef, useEffect, useState } from "react";
import axios from 'axios'
import * as d3 from "d3";
import InfoTip from "../common/InfoTip";
import ComplexityBarChart from "./ComplexityBarChart";
import "./result.css";

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

function FolderResults({ analysisResult, onBack, token, setAnalysisResult }) {
  // Hooks must be called unconditionally at top of the component

  const chartRef = useRef(null);
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

    const folder_name_local = analysisResult?.folder_name
    const individual_files_local = analysisResult?.analysis?.individual_files || []

    if (!chartRef.current) {
      d3.selectAll(".d3-tooltip").remove();
      return;
    }

    const container = d3.select(chartRef.current);
    container.html("");

    if (!individual_files_local?.length || activeTab !== "circle") {
      d3.selectAll(".d3-tooltip").remove();
      return;
    }

    const width = 800;
    const height = 600;
    const margin = 20;

    const svg = container
      .append("svg")
      .attr("width", width)
      .attr("height", height);

    const tooltip = d3
      .select("body")
      .append("div")
      .attr("class", "d3-tooltip")
      .style("position", "absolute")
      .style("opacity", 0)
      .style("background", "white")
      .style("border", "1px solid black")
      .style("padding", "10px")
      .style("border-radius", "5px")
      .style("pointer-events", "none")
      .style("max-width", "300px")
      .style("box-shadow", "0 2px 10px rgba(0,0,0,0.1)");

    const complexities = individual_files_local
      .map((f) => f.complexity_avg)
      .filter(Boolean);
    const minComplexity =
      complexities.length > 0 ? Math.min(...complexities) : 1;
    const maxComplexity =
      complexities.length > 0 ? Math.max(...complexities) : 10;

    const colorScale = d3
      .scaleLinear()
      .domain([minComplexity, maxComplexity])
      .range(["green", "red"]);

    const data = {
      name: folder_name_local,
      children: individual_files_local.map((file) => ({
        name: file.filename.split("/").pop(),
        total_nloc: file.total_nloc || 0,
        complexity_avg: file.complexity_avg || 0,
        complexity_max: file.complexity_max || 0,
        function_count: file.function_count || 0,
        functions: file.functions || [],
      })),
    };

    const hierarchy = d3.hierarchy(data).sum((d) => d.total_nloc);

    const pack = d3
      .pack()
      .size([width - margin * 2, height - margin * 2])
      .padding(10);

    const rootNode = pack(hierarchy);

    svg
      .selectAll("circle")
      .data(rootNode.children)
      .enter()
      .append("circle")
      .attr("cx", (d) => d.x + margin)
      .attr("cy", (d) => d.y + margin)
      .attr("r", (d) => d.r)
      .attr("fill", (d) => colorScale(d.data.complexity_avg))
      .attr("stroke", "white")
      .attr("stroke-width", 1)
      .on("mouseover", function (event, d) {
        tooltip.transition().duration(200).style("opacity", 0.9);
        tooltip
          .html(generateTooltipHtml(d.data))
          .style("left", event.pageX + 10 + "px")
          .style("top", event.pageY - 28 + "px");
      })
      .on("mouseout", function () {
        tooltip.transition().duration(500).style("opacity", 0);
      });

    svg
      .append("circle")
      .attr("cx", rootNode.x + margin)
      .attr("cy", rootNode.y + margin)
      .attr("r", rootNode.r)
      .attr("fill", "none")
      .attr("stroke", "black")
      .attr("stroke-width", 2);

    function generateTooltipHtml(d) {
      let html = `
        <h4 style="margin: 0 0 10px 0;">${d.name}</h4>
        <p><strong>Logical LOC:</strong> ${d.total_nloc}</p>
        <p><strong>Functions:</strong> ${d.function_count}</p>
        <p><strong>Avg. Complexity:</strong> ${d.complexity_avg}</p>
        <p><strong>Max. Complexity:</strong> ${d.complexity_max}</p>
      `;
      if (d.functions.length > 0) {
        html += `<details style="margin-top: 10px;"><summary>Functions (${d.functions.length})</summary>`;
        d.functions.forEach((fn) => {
          html += `
            <div style="margin: 5px 0; padding: 2px; border-left: 2px solid #ccc;">
              <span style="font-weight: bold;">${fn.name}</span>
              <span style="margin-left: 10px;">nloc: ${fn.nloc}</span>
              <span style="margin-left: 10px;">CC: ${fn.cyclomatic_complexity}</span>
            </div>
          `;
        });
        html += "</details>";
      }
      return html;
    }

    return () => {
      svg.remove();
      tooltip.remove();
    };
  }, [activeTab, analysisResult, token]);

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
    { label: "Logical LOC", value: folder_metrics?.total_nloc },
    { label: "Total functions", value: folder_metrics?.total_functions },
    { label: "Avg. complexity", value: folder_metrics?.complexity_avg },
    { label: "Max complexity", value: folder_metrics?.complexity_max },
  ];

  return (
    <div className="results-page">
      <header className="results-header">
        <h1>Folder Analysis Results</h1>
        <p>
          Metrics for folder{" "}
          <span className="results-filename">{folder_name_safe}</span>
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
          Analyze another folder
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
              <button
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
              </button>
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
              {activeTab === "circle" ? (
                <div
                  ref={chartRef}
                  className="chart-container"
                  style={{ width: "800px", height: "600px", margin: "0 auto" }}
                />
              ) : (
                /* no extra wrapper needed; the panel scrolls */
                <ComplexityBarChart files={individual_files} />
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
                        Logical LOC: {file.total_nloc ?? file.total_loc ?? "—"}
                      </span>
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
                            <span className="function-sub">
                              nloc: {fn.nloc}
                            </span>
                            {/* <span className="function-sub">tc: {fn.token_count}</span> */}
                            <span className="function-sub">
                              CC: {fn.cyclomatic_complexity}
                            </span>
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
