import React, { useRef, useEffect } from 'react'
import * as d3 from 'd3'

function FlowerTreeVisualization({ individualFiles, folderName }) {
  const chartRef = useRef(null)

  useEffect(() => {
    if (!individualFiles?.length) return

    const width = 800
    const height = 600
    const margin = { top: 20, right: 20, bottom: 20, left: 20 }

    // Clear previous content
    const container = d3.select(chartRef.current)
    container.html('')

    // Create SVG
    const svg = container.append('svg')
      .attr('width', width)
      .attr('height', height)
      .append('g')
      .attr('transform', `translate(${margin.left},${height - margin.bottom})`)

    // Add gradient definitions for flower centers
    const defs = svg.append('defs')
    const yellowGradient = defs.append('radialGradient')
      .attr('id', 'yellowGradient')
    yellowGradient.append('stop')
      .attr('offset', '0%')
      .attr('stop-color', '#FFD700')
    yellowGradient.append('stop')
      .attr('offset', '100%')
      .attr('stop-color', '#FFA500')

    // Scale for flower size based on nloc
    const sizeScale = d3.scaleLinear()
      .domain([0, d3.max(individualFiles, f => {
        const maxFnNloc = Math.max(...(f.functions || []).map(fn => fn.nloc || 0))
        return maxFnNloc || 0
      })])
      .range([20, 35])

    // Scale for vertical spacing
    const xScale = d3.scalePoint()
      .domain(individualFiles.map(f => f.filename))
      .range([margin.left, width - margin.right])

    // Function to generate petal path
    function petalPath(size) {
      return `M 0,0 C ${size/2},${-size/4} ${size/2},${-size*3/4} 0,${-size} 
              C ${-size/2},${-size*3/4} ${-size/2},${-size/4} 0,0`
    }

    // Function to get color based on complexity
    function getComplexityColor(complexity) {
      if (complexity >= 8) return '#FF9999'  // Light red for high complexity
      if (complexity >= 4) return '#FFB6C1'  // Pink for medium complexity
      return '#FFFFFF'                        // White for low complexity
    }

    // Create stem groups for each file
    const fileGroups = svg.selectAll('.file-group')
      .data(individualFiles)
      .enter()
      .append('g')
      .attr('class', 'file-group')
      .attr('transform', d => `translate(${xScale(d.filename)},0)`)

    // Add stems (straight vertical lines)
    fileGroups.append('line')
      .attr('class', 'stem')
      .attr('x1', 0)
      .attr('y1', 0)
      .attr('x2', 0)
      .attr('y2', -height * 0.8)
      .attr('stroke', '#2E8B57')
      .attr('stroke-width', 1.5)

    // Add single leaf
    fileGroups.append('path')
      .attr('class', 'leaf')
      .attr('d', 'M -2,-100 L 8,-95 L -2,-90')
      .attr('fill', '#90EE90')
      .attr('stroke', '#2E8B57')
      .attr('stroke-width', 1)

    // Create groups for functions (flowers)
    const functionGroups = fileGroups.selectAll('.function-group')
      .data(d => (d.functions || []).map(fn => ({...fn, filename: d.filename})))
      .enter()
      .append('g')
      .attr('class', 'function-group')
      .attr('transform', (d, i, nodes) => {
        const totalFunctions = nodes.length
        const verticalSpacing = (height * 0.7) / (totalFunctions + 1)
        return `translate(0,${-150 - (i * verticalSpacing)})`
      })

    // Create flowers
    functionGroups.each(function(d) {
      const group = d3.select(this)
      const flowerSize = sizeScale(d.nloc)
      const petalColor = getComplexityColor(d.cyclomatic_complexity)
      
      // Create 5 petals for each flower
      for (let i = 0; i < 5; i++) {
        group.append('path')
          .attr('class', 'petal')
          .attr('d', petalPath(flowerSize))
          .attr('fill', petalColor)
          .attr('stroke', '#666')
          .attr('stroke-width', 0.5)
          .attr('transform', `rotate(${i * 72})`)
      }

      // Add flower center
      group.append('circle')
        .attr('r', flowerSize / 4)
        .attr('fill', 'url(#yellowGradient)')
    })

    // Add hover interactions
    functionGroups
      .on('mouseover', function(event, d) {
        const tooltip = container.append('div')
          .attr('class', 'tooltip')
          .style('position', 'absolute')
          .style('background', 'white')
          .style('padding', '10px')
          .style('border', '1px solid black')
          .style('border-radius', '5px')
          .style('pointer-events', 'none')
          .style('opacity', 0)

        tooltip.html(`
          <strong>${d.name}</strong><br/>
          Lines of Code: ${d.nloc}<br/>
          Complexity: ${d.cyclomatic_complexity}
        `)
          .style('left', (event.pageX + 10) + 'px')
          .style('top', (event.pageY - 28) + 'px')
          .style('opacity', 1)

        // Highlight the flower
        d3.select(this)
          .selectAll('.petal')
          .attr('stroke-width', 2)
          .attr('stroke', '#333')
      })
      .on('mouseout', function() {
        container.selectAll('.tooltip').remove()
        d3.select(this)
          .selectAll('.petal')
          .attr('stroke-width', 0.5)
          .attr('stroke', '#666')
      })

    // Add file labels
    fileGroups.append('text')
      .attr('y', 20)
      .attr('text-anchor', 'middle')
      .attr('font-size', '11px')
      .attr('fill', '#666')
      .text(d => {
        const name = d.filename.split('/').pop()
        return name.replace('.py', '').replace('.jsx', '')
      })

    return () => {
      svg.remove()
    }
  }, [individualFiles, folderName])

  return (
    <div ref={chartRef} className="chart-container" style={{ width: '800px', height: '600px', margin: '0 auto' }}></div>
  )
}

export default FlowerTreeVisualization
