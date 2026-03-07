import { useEffect, useMemo, useRef } from 'react'
import cytoscape from 'cytoscape'

const GraphView = ({ title, graph, emptyMessage }) => {
  const containerRef = useRef(null)
  const cyRef = useRef(null)

  const elements = useMemo(() => {
    const nodes = (graph?.nodes || []).map((node) => ({ data: { id: node.id, label: node.id } }))
    const edges = (graph?.edges || []).map((edge, index) => ({
      data: {
        id: `e-${edge.source}-${edge.target}-${index}`,
        source: edge.source,
        target: edge.target,
      },
    }))
    return [...nodes, ...edges]
  }, [graph])

  useEffect(() => {
    if (!containerRef.current) return

    if (cyRef.current) {
      cyRef.current.destroy()
      cyRef.current = null
    }

    if (!elements.length) return

    const cy = cytoscape({
      container: containerRef.current,
      elements,
      style: [
        {
          selector: 'node',
          style: {
            label: 'data(label)',
            'text-wrap': 'wrap',
            'text-max-width': 120,
            'font-size': 10,
            'background-color': '#0ea5e9',
            color: '#0f172a',
            'text-valign': 'center',
            'text-halign': 'center',
            width: 'label',
            height: 'label',
            padding: '8px',
            shape: 'round-rectangle',
            'border-width': 1,
            'border-color': '#0369a1',
          },
        },
        {
          selector: 'edge',
          style: {
            width: 2,
            'line-color': '#64748b',
            'target-arrow-color': '#64748b',
            'target-arrow-shape': 'triangle',
            'curve-style': 'bezier',
          },
        },
      ],
      layout: {
        name: 'cose',
        animate: true,
        fit: true,
        padding: 24,
      },
    })

    cyRef.current = cy
    return () => {
      cy.destroy()
      cyRef.current = null
    }
  }, [elements])

  return (
    <div className="graph-panel">
      <h3>{title}</h3>
      {!elements.length ? (
        <div className="graph-empty">{emptyMessage}</div>
      ) : (
        <div ref={containerRef} className="graph-canvas" />
      )}
    </div>
  )
}

export default GraphView
