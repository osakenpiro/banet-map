import { useEffect, useRef, useState, useMemo } from 'react'
import {
  forceSimulation,
  forceLink,
  forceManyBody,
  forceCenter,
  forceCollide,
} from 'd3-force'

const KIND_STYLE = {
  embodies:     { label: '体現',       color: '#8338ec' },
  implements:   { label: '実装',       color: '#ffd166' },
  extends:      { label: '拡張',       color: '#06d6a0' },
  cites:        { label: '引用',       color: '#118ab2' },
  hypothesizes: { label: '仮説',       color: '#ef476f' },
}

const CATEGORY_LABEL = {
  philosophy: '思想',
  product:    'プロダクト',
  paper:      '論文',
  method:     '手法',
}

export default function BanetMap() {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [showHypothesis, setShowHypothesis] = useState(true)
  const [selected, setSelected] = useState(null)
  const [hoveredNode, setHoveredNode] = useState(null)

  useEffect(() => {
    fetch(import.meta.env.BASE_URL + 'data/visionium.json')
      .then(r => {
        if (!r.ok) throw new Error('failed: ' + r.status)
        return r.json()
      })
      .then(setData)
      .catch(e => setError(e.message))
  }, [])

  if (error) return <div style={{ padding: 24, color: '#ef476f' }}>❌ {error}</div>
  if (!data) return <div style={{ padding: 24 }}>loading…</div>

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <Header meta={data.meta} showHypothesis={showHypothesis} onToggleHypothesis={setShowHypothesis} />
      <main style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        <Graph
          nodes={data.nodes}
          relations={data.relations}
          showHypothesis={showHypothesis}
          onPickNode={(n) => setSelected({ type: 'node', payload: n })}
          onPickEdge={(e) => setSelected({ type: 'edge', payload: e })}
          onHoverNode={setHoveredNode}
          hoveredNodeId={hoveredNode?.id}
        />
        <Legend />
        {selected && <DetailCard data={selected} onClose={() => setSelected(null)} allNodes={data.nodes} />}
      </main>
    </div>
  )
}

function Header({ meta, showHypothesis, onToggleHypothesis }) {
  return (
    <header style={{
      padding: '12px 20px',
      borderBottom: '1px solid #1e2640',
      display: 'flex',
      alignItems: 'center',
      gap: 16,
      background: '#0b0f1a',
      zIndex: 5,
    }}>
      <div style={{ fontSize: 22, fontWeight: 700 }}>🌀 バネットマップ</div>
      <div style={{ fontSize: 13, color: '#8892b0' }}>{meta?.title}</div>
      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 12 }}>
        <label style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', color: showHypothesis ? '#e4e8f0' : '#5a6378' }}>
          <input
            type="checkbox"
            checked={showHypothesis}
            onChange={(e) => onToggleHypothesis(e.target.checked)}
            style={{ accentColor: '#ef476f' }}
          />
          仮説edgeを表示
        </label>
        <a href="https://github.com/osakenpiro/banet-map" target="_blank" rel="noreferrer" style={{ color: '#8892b0', fontSize: 12, textDecoration: 'none' }}>GitHub</a>
        <a href="https://osakenpiro.github.io/wakkazukan/" target="_blank" rel="noreferrer" style={{ color: '#06d6a0', fontSize: 12, textDecoration: 'none' }}>🪐 わっかずかん</a>
        <div style={{ fontSize: 11, padding: '4px 10px', background: '#ffd166', color: '#0b0f1a', borderRadius: 12, fontWeight: 700 }}>β</div>
      </div>
    </header>
  )
}

