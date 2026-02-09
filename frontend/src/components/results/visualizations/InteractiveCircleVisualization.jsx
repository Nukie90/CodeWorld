import React, { useRef, useEffect } from 'react'
import * as d3 from 'd3'

function InteractiveCircleVisualization({ individualFiles, folderName }) {
  const chartRef = useRef(null)

  useEffect(() => {
    if (!individualFiles?.length) return

    const width = 800
    const height = 600
    const margin = 10

    // Clear previous content
    const container = d3.select(chartRef.current)
    container.html('')

    // Create the SVG container
    const svg = container.append('svg')
      .attr('width', width)
      .attr('height', height)
      .attr('viewBox', [-width / 2, -height / 2, width, height])

    // Create hierarchical data structure
    function createHierarchy(files) {
      const root = {
        name: folderName,
        type: 'folder',
        children: []
      }

      files.forEach(file => {
        const pathParts = file.filename.split('/')
        let currentNode = root
        
        // Create folder nodes for each part of the path
        for (let i = 0; i < pathParts.length - 1; i++) {
          const folderName = pathParts[i]
          let folderNode = currentNode.children.find(child => 
            child.name === folderName && child.type === 'folder'
          )
          
          if (!folderNode) {
            folderNode = {
              name: folderName,
              type: 'folder',
              children: []
            }
            currentNode.children.push(folderNode)
          }
          
          currentNode = folderNode
        }

        // Add the file node with its functions
        currentNode.children.push({
          name: pathParts[pathParts.length - 1],
          type: 'file',
          size: file.total_nloc || 0,
          complexity: file.total_complexity || 0,
          children: (file.functions || []).map(fn => ({
            name: fn.name,
            type: 'function',
            size: fn.nloc || 1,
            complexity: fn.cyclomatic_complexity
          }))
        })
      })

      return root
    }

    const hierarchyData = createHierarchy(individualFiles)
    const pack = data => d3.pack()
      .size([width - margin * 2, height - margin * 2])
      .padding(3)(d3.hierarchy(data)
        .sum(d => d.size || 1)
        .sort((a, b) => b.value - a.value))

    const root = pack(hierarchyData)

    let focus = root
    let view

    // Create a color scale for complexity
    const colorScale = d3.scaleLinear()
      .domain([0, 10])  // complexity range
      .range(['green', 'red'])
      .clamp(true)

    const g = svg.append('g')

    // Create tooltip
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

    function generateTooltipContent(d) {
      let html = `<h4 style="margin: 0 0 10px 0;">${d.data.name}</h4>`
      
      if (d.data.type === 'file') {
        html += `
          <p><strong>Lines of Code:</strong> ${d.data.size}</p>
          <p><strong>Complexity:</strong> ${d.data.complexity.toFixed(2)}</p>
          <p><strong>Functions:</strong> ${d.children ? d.children.length : 0}</p>
        `
      } else if (d.data.type === 'function') {
        html += `
          <p><strong>Lines of Code:</strong> ${d.data.size}</p>
          <p><strong>Complexity:</strong> ${d.data.complexity}</p>
        `
      }
      
      return html
    }

    const node = g.selectAll('circle')
      .data(root.descendants())
      .join('g')
      .attr('class', 'node')

    // Add circles
    node.append('circle')
      .attr('fill', d => {
        if (d.data.type === 'folder') return '#3498DB'
        return colorScale(d.data.complexity || 0)
      })
      .attr('fill-opacity', d => d.data.type === 'folder' ? 0.2 : 0.8)
      .attr('stroke', d => d.data.type === 'folder' ? '#2C3E50' : '#fff')
      .attr('stroke-width', d => d.data.type === 'folder' ? 2 : 1)

    // Add labels
    node.append('text')
      .attr('clip-path', d => `circle(${d.r}px)`)
      .style('font-size', d => Math.min(d.r / 3, 14) + 'px')
      .attr('fill', '#333')
      .style('text-anchor', 'middle')
      .style('dominant-baseline', 'middle')
      .text(d => d.r > 20 ? d.data.name : '')

    // Add icons for small circles
    node.append('text')
      .attr('class', 'icon')
      .style('font-family', 'monospace')
      .style('font-size', d => Math.min(d.r / 2, 20) + 'px')
      .attr('fill', '#333')
      .style('text-anchor', 'middle')
      .style('dominant-baseline', 'middle')
      .text(d => {
        if (d.r <= 20) {
          switch (d.data.type) {
            case 'folder': return '📁'
            case 'file': return '📄'
            case 'function': return 'ƒ'
            default: return ''
          }
        }
        return ''
      })

    // Add hover effects
    node.on('mouseover', function(event, d) {
      tooltip.transition()
        .duration(200)
        .style('opacity', 0.9)
      tooltip.html(generateTooltipContent(d))
        .style('left', (event.pageX + 10) + 'px')
        .style('top', (event.pageY - 28) + 'px')
    })
    .on('mouseout', function() {
      tooltip.transition()
        .duration(500)
        .style('opacity', 0)
    })

    // Add click behavior for zooming
    node.on('click', (event, d) => {
      if (focus !== d) {
        zoom(event, d)
        event.stopPropagation()
      }
    })

    // Add zoom behavior for the whole svg
    svg.on('click', (event) => {
      if (focus !== root) {
        zoom(event, root)
      }
    })

    function zoomTo(v) {
      const k = width / v[2]

      view = v

      node.attr('transform', d => {
        const x = (d.x - v[0]) * k
        const y = (d.y - v[1]) * k
        return `translate(${x},${y})`
      })

      node.selectAll('circle')
        .attr('r', d => d.r * k)

      // Update text size
      node.selectAll('text:not(.icon)')
        .style('font-size', d => Math.min(d.r * k / 3, 14) + 'px')
        .text(d => d.r * k > 20 ? d.data.name : '')

      // Update icon size
      node.selectAll('.icon')
        .style('font-size', d => Math.min(d.r * k / 2, 20) + 'px')
        .text(d => {
          if (d.r * k <= 20) {
            switch (d.data.type) {
              case 'folder': return '📁'
              case 'file': return '📄'
              case 'function': return 'ƒ'
              default: return ''
            }
          }
          return ''
        })
    }

    function zoom(event, d) {
      focus = d

      const transition = svg.transition()
        .duration(750)
        .tween('zoom', () => {
          const i = d3.interpolateZoom(view, [focus.x, focus.y, focus.r * 2])
          return t => zoomTo(i(t))
        })
    }

    // Initialize the view
    zoomTo([root.x, root.y, root.r * 2])

    return () => {
      svg.remove()
      tooltip.remove()
    }
  }, [individualFiles, folderName])

  return (
    <div ref={chartRef} className="chart-container" style={{ width: '800px', height: '600px', margin: '0 auto' }}></div>
  )
}

export default InteractiveCircleVisualization
