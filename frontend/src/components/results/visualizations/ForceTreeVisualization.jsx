import React, { useRef, useEffect } from 'react'
import * as d3 from 'd3'

function ForceTreeVisualization({ individualFiles, folderName }) {
  const chartRef = useRef(null)

  useEffect(() => {
    if (!individualFiles?.length) return

    const width = 800
    const height = 600

    // Clear previous content
    const container = d3.select(chartRef.current)
    container.html('')

    // Create SVG with zoom support
    const svg = container.append('svg')
      .attr('width', width)
      .attr('height', height)
      .attr('viewBox', [0, 0, width, height])

    // Add zoom behavior
    const g = svg.append('g')
    const zoom = d3.zoom()
      .scaleExtent([0.5, 2])
      .on('zoom', (event) => {
        g.attr('transform', event.transform)
      })
    svg.call(zoom)

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

    // Function to create folder hierarchy
    function createFolderStructure(files) {
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
          complexity: file.complexity_avg || 0,
          nloc: file.total_nloc || 0,
          children: (file.functions || []).map(fn => ({
            name: fn.name,
            type: 'function',
            complexity: fn.cyclomatic_complexity,
            nloc: fn.nloc
          }))
        })
      })

      return root
    }

    // Create hierarchical data
    const data = createFolderStructure(individualFiles);
    

    const root = d3.hierarchy(data)

    // Create force simulation
    const simulation = d3.forceSimulation()
      .force('link', d3.forceLink().id(d => d.id).distance(d => {
        // Adjust distance based on node types
        if (d.source.data.type === 'folder' && d.target.data.type === 'folder') return 150;
        if (d.source.data.type === 'folder' && d.target.data.type === 'file') return 100;
        if (d.source.data.type === 'file' && d.target.data.type === 'function') return 70;
        return 100;
      }))
      .force('charge', d3.forceManyBody().strength(d => {
        // Adjust repulsion force based on node type
        if (d.data.type === 'folder') return -1000;
        if (d.data.type === 'file') return -500;
        return -300;
      }))
      .force('x', d3.forceX(width / 2))
      .force('y', d3.forceY(height / 2).strength(d => {
        // Adjust vertical positioning based on depth
        return 0.1 + (d.depth * 0.05);
      }))

    // Create links
    const links = root.links()
    const nodes = root.descendants()

    // Assign unique IDs to nodes
    nodes.forEach((node, i) => {
      node.id = i
      node.collapsed = node.depth === 1 // Initially collapse file nodes
    })

    // Create visual elements
    const link = g.append('g')
      .selectAll('line')
      .data(links)
      .join('line')
      .attr('stroke', '#999')
      .attr('stroke-opacity', 0.6)
      .attr('stroke-width', 1)

    const node = g.append('g')
      .selectAll('g')
      .data(nodes)
      .join('g')
      .call(drag(simulation))

    // Add circles for nodes
    node.append('circle')
      .attr('r', d => getNodeRadius(d))
      .attr('fill', d => getNodeColor(d))
      .attr('stroke', d => d.data.type === 'folder' ? '#2C3E50' : '#fff')
      .attr('stroke-width', d => d.data.type === 'folder' ? 2 : 1.5)

    // Add icons
    node.append('text')
      .attr('x', 0)
      .attr('y', 0)
      .attr('dy', '.35em')
      .attr('text-anchor', 'middle')
      .attr('fill', 'white')
      .style('font-family', 'FontAwesome')
      .text(d => getNodeIcon(d))

    // Add labels
    node.append('text')
      .attr('x', 0)
      .attr('y', d => getNodeRadius(d) + 10)
      .attr('text-anchor', 'middle')
      .attr('fill', '#333')
      .style('font-size', '10px')
      .text(d => d.data.name)

    // Handle node click (expand/collapse)
    node.on('click', (event, d) => {
      if (!d.children && !d._children) return // Leaf node
      
      if (d.children) {
        d._children = d.children
        d.children = null
      } else {
        d.children = d._children
        d._children = null
      }
      
      update()
    })

    // Add hover effects
    node.on('mouseover', function(event, d) {
        tooltip.transition()
          .duration(200)
          .style('opacity', 0.9)
        tooltip.html(generateTooltipHtml(d))
          .style('left', (event.pageX + 10) + 'px')
          .style('top', (event.pageY - 28) + 'px')
      })
      .on('mouseout', function() {
        tooltip.transition()
          .duration(500)
          .style('opacity', 0)
      })

    // Update force simulation
    simulation.nodes(nodes)
    simulation.force('link').links(links)

    simulation.on('tick', () => {
      link
        .attr('x1', d => d.source.x)
        .attr('y1', d => d.source.y)
        .attr('x2', d => d.target.x)
        .attr('y2', d => d.target.y)

      node.attr('transform', d => `translate(${d.x},${d.y})`)
    })

    // Helper functions
    function getNodeRadius(d) {
      switch (d.data.type) {
        case 'folder': return d.depth === 0 ? 30 : 22
        case 'file': return 18
        case 'function': return 12
        default: return 10
      }
    }

    function getNodeColor(d) {
      switch (d.data.type) {
        case 'folder': 
          return d.depth === 0 ? '#2C3E50' : '#3498DB'
        case 'file': 
          return d3.interpolate('green', 'red')(d.data.complexity / 10)
        case 'function':
          return d3.interpolate('green', 'red')(d.data.complexity / 10)
        default: return '#999'
      }
    }

    function getNodeIcon(d) {
      switch (d.data.type) {
        case 'folder': return '📁'
        case 'file': return '📄'
        case 'function': return 'ƒ'
        default: return ''
      }
    }

    function generateTooltipHtml(d) {
      let html = `<h4 style="margin: 0 0 10px 0;">${d.data.name}</h4>`
      
      if (d.data.type === 'file') {
        html += `
          <p><strong>Lines of Code:</strong> ${d.data.nloc}</p>
          <p><strong>Complexity:</strong> ${d.data.complexity.toFixed(2)}</p>
          <p><strong>Functions:</strong> ${d.data.children ? d.data.children.length : 0}</p>
        `
      } else if (d.data.type === 'function') {
        html += `
          <p><strong>Lines of Code:</strong> ${d.data.nloc}</p>
          <p><strong>Complexity:</strong> ${d.data.complexity}</p>
        `
      }
      
      return html
    }

    function update() {
      // Update the nodes and links based on the current state
      const nodes = root.descendants()
      const links = root.links()

      // Update links
      link.data(links)
        .join('line')
        .attr('stroke', '#999')
        .attr('stroke-opacity', 0.6)
        .attr('stroke-width', 1)

      // Update nodes
      node.data(nodes)
        .join('g')
        .call(drag(simulation))

      // Update simulation
      simulation.nodes(nodes)
      simulation.force('link').links(links)
      simulation.alpha(1).restart()
    }

    // Drag behavior
    function drag(simulation) {
      function dragstarted(event) {
        if (!event.active) simulation.alphaTarget(0.3).restart()
        event.subject.fx = event.subject.x
        event.subject.fy = event.subject.y
      }

      function dragged(event) {
        event.subject.fx = event.x
        event.subject.fy = event.y
      }

      function dragended(event) {
        if (!event.active) simulation.alphaTarget(0)
        event.subject.fx = null
        event.subject.fy = null
      }

      return d3.drag()
        .on('start', dragstarted)
        .on('drag', dragged)
        .on('end', dragended)
    }

    return () => {
      simulation.stop()
      svg.remove()
      tooltip.remove()
    }
  }, [individualFiles, folderName])

  return (
    <div ref={chartRef} className="chart-container" style={{ width: '800px', height: '600px', margin: '0 auto' }}></div>
  )
}

export default ForceTreeVisualization