function Graph({ nodes, relations, showHypothesis, onPickNode, onPickEdge, onHoverNode, hoveredNodeId }) {
  const svgRef = useRef(null)
  const wrapRef = useRef(null)
  const simRef = useRef(null)

  const simNodes = useMemo(() => nodes.map(n => ({ ...n })), [nodes])
  const simLinks = useMemo(() => relations.map(r => ({ ...r })), [relations])

  const [, setTick] = useState(0)

  useEffect(() => {
    const w = wrapRef.current?.clientWidth || 800
    const h = wrapRef.current?.clientHeight || 600

    const sim = forceSimulation(simNodes)
      .force('link', forceLink(simLinks)
        .id(d => d.id)
        .distance(d => 120 + (1 - (d.weight || 0.5)) * 80)
        .strength(d => (d.weight || 0.5) * 0.9))
      .force('charge', forceManyBody().strength(-420))
      .force('center', forceCenter(w / 2, h / 2))
      .force('collide', forceCollide().radius(d => (d.attrs?.radius || 20) + 6).strength(0.8))
      .alphaDecay(0.02)
      .velocityDecay(0.35)
      .on('tick', () => setTick(t => t + 1))

    simRef.current = sim
    return () => sim.stop()
  }, [simNodes, simLinks])

  useEffect(() => {
    const onResize = () => {
      if (!simRef.current || !wrapRef.current) return
      const w = wrapRef.current.clientWidth
      const h = wrapRef.current.clientHeight
      simRef.current.force('center', forceCenter(w / 2, h / 2))
      simRef.current.alpha(0.4).restart()
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  const dragState = useRef(null)
  const onPointerDownNode = (e, d) => {
    e.stopPropagation()
    if (!simRef.current) return
    simRef.current.alphaTarget(0.3).restart()
    d.fx = d.x
    d.fy = d.y
    dragState.current = { node: d, startX: e.clientX, startY: e.clientY, origX: d.x, origY: d.y, moved: false }
    try { e.currentTarget.setPointerCapture(e.pointerId) } catch {}
  }
  const onPointerMoveNode = (e) => {
    const ds = dragState.current
    if (!ds) return
    const dx = e.clientX - ds.startX
    const dy = e.clientY - ds.startY
    ds.node.fx = ds.origX + dx
    ds.node.fy = ds.origY + dy
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) ds.moved = true
  }
  const onPointerUpNode = (e, d) => {
    const ds = dragState.current
    if (!ds) return
    if (simRef.current) simRef.current.alphaTarget(0)
    d.fx = null
    d.fy = null
    if (!ds.moved) onPickNode(nodes.find(n => n.id === d.id))
    dragState.current = null
    try { e.currentTarget.releasePointerCapture(e.pointerId) } catch {}
  }

  const edgeIsRelated = (link) => {
    if (!hoveredNodeId) return true
    const sid = typeof link.source === 'object' ? link.source.id : link.source
    const tid = typeof link.target === 'object' ? link.target.id : link.target
    return sid === hoveredNodeId || tid === hoveredNodeId
  }

  const visibleLinks = simLinks.filter(l => showHypothesis || l.status !== 'hypothesis')

  return (
    <div ref={wrapRef} style={{ position: 'absolute', inset: 0 }}>
      <svg
        ref={svgRef}
        width="100%"
        height="100%"
        style={{ display: 'block', userSelect: 'none', touchAction: 'none' }}
      >
        <defs>
          {Object.entries(KIND_STYLE).map(([k, s]) => (
            <marker
              key={k}
              id={`arrow-${k}`}
              viewBox="0 -5 10 10"
              refX="10"
              refY="0"
              markerWidth="6"
              markerHeight="6"
              orient="auto"
            >
              <path d="M0,-5L10,0L0,5" fill={s.color} />
            </marker>
          ))}
        </defs>

        <g>
          {visibleLinks.map(l => {
            if (typeof l.source !== 'object' || typeof l.target !== 'object') return null
            const style = KIND_STYLE[l.kind] || { color: '#8892b0' }
            const dim = hoveredNodeId && !edgeIsRelated(l)
            const dashed = l.status === 'hypothesis'
            const refuted = l.status === 'refuted'
            const stroke = refuted ? '#5a6378' : style.color
            const sx = l.source.x, sy = l.source.y
            const tx = l.target.x, ty = l.target.y
            const tr = (l.target.attrs?.radius || 20) + 4
            const dx = tx - sx, dy = ty - sy
            const len = Math.hypot(dx, dy) || 1
            const ex = tx - (dx / len) * tr
            const ey = ty - (dy / len) * tr
            return (
              <g key={l.id} style={{ cursor: 'pointer' }} onClick={(e) => { e.stopPropagation(); onPickEdge(l) }}>
                <line
                  x1={sx} y1={sy} x2={ex} y2={ey}
                  stroke={stroke}
                  strokeWidth={1 + (l.weight || 0.5) * 3}
                  strokeOpacity={dim ? 0.08 : (refuted ? 0.4 : 0.7)}
                  strokeDasharray={dashed ? '6 5' : refuted ? '2 4' : undefined}
                  markerEnd={refuted ? undefined : `url(#arrow-${l.kind})`}
                />
                <line
                  x1={sx} y1={sy} x2={ex} y2={ey}
                  stroke="transparent"
                  strokeWidth="14"
                />
              </g>
            )
          })}
        </g>

        <g>
          {simNodes.map(d => {
            const r = d.attrs?.radius || 20
            const color = d.attrs?.color || '#8892b0'
            const isHovered = hoveredNodeId === d.id
            return (
              <g
                key={d.id}
                transform={`translate(${d.x || 0},${d.y || 0})`}
                style={{ cursor: 'grab' }}
                onPointerDown={(e) => onPointerDownNode(e, d)}
                onPointerMove={onPointerMoveNode}
                onPointerUp={(e) => onPointerUpNode(e, d)}
                onPointerEnter={() => onHoverNode(d)}
                onPointerLeave={() => onHoverNode(null)}
              >
                <circle
                  r={r}
                  fill="#111827"
                  stroke={color}
                  strokeWidth={isHovered ? 4 : 2.5}
                />
                <text
                  textAnchor="middle"
                  dominantBaseline="central"
                  fontSize={r * 0.9}
                  style={{ pointerEvents: 'none' }}
                >
                  {d.icon || '·'}
                </text>
                <text
                  y={r + 14}
                  textAnchor="middle"
                  fontSize="11"
                  fill="#e4e8f0"
                  fontWeight="600"
                  style={{ pointerEvents: 'none', paintOrder: 'stroke', stroke: '#0b0f1a', strokeWidth: 3 }}
                >
                  {d.name}
                </text>
              </g>
            )
          })}
        </g>
      </svg>
    </div>
  )
}

function Legend() {
  return (
    <div style={{
      position: 'absolute',
      bottom: 16,
      left: 16,
      background: 'rgba(17, 24, 39, 0.85)',
      border: '1px solid #1e2640',
      borderRadius: 8,
      padding: '10px 14px',
      fontSize: 11,
      lineHeight: 1.6,
      color: '#c4c9d4',
      backdropFilter: 'blur(6px)',
      maxWidth: 240,
    }}>
      <div style={{ fontWeight: 700, marginBottom: 4, color: '#e4e8f0' }}>凡例</div>
      {Object.entries(KIND_STYLE).map(([k, s]) => (
        <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ display: 'inline-block', width: 20, height: 2, background: s.color, borderRadius: 2 }}></span>
          <span>{s.label} ({k})</span>
        </div>
      ))}
      <div style={{ borderTop: '1px solid #1e2640', marginTop: 6, paddingTop: 6, fontSize: 10, color: '#8892b0' }}>
        点線 = 仮説 · 実線 = 確定<br />
        線の太さ = weight (Float)<br />
        ドラッグで動かせる · クリックで詳細
      </div>
    </div>
  )
}

