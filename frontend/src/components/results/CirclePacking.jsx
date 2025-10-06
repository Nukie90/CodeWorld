import React, { useEffect, useRef } from 'react'
import * as d3 from 'd3'

function CirclePacking({ data }) {
  const ref = useRef()

  useEffect(() => {
    if (!data) return

    const width = 600
    const height = 600

    const colorScale = d3.scaleLinear()
      .domain([0, 10, 20]) // adjust based on typical CC ranges
      .range(['green', 'yellow', 'red'])

    // Build a hierarchy from files/functions
    const root = d3.hierarchy(data)
      .sum(d => d.nloc || 0) // size = nloc
      .sort((a, b) => b.value - a.value)

    const pack = d3.pack()
      .size([width, height])
      .padding(5)

    pack(root)

    const svg = d3.select(ref.current)
      .attr('viewBox', [0, 0, width, height])
      .attr('text-anchor', 'middle')
      .style('font-family', 'sans-serif')
      .style('font-size', 10)

    svg.selectAll('*').remove() // clear previous render

    const node = svg.append('g')
      .selectAll('circle')
      .data(root.descendants())
      .join('g')
      .attr('transform', d => `translate(${d.x},${d.y})`)

    // Draw circles
    node.append('circle')
      .attr('r', d => d.r)
      .attr('fill', d => (d.children ? 'none' : colorScale(d.data.complexity || 0)))
      .attr('stroke', d => (d.children ? '#555' : 'none'))

    // Tooltip
    node.append('title')
      .text(d => {
        if (d.data.filename) {
          return `${d.data.filename}\nLOC: ${d.data.nloc}\nAvg CC: ${d.data.complexity}`
        }
        if (d.data.name) {
          return `${d.data.name}\nLOC: ${d.data.nloc}\nCC: ${d.data.cyclomatic_complexity}`
        }
        return 'Folder'
      })
  }, [data])

  return <svg ref={ref} width="100%" height="600"></svg>
}

export default CirclePacking
