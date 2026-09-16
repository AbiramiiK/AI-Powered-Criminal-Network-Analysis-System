import { useEffect, useMemo, useRef } from 'react'
import CytoscapeComponent from 'react-cytoscapejs'
import type { Core, EventObject } from 'cytoscape'
import type { GraphData } from '../types'

const NODE_COLORS: Record<string, string> = {
  PERSON: '#173F67',
  PHONE: '#7C9CBF',
  VEHICLE: '#F59E0B',
  LOCATION: '#16A34A',
  ORGANIZATION: '#7C3AED',
  CASE: '#DC2626',
}

const NODE_SHAPES: Record<string, string> = {
  PERSON: 'ellipse',
  PHONE: 'hexagon',
  VEHICLE: 'round-rectangle',
  LOCATION: 'triangle',
  ORGANIZATION: 'diamond',
  CASE: 'star',
}

export const GRAPH_LEGEND = [
  { type: 'PERSON', label: 'Person', color: NODE_COLORS.PERSON, shape: 'circle' },
  { type: 'PHONE', label: 'Phone', color: NODE_COLORS.PHONE, shape: 'hexagon' },
  { type: 'VEHICLE', label: 'Vehicle', color: NODE_COLORS.VEHICLE, shape: 'square' },
  { type: 'LOCATION', label: 'Location', color: NODE_COLORS.LOCATION, shape: 'triangle' },
  { type: 'ORGANIZATION', label: 'Organization', color: NODE_COLORS.ORGANIZATION, shape: 'diamond' },
  { type: 'CASE', label: 'Case', color: NODE_COLORS.CASE, shape: 'star' },
]

const RELATION_COLORS: Record<string, string> = {
  CALLED: '#2563EB',
  TRANSFERRED_MONEY: '#D97706',
  USED_VEHICLE: '#EA580C',
  OBSERVED_AT: '#16A34A',
  MEMBER_OF: '#7C3AED',
  MENTIONED_IN: '#BE123C',
  LINKED_TO: '#4F46E5',
  ASSOCIATED_WITH: '#173F67',
  HAS_PHONE: '#94A3B8',
}

export const RELATION_LEGEND = [
  { relation: 'CALLED', label: 'Communication', color: RELATION_COLORS.CALLED },
  { relation: 'TRANSFERRED_MONEY', label: 'Financial', color: RELATION_COLORS.TRANSFERRED_MONEY },
  { relation: 'USED_VEHICLE', label: 'Vehicle', color: RELATION_COLORS.USED_VEHICLE },
  { relation: 'OBSERVED_AT', label: 'Location', color: RELATION_COLORS.OBSERVED_AT },
  { relation: 'MEMBER_OF', label: 'Organization', color: RELATION_COLORS.MEMBER_OF },
  { relation: 'MENTIONED_IN', label: 'FIR Mention', color: RELATION_COLORS.MENTIONED_IN },
  { relation: 'LINKED_TO', label: 'Intelligence / Event', color: RELATION_COLORS.LINKED_TO },
  { relation: 'ASSOCIATED_WITH', label: 'Case Link', color: RELATION_COLORS.ASSOCIATED_WITH },
]

const TAG_BORDER: Record<string, string> = {
  KEY_CONNECTOR: '#D4AF37',
  HIGH_CENTRALITY: '#DC2626',
  CROSS_CASE: '#7C3AED',
  MULTI_SOURCE: '#0EA5E9',
  SUSPICIOUS_PATTERN: '#F59E0B',
}

interface Props {
  data: GraphData
  height?: number | string
  onNodeClick?: (id: string, type: string) => void
  highlightId?: string | null
  layout?: 'breadthfirst' | 'concentric' | 'cose'
  rootId?: string
}