function DetailCard({ data, onClose, allNodes }) {
  const isNode = data.type === 'node'
  const p = data.payload

  return (
    <div style={{
      position: 'absolute',
      top: 16,
      right: 16,
      width: 340,
      maxHeight: 'calc(100% - 32px)',
      overflowY: 'auto',
      background: 'rgba(17, 24, 39, 0.95)',
      border: '1px solid #1e2640',
      borderRadius: 12,
      padding: 18,
      fontSize: 13,
      color: '#e4e8f0',
      boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
      backdropFilter: 'blur(8px)',
    }}>
      <button
        onClick={onClose}
        style={{
          position: 'absolute', top: 10, right: 10,
          background: 'transparent', border: 'none',
          color: '#8892b0', fontSize: 18, cursor: 'pointer',
        }}
      >×</button>

      {isNode ? <NodeCard node={p} /> : <EdgeCard edge={p} allNodes={allNodes} />}
    </div>
  )
}

function NodeCard({ node }) {
  const color = node.attrs?.color || '#8892b0'
  const cat = CATEGORY_LABEL[node.attrs?.category] || node.attrs?.category
  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        <div style={{ fontSize: 32 }}>{node.icon}</div>
        <div>
          <div style={{ fontSize: 18, fontWeight: 700 }}>{node.name}</div>
          <div style={{ fontSize: 11, color, fontWeight: 600 }}>{cat}</div>
        </div>
      </div>
      {node.attrs?.desc && (
        <div style={{ fontSize: 13, lineHeight: 1.6, color: '#c4c9d4', marginTop: 8 }}>
          {node.attrs.desc}
        </div>
      )}
      <div style={{ marginTop: 14, paddingTop: 10, borderTop: '1px solid #1e2640', fontSize: 11, color: '#5a6378' }}>
        id: <code>{node.id}</code>
      </div>
    </>
  )
}

