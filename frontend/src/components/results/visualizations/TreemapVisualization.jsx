import React, { useRef, useEffect } from 'react'
import * as d3 from 'd3'

function TreemapVisualization({ individualFiles, folderName }) {
  const chartRef = useRef(null)

  useEffect(() => {
    if (!individualFiles?.length) return

    const width = 800
    const height = 600
    const margin = { top: 30, right: 10, bottom: 10, left: 10 }

    const container = d3.select(chartRef.current)
    container.html('')

    const svg = container.append('svg')
      .attr('width', width)
      .attr('height', height)

    const tooltip = d3.select('body').append('div')
      .attr('class', 'd3-tooltip')
      .style('position', 'absolute')
      .style('opacity', 0)
      .style('background', 'white')
      .style('border', '1px solid black')
      .style('padding', '10px')
      .style('border-radius', '5px')
      .style('pointer-events', 'none')
      .style('max-width', '300px')
      .style('box-shadow', '0 2px 10px rgba(0,0,0,0.1)')

    const complexities = individualFiles
      .map(f => f.total_complexity)
      .filter(Boolean)
    const minComplexity = complexities.length > 0 ? Math.min(...complexities) : 1
    const maxComplexity = complexities.length > 0 ? Math.max(...complexities) : 10

    const colorScale = d3.scaleLinear()
      .domain([minComplexity, maxComplexity])
      .range(['green', 'red'])

    const data = {
      name: folderName,
      children: individualFiles.map(file => ({
        name: file.filename.split('/').pop(),
        value: file.total_nloc || 0,
        total_complexity: file.total_complexity || 0,
        complexity_max: file.complexity_max || 0,
        function_count: file.function_count || 0,
        functions: file.functions || []
      }))
    }

    const treemap = d3.treemap()
      .size([width - margin.left - margin.right, height - margin.top - margin.bottom])
      .padding(1)
      .round(true)

    const root = d3.hierarchy(data)
      .sum(d => d.value)
      .sort((a, b) => b.value - a.value)

    treemap(root)

    const g = svg.append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`)

    const cell = g.selectAll('g')
      .data(root.leaves())
      .enter().append('g')
      .attr('transform', d => `translate(${d.x0},${d.y0})`)

    cell.append('rect')
      .attr('width', d => d.x1 - d.x0)
      .attr('height', d => d.y1 - d.y0)
      .attr('fill', d => colorScale(d.data.total_complexity))
      .attr('stroke', '#fff')
      .on('mouseover', function(event, d) {
        tooltip.transition()
          .duration(200)
          .style('opacity', 0.9)
        tooltip.html(generateTooltipHtml(d.data))
          .style('left', (event.pageX + 10) + 'px')
          .style('top', (event.pageY - 28) + 'px')
      })
      .on('mouseout', function() {
        tooltip.transition()
          .duration(500)
          .style('opacity', 0)
      })

    // Add file names
    cell.append('text')
      .attr('x', 4)
      .attr('y', 14)
      .attr('fill', 'white')
      .attr('font-size', '10px')
      .text(d => {
        const width = d.x1 - d.x0
        const name = d.data.name
        if (width < 50) return '' // Don't show text if rectangle is too small
        if (width < 100) return name.substring(0, 8) + '...'
        return name
      })

    function generateTooltipHtml(d) {
      let html = `
        <h4 style="margin: 0 0 10px 0;">${d.name}</h4>
        <p><strong>Logical LOC:</strong> ${d.value}</p>
        <p><strong>Functions:</strong> ${d.function_count}</p>
        <p><strong>Avg. Complexity:</strong> ${d.total_complexity}</p>
        <p><strong>Max. Complexity:</strong> ${d.complexity_max}</p>
      `
      if (d.functions?.length > 0) {
        html += `<details style="margin-top: 10px;"><summary>Functions (${d.functions.length})</summary>`
        d.functions.forEach(fn => {
          html += `
            <div style="margin: 5px 0; padding: 2px; border-left: 2px solid #ccc;">
              <span style="font-weight: bold;">${fn.name}</span>
              <span style="margin-left: 10px;">nloc: ${fn.nloc}</span>
              <span style="margin-left: 10px;">CC: ${fn.cyclomatic_complexity}</span>
            </div>
          `
        })
        html += '</details>'
      }
      return html
    }

    return () => {
      svg.remove()
      tooltip.remove()
    }
  }, [individualFiles, folderName])

  return (
    <div ref={chartRef} className="chart-container" style={{ width: '800px', height: '600px', margin: '0 auto' }}></div>
  )
}

export default TreemapVisualization