export function NetworkGraph({ data, height = 480, onNodeClick, highlightId, layout = 'cose', rootId }: Props) {
  const cyRef = useRef<Core | null>(null)

  const elements = useMemo(() => {
    const nodeEls = data.nodes.map((n) => ({
      data: {
        id: n.id, label: n.label, type: n.type, degree: n.degree,
        tag: (n.analytical_tags && n.analytical_tags[0]) || null,
        tagCount: n.analytical_tags?.length ?? 0,
        is_center: Boolean(n.is_center),
      },
    }))
    const edgeEls = data.edges.map((e) => ({
      data: {
        id: e.id, source: e.source, target: e.target,
        label: e.label ?? e.relation, relation: e.relation, count: e.count,
        strength: e.strength ?? 'weak',
      },
    }))
    return [...nodeEls, ...edgeEls]
  }, [data])

  const stylesheet: any[] = [
    {
      selector: 'node',
      style: {
        'background-color': (ele: any) => NODE_COLORS[ele.data('type')] ?? '#64748B',
        shape: (ele: any) => (NODE_SHAPES[ele.data('type')] ?? 'ellipse') as any,
        label: 'data(label)',
        color: '#16324F',
        'font-size': 9,
        'text-valign': 'bottom',
        'text-margin-y': 4,
        width: (ele: any) => 16 + Math.min(28, (ele.data('degree') || 0) * 1.4),
        height: (ele: any) => 16 + Math.min(28, (ele.data('degree') || 0) * 1.4),
        'border-width': (ele: any) => (ele.data('tag') ? 3.5 : 2),
        'border-color': (ele: any) => TAG_BORDER[ele.data('tag')] ?? '#ffffff',
        'border-style': (ele: any) => (ele.data('tag') === 'SUSPICIOUS_PATTERN' ? 'dashed' : 'solid'),
        'text-outline-width': 2,
        'text-outline-color': '#F4F9FD',
        'z-index': (ele: any) => (ele.data('tag') ? 10 : 1),
      },
    },
    {
      selector: 'node[?is_center]',
      style: { 'border-color': '#DC2626', 'border-width': 4, 'border-style': 'solid' },
    },
    {
      selector: 'edge',
      style: {
        width: (ele: any) => 1 + Math.min(6, Math.log2((ele.data('count') || 1) + 1)),
        'line-color': (ele: any) => RELATION_COLORS[ele.data('relation')] ?? '#B9CBDC',
        'target-arrow-color': (ele: any) => RELATION_COLORS[ele.data('relation')] ?? '#B9CBDC',
        'target-arrow-shape': 'triangle',
        'arrow-scale': 0.7,
        'curve-style': 'bezier',
        opacity: (ele: any) => (ele.data('strength') === 'strong' ? 0.85 : ele.data('strength') === 'moderate' ? 0.55 : 0.3),
        label: '',
        'font-size': 8,
        color: '#334155',
        'text-background-color': '#F4F9FD',
        'text-background-opacity': 0.9,
        'text-background-padding': 1,
      },
    },
    {
      selector: 'edge.show-label',
      style: { label: 'data(label)' },
    },
    {
      selector: '.highlighted',
      style: { 'line-color': '#DC2626', 'target-arrow-color': '#DC2626', opacity: 1, 'z-index': 20 },
    },
    {
      selector: 'node.highlighted',
      style: { 'border-color': '#DC2626', 'border-width': 4 },
    },
    {
      selector: '.dimmed',
      style: { opacity: 0.08 },
    },
  ]

  function highlight(id: string) {
    const cy = cyRef.current
    if (!cy) return
    cy.elements().removeClass('highlighted dimmed')
    const node = cy.getElementById(id)
    if (node.empty()) return
    const neighborhood = node.closedNeighborhood()
    cy.elements().difference(neighborhood).addClass('dimmed')
    neighborhood.addClass('highlighted')
    node.removeClass('dimmed')
  }

  const layoutOptions = useMemo(() => {
    if (layout === 'breadthfirst') {
      return { name: 'breadthfirst', roots: rootId ? [`#${rootId}`] : undefined, animate: false, padding: 30, spacingFactor: 1.3, directed: false }
    }
    if (layout === 'concentric') {
      // Coarse tiers (not raw degree) -- concentric packs same-value nodes onto one ring
      // spread across it; using near-unique degree values put every node on its own
      // single-node ring, which degenerates into a straight line instead of a web.
      return {
        name: 'concentric', animate: false, padding: 30, minNodeSpacing: 45, equidistant: true,
        concentric: (node: any) => (node.data('is_center') ? 4 : node.data('type') === 'PERSON' ? (node.data('tag') ? 3 : 2) : 1),
        levelWidth: () => 1,
      }
    }
    return { name: 'cose', animate: false, padding: 20, nodeRepulsion: 9000, idealEdgeLength: 90, componentSpacing: 60 }
  }, [layout, rootId])

  useEffect(() => {
    // react-cytoscapejs only applies the `layout` prop once, on initial mount -- when
    // `elements` changes later (e.g. data arrives from an async fetch, or filters
    // change), the graph must be re-laid-out manually or new nodes collapse into a
    // degenerate line/point. The rAF + resize ensures the flex/grid container has its
    // final size before Cytoscape computes positions.
    const cy = cyRef.current
    if (!cy) return
    const raf = requestAnimationFrame(() => {
      cy.resize()
      const l = cy.layout(layoutOptions as any)
      l.run()
      cy.fit(undefined, 20)
      if (highlightId) highlight(highlightId)
    })
    return () => cancelAnimationFrame(raf)
  }, [elements, layoutOptions])

  return (
    <div style={{ height, position: 'relative' }}>
      <CytoscapeComponent
        elements={elements}
        stylesheet={stylesheet as any}
        style={{ width: '100%', height: '100%' }}
        layout={layoutOptions as any}
        cy={(cy: Core) => {
          cyRef.current = cy
          cy.off('tap mouseover mouseout zoom')
          cy.on('tap', 'node', (evt: EventObject) => {
            const id = evt.target.id()
            const type = evt.target.data('type')
            highlight(id)
            onNodeClick?.(id, type)
          })
          cy.on('tap', (evt: EventObject) => {
            if (evt.target === cy) cy.elements().removeClass('highlighted dimmed')
          })
          cy.on('mouseover', 'edge', (evt: EventObject) => evt.target.addClass('show-label'))
          cy.on('mouseout', 'edge', (evt: EventObject) => evt.target.removeClass('show-label'))
          cy.on('zoom', () => {
            if (cy.zoom() > 1.4) cy.edges().addClass('show-label')
            else cy.edges().removeClass('show-label')
          })
          if (highlightId) highlight(highlightId)
        }}
      />
    </div>
  )
}
