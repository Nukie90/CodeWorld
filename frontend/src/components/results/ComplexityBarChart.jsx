import React, { useMemo } from 'react'

const CHART_HEIGHT = 400
const LABEL_AREA = 80
const WIDTH_UNIT = 20
const BAR_GAP = 24

function getBarColor(complexity = 0) {
  if (complexity < 5) return '#2ecc71'
  if (complexity <= 10) return '#f1c40f'
  return '#e74c3c'
}

function ComplexityBarChart({ files = [] }) {
  const prepared = useMemo(() => {
    const maxNloc = Math.max(...files.map(file => file.total_nloc || file.total_loc || 0), 1)

    let currentX = BAR_GAP

    const bars = files.map(file => {
      const nloc = file.total_nloc || file.total_loc || 0
      const functionCount = file.function_count || 0
      const complexity = file.complexity_avg ?? file.complexity_max ?? 0

      const scaledHeight = (nloc / maxNloc) * CHART_HEIGHT
      const rawWidth = 2 * (1 + functionCount)
      const scaledWidth = Math.max(rawWidth * WIDTH_UNIT, WIDTH_UNIT) // ensure visible even when 0 functions

      const bar = {
        x: currentX,
        width: scaledWidth,
        height: scaledHeight,
        label: file.filename,
        nloc,
        functionCount,
        complexity
      }

      currentX += scaledWidth + BAR_GAP
      return bar
    })

    const svgWidth = Math.max(currentX, 600)

    return { bars, svgWidth, maxNloc }
  }, [files])

  if (!files.length) {
    return <p className="empty-state">No data available for the bar chart.</p>
  }

  return (
    <svg
      role="img"
      aria-label="Bar chart comparing file complexity and size"
      width={prepared.svgWidth}
      height={CHART_HEIGHT + LABEL_AREA}
      className="complexity-bar-chart"
    >
      {prepared.bars.map((bar, index) => (
        <g key={bar.label || index} transform={`translate(${bar.x}, ${CHART_HEIGHT - bar.height})`}>
          <rect
            width={bar.width}
            height={bar.height}
            fill={getBarColor(bar.complexity)}
            rx={6}
            ry={6}
          >
            <title>
              {`${bar.label}\nLogical LOC: ${bar.nloc}\nFunctions: ${bar.functionCount}\nAvg CC: ${bar.complexity}`}
            </title>
          </rect>
          <text
            x={bar.width / 2}
            y={bar.height + 18}
            textAnchor="start"
            dominantBaseline="hanging"
            transform={`rotate(45 ${bar.width / 2} ${bar.height + 18})`}
            className="bar-label"
          >
            {bar.label.split('/').pop()}
          </text>
        </g>
      ))}
      <line
        x1={0}
        x2={prepared.svgWidth}
        y1={CHART_HEIGHT}
        y2={CHART_HEIGHT}
        stroke="#ccc"
      />
    </svg>
  )
}

export default ComplexityBarChart
