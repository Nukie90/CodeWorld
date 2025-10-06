import React, { useMemo } from 'react'
import * as d3 from 'd3'

const Complexity3DBarChart = ({ files = [] }) => {
  const processed = useMemo(() => {
    return files
      .filter((file) => file)
      .map((file) => ({
        id: file.filename,
        label: file.filename?.split('/')?.pop() || file.filename || 'Unknown',
        nloc: file.total_nloc ?? file.total_loc ?? 0,
        functions: file.function_count ?? 0,
        complexity: file.complexity_avg ?? 0,
      }))
      .filter((item) => item.nloc > 0 || item.functions > 0)
  }, [files])

  if (!processed.length) {
    return <p className="empty-state">No file data available for visualization.</p>
  }

  const margin = { top: 40, right: 80, bottom: 120, left: 80 }
  const chartHeight = 360
  const frontWidth = 54
  const gap = 46
  const depthScale = 6

  const maxNloc = Math.max(...processed.map((item) => item.nloc), 1)
  const heights = processed.map((item) => (item.nloc / maxNloc) * chartHeight)
  const depthValues = processed.map((item) => Math.max(16, (2 * (1 + item.functions)) * depthScale))
  const maxDepth = Math.max(...depthValues, 32)

  const svgWidth = margin.left + margin.right + processed.length * (frontWidth + gap) + maxDepth
  const svgHeight = margin.top + margin.bottom + chartHeight + 20

  const getColor = (complexity) => {
    if (complexity < 5) return '#22c55e'
    if (complexity < 10) return '#eab308'
    return '#ef4444'
  }

  const adjustColor = (hex, amount) => {
    const base = d3.color(hex)
    if (!base) return hex
    const hsl = base.hsl()
    hsl.l = Math.max(0, Math.min(1, hsl.l + amount))
    return hsl.formatHex()
  }

  const yTicks = 4
  const tickValues = Array.from({ length: yTicks + 1 }, (_, index) => (maxNloc / yTicks) * index)

  return (
    <div className="three-d-bar-wrapper">
      <svg
        role="img"
        aria-label="3D bar chart showing file complexity and size"
        viewBox={`0 0 ${svgWidth} ${svgHeight}`}
        width="100%"
        height="100%"
      >
        <defs>
          <linearGradient id="chart-grid" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#e2e8f0" stopOpacity="0.6" />
            <stop offset="100%" stopColor="#e2e8f0" stopOpacity="0" />
          </linearGradient>
        </defs>

        <g>
          {tickValues.map((tick, index) => {
            const y = margin.top + chartHeight - (tick / maxNloc) * chartHeight
            return (
              <g key={`tick-${index}`}>
                <line
                  x1={margin.left - 8}
                  x2={svgWidth - margin.right + maxDepth}
                  y1={y}
                  y2={y}
                  stroke="url(#chart-grid)"
                  strokeWidth={1}
                />
                <text x={margin.left - 16} y={y + 4} textAnchor="end" className="axis-label">
                  {Math.round(tick)}
                </text>
              </g>
            )
          })}
        </g>

        <text
          x={margin.left - 50}
          y={margin.top - 16}
          className="axis-title"
          transform={`rotate(-90 ${margin.left - 50} ${margin.top - 16})`}
        >
          Logical LOC
        </text>

        <g>
          {processed.map((item, index) => {
            const height = heights[index]
            const depth = depthValues[index]
            const x = margin.left + index * (frontWidth + gap)
            const y = margin.top + (chartHeight - height)
            const depthYOffset = depth * 0.45
            const frontColor = getColor(item.complexity)
            const topColor = adjustColor(frontColor, 0.18)
            const sideColor = adjustColor(frontColor, -0.1)
            const complexityLabel =
              typeof item.complexity === 'number'
                ? item.complexity.toFixed(2)
                : item.complexity

            return (
              <g key={item.id || index} className="three-d-bar">
                <polygon
                  points={`
                    ${x},${y}
                    ${x + depth},${y - depthYOffset}
                    ${x + depth + frontWidth},${y - depthYOffset}
                    ${x + frontWidth},${y}
                  `}
                  fill={topColor}
                />
                <polygon
                  points={`
                    ${x + frontWidth},${y}
                    ${x + frontWidth + depth},${y - depthYOffset}
                    ${x + frontWidth + depth},${y + height - depthYOffset}
                    ${x + frontWidth},${y + height}
                  `}
                  fill={sideColor}
                />
                <rect
                  x={x}
                  y={y}
                  width={frontWidth}
                  height={height}
                  fill={frontColor}
                  rx={6}
                />
                <text
                  x={x + frontWidth / 2}
                  y={margin.top + chartHeight + 24}
                  textAnchor="middle"
                  className="bar-label"
                >
                  {item.label}
                </text>
                <text x={x + frontWidth / 2} y={y - depthYOffset - 8} textAnchor="middle" className="bar-value">
                  {item.nloc} nloc
                </text>
                <title>
                  {`${item.label}\nLogical LOC: ${item.nloc}\nFunctions: ${item.functions}\nAvg CC: ${complexityLabel}`}
                </title>
              </g>
            )
          })}
        </g>

        <g className="chart-legend" transform={`translate(${svgWidth - margin.right - 160}, ${margin.top})`}>
          <rect width="12" height="12" fill="#22c55e" rx="2" />
          <text x="18" y="11" className="legend-label">
            CC &lt; 5
          </text>
          <rect x="0" y="22" width="12" height="12" fill="#eab308" rx="2" />
          <text x="18" y="33" className="legend-label">
            5 ≤ CC &lt; 10
          </text>
          <rect x="0" y="44" width="12" height="12" fill="#ef4444" rx="2" />
          <text x="18" y="55" className="legend-label">
            CC ≥ 10
          </text>
        </g>
      </svg>
    </div>
  )
}

export default Complexity3DBarChart
