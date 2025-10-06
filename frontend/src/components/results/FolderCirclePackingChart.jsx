import React, { useEffect, useRef } from 'react'
import * as d3 from 'd3'

const FolderCirclePackingChart = ({ folderName, files }) => {
  const chartRef = useRef(null)

  useEffect(() => {
    if (!files?.length) return

    const width = 800
    const height = 600
    const margin = 20

    const container = d3.select(chartRef.current)
    container.selectAll('*').remove()

    const svg = container
      .append('svg')
      .attr('viewBox', `0 0 ${width} ${height}`)
      .attr('width', '100%')
      .attr('height', '100%')

    const tooltip = container
      .append('div')
      .attr('class', 'chart-tooltip')
      .style('position', 'absolute')
      .style('opacity', 0)
      .style('pointer-events', 'none')

    const complexities = files.map((file) => file.complexity_avg).filter((value) => typeof value === 'number')
    const minComplexity = complexities.length > 0 ? Math.min(...complexities) : 0
    const maxComplexity = complexities.length > 0 ? Math.max(...complexities) : 10

    const colorScale = d3
      .scaleLinear()
      .domain([minComplexity, (minComplexity + maxComplexity) / 2, maxComplexity || 10])
      .range(['#22c55e', '#facc15', '#ef4444'])

    const data = {
      name: folderName,
      children: files.map((file) => ({
        name: file.filename.split('/').pop(),
        total_nloc: file.total_nloc || 0,
        complexity_avg: file.complexity_avg || 0,
        complexity_max: file.complexity_max || 0,
        function_count: file.function_count || 0,
        functions: file.functions || [],
      })),
    }

    const hierarchy = d3
      .hierarchy(data)
      .sum((d) => d.total_nloc)
      .sort((a, b) => b.value - a.value)

    const pack = d3.pack().size([width - margin * 2, height - margin * 2]).padding(10)

    const root = pack(hierarchy)

    const chartGroup = svg.append('g').attr('transform', `translate(${margin}, ${margin})`)

    const nodes = chartGroup
      .selectAll('g')
      .data(root.descendants())
      .enter()
      .append('g')
      .attr('transform', (d) => `translate(${d.x}, ${d.y})`)

    nodes
      .append('circle')
      .attr('r', (d) => d.r)
      .attr('fill', (d) => (d.children ? 'none' : colorScale(d.data.complexity_avg)))
      .attr('stroke', (d) => (d.children ? '#1f2937' : 'none'))
      .attr('stroke-width', (d) => (d.children ? 2 : 0))
      .on('mouseover', function (event, d) {
        const [x, y] = d3.pointer(event, container.node())
        tooltip
          .style('opacity', 0.95)
          .style('left', `${x + 12}px`)
          .style('top', `${y - 28}px`)
          .html(generateTooltip(d.data))
      })
      .on('mousemove', function (event) {
        const [x, y] = d3.pointer(event, container.node())
        tooltip.style('left', `${x + 12}px`).style('top', `${y - 28}px`)
      })
      .on('mouseout', function () {
        tooltip.style('opacity', 0)
      })

    svg
      .append('circle')
      .attr('cx', root.x + margin)
      .attr('cy', root.y + margin)
      .attr('r', root.r)
      .attr('fill', 'none')
      .attr('stroke', '#111827')
      .attr('stroke-width', 2)

    function generateTooltip(d) {
      if (!d.name) {
        return `<strong>${folderName}</strong>`
      }

      let html = `
        <div class="tooltip-content">
          <h4>${d.name}</h4>
          <p><strong>Logical LOC:</strong> ${d.total_nloc}</p>
          <p><strong>Functions:</strong> ${d.function_count}</p>
          <p><strong>Avg CC:</strong> ${d.complexity_avg}</p>
          <p><strong>Max CC:</strong> ${d.complexity_max}</p>
        </div>
      `

      if (d.functions?.length) {
        html += '<div class="tooltip-list"><strong>Functions</strong>'
        d.functions.slice(0, 5).forEach((fn) => {
          html += `
            <div class="tooltip-row">
              <span>${fn.name}</span>
              <span>nloc: ${fn.nloc}</span>
              <span>CC: ${fn.cyclomatic_complexity}</span>
            </div>
          `
        })
        if (d.functions.length > 5) {
          html += `<div class="tooltip-row">…and ${d.functions.length - 5} more</div>`
        }
        html += '</div>'
      }

      return html
    }

    return () => {
      container.selectAll('*').remove()
    }
  }, [files, folderName])

  return <div ref={chartRef} className="circle-packing-container"></div>
}

export default FolderCirclePackingChart