function EdgeCard({ edge, allNodes }) {
  const kindStyle = KIND_STYLE[edge.kind] || { label: edge.kind, color: '#8892b0' }
  const src = allNodes.find(n => n.id === (typeof edge.source === 'object' ? edge.source.id : edge.source))
  const tgt = allNodes.find(n => n.id === (typeof edge.target === 'object' ? edge.target.id : edge.target))
  const statusLabel = {
    confirmed: { label: '確定', color: '#06d6a0' },
    hypothesis: { label: '仮説', color: '#ef476f' },
    refuted: { label: '反証', color: '#5a6378' },
  }[edge.status] || { label: edge.status, color: '#8892b0' }

  return (
    <>
      <div style={{ fontSize: 10, fontWeight: 700, color: kindStyle.color, marginBottom: 6, letterSpacing: 1, textTransform: 'uppercase' }}>
        {kindStyle.label} · {edge.kind}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 600, marginBottom: 14 }}>
        <span>{src?.icon} {src?.name}</span>
        <span style={{ color: kindStyle.color }}>→</span>
        <span>{tgt?.icon} {tgt?.name}</span>
      </div>

      <div style={{ display: 'flex', gap: 16, marginBottom: 12, fontSize: 12 }}>
        <div>
          <div style={{ color: '#5a6378', fontSize: 10 }}>WEIGHT (Float)</div>
          <div style={{ fontWeight: 700, color: '#ffd166' }}>{edge.weight?.toFixed(2)}</div>
        </div>
        <div>
          <div style={{ color: '#5a6378', fontSize: 10 }}>STATUS</div>
          <div style={{ fontWeight: 700, color: statusLabel.color }}>{statusLabel.label}</div>
        </div>
      </div>

      <div style={{ height: 6, background: '#1e2640', borderRadius: 3, overflow: 'hidden', marginBottom: 14 }}>
        <div style={{ height: '100%', width: `${(edge.weight || 0) * 100}%`, background: kindStyle.color, borderRadius: 3 }} />
      </div>

      {edge.evidence && (
        <>
          <div style={{ fontSize: 10, color: '#5a6378', marginBottom: 4, letterSpacing: 1 }}>EVIDENCE</div>
          <div style={{ fontSize: 12, lineHeight: 1.6, color: '#c4c9d4', padding: 10, background: '#0b0f1a', borderRadius: 6, borderLeft: `3px solid ${kindStyle.color}` }}>
            {edge.evidence}
          </div>
        </>
      )}

      <div style={{ marginTop: 14, paddingTop: 10, borderTop: '1px solid #1e2640', fontSize: 11, color: '#5a6378' }}>
        id: <code>{edge.id}</code>
      </div>
    </>
  )
}
