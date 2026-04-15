import { useEffect, useRef, useState, useMemo, useCallback } from 'react'
import {
  forceSimulation,
  forceLink,
  forceManyBody,
  forceCenter,
  forceCollide,
} from 'd3-force'
import { select } from 'd3-selection'
import { zoom as d3Zoom, zoomIdentity } from 'd3-zoom'

const KIND_STYLE = {
  embodies:     { label: '体現',   color: '#8338ec' },
  implements:   { label: '実装',   color: '#ffd166' },
  extends:      { label: '拡張',   color: '#06d6a0' },
  cites:        { label: '引用',   color: '#118ab2' },
  hypothesizes: { label: '仮説',   color: '#ef476f' },
}

const CATEGORY_META = {
  philosophy: { label: '思想',       color: '#8338ec', shape: 'diamond' },
  product:    { label: 'プロダクト', color: '#06d6a0', shape: 'circle'  },
  paper:      { label: '論文',       color: '#118ab2', shape: 'square'  },
  method:     { label: '手法',       color: '#ffd166', shape: 'hexagon' },
}

const R_MIN = 14
const R_SCALE = 3.2

/* ── Shape renderers ── */
function NodeShape({ shape, r, fill, stroke, strokeWidth }) {
  switch (shape) {
    case 'square': {
      const s = r * 1.6
      return <rect x={-s/2} y={-s/2} width={s} height={s} rx={3}
        fill={fill} stroke={stroke} strokeWidth={strokeWidth} />
    }
    case 'diamond': {
      const s = r * 1.5
      return <polygon points={`0,${-s} ${s},0 0,${s} ${-s},0`}
        fill={fill} stroke={stroke} strokeWidth={strokeWidth} />
    }
    case 'hexagon': {
      const pts = Array.from({length:6},(_,i)=>{
        const a = Math.PI/6 + i*Math.PI/3
        return `${Math.cos(a)*r*1.3},${Math.sin(a)*r*1.3}`
      }).join(' ')
      return <polygon points={pts} fill={fill} stroke={stroke} strokeWidth={strokeWidth} />
    }
    default:
      return <circle r={r} fill={fill} stroke={stroke} strokeWidth={strokeWidth} />
  }
}

export default function BanetMap() {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [showHypothesis, setShowHypothesis] = useState(true)
  const [selected, setSelected] = useState(null)
  const [hoveredNode, setHoveredNode] = useState(null)
  const [catFilter, setCatFilter] = useState(() => {
    const f = {}; for (const k of Object.keys(CATEGORY_META)) f[k] = true
    return f
  })

  useEffect(() => {
    fetch(import.meta.env.BASE_URL + 'data/visionium.json')
      .then(r => { if (!r.ok) throw new Error('failed: ' + r.status); return r.json() })
      .then(setData)
      .catch(e => setError(e.message))
  }, [])

  const toggleCat = useCallback((cat) => {
    setCatFilter(prev => ({ ...prev, [cat]: !prev[cat] }))
  }, [])

  if (error) return <div style={{ padding: 24, color: '#ef476f' }}>❌ {error}</div>
  if (!data) return <div style={{ padding: 24 }}>loading…</div>

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <Header meta={data.meta} showHypothesis={showHypothesis} onToggleHypothesis={setShowHypothesis}
        catFilter={catFilter} onToggleCat={toggleCat} />
      <main style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        <Graph
          nodes={data.nodes}
          relations={data.relations}
          showHypothesis={showHypothesis}
          catFilter={catFilter}
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

/* ── Header ── */
function Header({ meta, showHypothesis, onToggleHypothesis, catFilter, onToggleCat }) {
  return (
    <header style={{
      padding: '10px 20px',
      borderBottom: '1px solid #1e2640',
      display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap',
      background: '#0b0f1a', zIndex: 5,
    }}>
      <div style={{ fontSize: 20, fontWeight: 700, whiteSpace: 'nowrap' }}>🌀 バネットマップ</div>
      <div style={{ fontSize: 13, color: '#8892b0' }}>{meta?.title}</div>

      {/* Category filter chips */}
      <div style={{ display: 'flex', gap: 6, marginLeft: 12 }}>
        {Object.entries(CATEGORY_META).map(([k, v]) => (
          <button key={k} onClick={() => onToggleCat(k)} style={{
            padding: '3px 10px', fontSize: 11, fontWeight: 600,
            borderRadius: 12, cursor: 'pointer', border: 'none',
            background: catFilter[k] ? v.color : '#1e2640',
            color: catFilter[k] ? '#0b0f1a' : '#5a6378',
            transition: 'all .2s',
          }}>{v.label}</button>
        ))}
      </div>

      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 12 }}>
        <label style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', color: showHypothesis ? '#e4e8f0' : '#5a6378' }}>
          <input type="checkbox" checked={showHypothesis} onChange={(e) => onToggleHypothesis(e.target.checked)} style={{ accentColor: '#ef476f' }} />
          仮説edge
        </label>
        <a href="https://github.com/osakenpiro/banet-map" target="_blank" rel="noreferrer" style={{ color: '#8892b0', fontSize: 12, textDecoration: 'none' }}>GitHub</a>
        <a href="https://osakenpiro.github.io/wakkazukan/" target="_blank" rel="noreferrer" style={{ color: '#06d6a0', fontSize: 12, textDecoration: 'none' }}>🪐 わっかずかん</a>
        <div style={{ fontSize: 11, padding: '3px 10px', background: '#ffd166', color: '#0b0f1a', borderRadius: 12, fontWeight: 700 }}>β</div>
      </div>
    </header>
  )
}

/* ── Graph ── */
function Graph({ nodes, relations, showHypothesis, catFilter, onPickNode, onPickEdge, onHoverNode, hoveredNodeId }) {
  const svgRef = useRef(null)
  const gRef = useRef(null)
  const wrapRef = useRef(null)
  const simRef = useRef(null)
  const zoomRef = useRef(null)

  // Compute degree for auto-sizing
  const degreeMap = useMemo(() => {
    const m = {}
    nodes.forEach(n => { m[n.id] = 0 })
    relations.forEach(r => {
      m[r.source] = (m[r.source] || 0) + 1
      m[r.target] = (m[r.target] || 0) + 1
    })
    return m
  }, [nodes, relations])

  const simNodes = useMemo(() => nodes.map(n => {
    const deg = degreeMap[n.id] || 0
    const autoR = R_MIN + deg * R_SCALE
    const r = n.attrs?.radius ? Math.max(n.attrs.radius, autoR) : autoR
    return { ...n, _r: r }
  }), [nodes, degreeMap])

  const simLinks = useMemo(() => relations.map(r => ({ ...r })), [relations])

  // Group edges by pair for multi-edge offset
  const edgePairMap = useMemo(() => {
    const m = {}
    relations.forEach(r => {
      const key = [r.source, r.target].sort().join('|')
      if (!m[key]) m[key] = []
      m[key].push(r.id)
    })
    return m
  }, [relations])

  const [, setTick] = useState(0)
  const [transform, setTransform] = useState({ x: 0, y: 0, k: 1 })

  // Force simulation
  useEffect(() => {
    const w = wrapRef.current?.clientWidth || 800
    const h = wrapRef.current?.clientHeight || 600

    const sim = forceSimulation(simNodes)
      .force('link', forceLink(simLinks)
        .id(d => d.id)
        .distance(d => 100 + (1 - (d.weight || 0.5)) * 80)
        .strength(d => (d.weight || 0.5) * 0.9))
      .force('charge', forceManyBody().strength(-480))
      .force('center', forceCenter(w / 2, h / 2))
      .force('collide', forceCollide().radius(d => (d._r || 20) + 8).strength(0.8))
      .alphaDecay(0.02)
      .velocityDecay(0.35)
      .on('tick', () => setTick(t => t + 1))

    simRef.current = sim
    return () => sim.stop()
  }, [simNodes, simLinks])

  // d3-zoom
  useEffect(() => {
    if (!svgRef.current) return
    const svg = select(svgRef.current)
    const zoomBehavior = d3Zoom()
      .scaleExtent([0.15, 5])
      .on('zoom', (e) => {
        const t = e.transform
        setTransform({ x: t.x, y: t.y, k: t.k })
      })
    svg.call(zoomBehavior)
    zoomRef.current = zoomBehavior

    // Prevent zoom from interfering with node drag
    svg.on('dblclick.zoom', null)

    return () => { svg.on('.zoom', null) }
  }, [])

  // Resize
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

  // Drag
  const dragState = useRef(null)
  const onPointerDownNode = (e, d) => {
    e.stopPropagation()
    if (!simRef.current) return
    simRef.current.alphaTarget(0.3).restart()
    d.fx = d.x; d.fy = d.y
    const k = transform.k
    dragState.current = { node: d, startX: e.clientX, startY: e.clientY, origX: d.x, origY: d.y, moved: false, k }
    try { e.currentTarget.setPointerCapture(e.pointerId) } catch {}
  }
  const onPointerMoveNode = (e) => {
    const ds = dragState.current
    if (!ds) return
    const dx = (e.clientX - ds.startX) / ds.k
    const dy = (e.clientY - ds.startY) / ds.k
    ds.node.fx = ds.origX + dx
    ds.node.fy = ds.origY + dy
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) ds.moved = true
  }
  const onPointerUpNode = (e, d) => {
    const ds = dragState.current
    if (!ds) return
    if (simRef.current) simRef.current.alphaTarget(0)
    d.fx = null; d.fy = null
    if (!ds.moved) onPickNode(nodes.find(n => n.id === d.id))
    dragState.current = null
    try { e.currentTarget.releasePointerCapture(e.pointerId) } catch {}
  }

  // Visibility
  const edgeIsRelated = (link) => {
    if (!hoveredNodeId) return true
    const sid = typeof link.source === 'object' ? link.source.id : link.source
    const tid = typeof link.target === 'object' ? link.target.id : link.target
    return sid === hoveredNodeId || tid === hoveredNodeId
  }

  const nodeVisible = (n) => catFilter[n.attrs?.category] !== false
  const visibleNodeIds = new Set(simNodes.filter(nodeVisible).map(n => n.id))

  const visibleLinks = simLinks.filter(l => {
    if (!showHypothesis && l.status === 'hypothesis') return false
    const sid = typeof l.source === 'object' ? l.source.id : l.source
    const tid = typeof l.target === 'object' ? l.target.id : l.target
    return visibleNodeIds.has(sid) && visibleNodeIds.has(tid)
  })

  return (
    <div ref={wrapRef} style={{ position: 'absolute', inset: 0 }}>
      <svg
        ref={svgRef}
        width="100%" height="100%"
        style={{ display: 'block', userSelect: 'none', touchAction: 'none', background: '#0b0f1a' }}
      >
        <defs>
          {Object.entries(KIND_STYLE).map(([k, s]) => (
            <marker key={k} id={`arrow-${k}`} viewBox="0 -5 10 10" refX="10" refY="0"
              markerWidth="6" markerHeight="6" orient="auto">
              <path d="M0,-5L10,0L0,5" fill={s.color} />
            </marker>
          ))}
        </defs>

        <g transform={`translate(${transform.x},${transform.y}) scale(${transform.k})`}>
          {/* Edges */}
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
              const tr = (l.target._r || 20) + 4
              const dx = tx - sx, dy = ty - sy
              const len = Math.hypot(dx, dy) || 1

              // Multi-edge offset
              const pairKey = [l.source.id, l.target.id].sort().join('|')
              const siblings = edgePairMap[pairKey] || [l.id]
              const idx = siblings.indexOf(l.id)
              const total = siblings.length
              const offset = total <= 1 ? 0 : (idx - (total - 1) / 2) * 22

              // Perpendicular direction for offset
              const nx = -dy / len, ny = dx / len

              if (total > 1) {
                // Curved path for multi-edges
                const mx = (sx + tx) / 2 + nx * offset * 2.5
                const my = (sy + ty) / 2 + ny * offset * 2.5
                // Shorten end by target radius
                const d2x = tx - mx, d2y = ty - my
                const len2 = Math.hypot(d2x, d2y) || 1
                const ex = tx - (d2x / len2) * tr
                const ey = ty - (d2y / len2) * tr
                const pathD = `M${sx},${sy} Q${mx},${my} ${ex},${ey}`
                return (
                  <g key={l.id} style={{ cursor: 'pointer' }} onClick={(e) => { e.stopPropagation(); onPickEdge(l) }}>
                    <path d={pathD} fill="none"
                      stroke={stroke}
                      strokeWidth={1 + (l.weight || 0.5) * 3}
                      strokeOpacity={dim ? 0.08 : (refuted ? 0.4 : 0.7)}
                      strokeDasharray={dashed ? '6 5' : refuted ? '2 4' : undefined}
                      markerEnd={refuted ? undefined : `url(#arrow-${l.kind})`}
                    />
                    <path d={pathD} fill="none" stroke="transparent" strokeWidth="14" />
                  </g>
                )
              }

              // Single straight edge
              const ex = tx - (dx / len) * tr
              const ey = ty - (dy / len) * tr
              return (
                <g key={l.id} style={{ cursor: 'pointer' }} onClick={(e) => { e.stopPropagation(); onPickEdge(l) }}>
                  <line x1={sx} y1={sy} x2={ex} y2={ey}
                    stroke={stroke}
                    strokeWidth={1 + (l.weight || 0.5) * 3}
                    strokeOpacity={dim ? 0.08 : (refuted ? 0.4 : 0.7)}
                    strokeDasharray={dashed ? '6 5' : refuted ? '2 4' : undefined}
                    markerEnd={refuted ? undefined : `url(#arrow-${l.kind})`}
                  />
                  <line x1={sx} y1={sy} x2={ex} y2={ey} stroke="transparent" strokeWidth="14" />
                </g>
              )
            })}
          </g>

          {/* Nodes */}
          <g>
            {simNodes.map(d => {
              if (!nodeVisible(d)) return null
              const r = d._r
              const color = d.attrs?.color || '#8892b0'
              const isHovered = hoveredNodeId === d.id
              const cat = d.attrs?.category
              const shape = CATEGORY_META[cat]?.shape || 'circle'
              const deg = degreeMap[d.id] || 0
              // Glow for high-degree nodes
              const glowR = deg >= 6 ? r + 6 : 0
              return (
                <g key={d.id}
                  transform={`translate(${d.x || 0},${d.y || 0})`}
                  style={{ cursor: 'grab' }}
                  onPointerDown={(e) => onPointerDownNode(e, d)}
                  onPointerMove={onPointerMoveNode}
                  onPointerUp={(e) => onPointerUpNode(e, d)}
                  onPointerEnter={() => onHoverNode(d)}
                  onPointerLeave={() => onHoverNode(null)}
                >
                  {/* Glow halo for hub nodes */}
                  {glowR > 0 && (
                    <circle r={glowR} fill="none" stroke={color} strokeWidth={1.2}
                      strokeOpacity={0.25} style={{ filter: `drop-shadow(0 0 ${deg}px ${color})` }} />
                  )}

                  <NodeShape shape={shape} r={r} fill="#111827"
                    stroke={color} strokeWidth={isHovered ? 4 : 2.5} />

                  <text textAnchor="middle" dominantBaseline="central"
                    fontSize={r * 0.85} style={{ pointerEvents: 'none' }}>
                    {d.icon || '·'}
                  </text>

                  <text y={r + 14} textAnchor="middle" fontSize="11"
                    fill="#e4e8f0" fontWeight="600"
                    style={{ pointerEvents: 'none', paintOrder: 'stroke', stroke: '#0b0f1a', strokeWidth: 3 }}>
                    {d.name}
                  </text>

                  {/* Degree badge */}
                  <g transform={`translate(${r - 2},${-r + 2})`}>
                    <circle r={7} fill="#1e2640" stroke={color} strokeWidth={1} />
                    <text textAnchor="middle" dominantBaseline="central" fontSize="8"
                      fill="#e4e8f0" fontWeight="700" style={{ pointerEvents: 'none' }}>
                      {deg}
                    </text>
                  </g>
                </g>
              )
            })}
          </g>
        </g>
      </svg>

      {/* Zoom controls */}
      <div style={{
        position: 'absolute', bottom: 16, right: 16,
        display: 'flex', flexDirection: 'column', gap: 4,
      }}>
        <ZoomBtn label="＋" onClick={() => {
          if (!svgRef.current || !zoomRef.current) return
          select(svgRef.current).transition().duration(250)
            .call(zoomRef.current.scaleBy, 1.4)
        }} />
        <ZoomBtn label="⟲" onClick={() => {
          if (!svgRef.current || !zoomRef.current) return
          select(svgRef.current).transition().duration(350)
            .call(zoomRef.current.transform, zoomIdentity)
        }} />
        <ZoomBtn label="−" onClick={() => {
          if (!svgRef.current || !zoomRef.current) return
          select(svgRef.current).transition().duration(250)
            .call(zoomRef.current.scaleBy, 0.7)
        }} />
      </div>
    </div>
  )
}

function ZoomBtn({ label, onClick }) {
  return (
    <button onClick={onClick} style={{
      width: 36, height: 36, borderRadius: 8,
      background: 'rgba(17,24,39,0.85)', border: '1px solid #1e2640',
      color: '#e4e8f0', fontSize: 16, cursor: 'pointer',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      backdropFilter: 'blur(6px)',
    }}>{label}</button>
  )
}

/* ── Legend ── */
function Legend() {
  return (
    <div style={{
      position: 'absolute', bottom: 16, left: 16,
      background: 'rgba(17, 24, 39, 0.85)',
      border: '1px solid #1e2640', borderRadius: 8,
      padding: '10px 14px', fontSize: 11, lineHeight: 1.6,
      color: '#c4c9d4', backdropFilter: 'blur(6px)', maxWidth: 260,
    }}>
      <div style={{ fontWeight: 700, marginBottom: 6, color: '#e4e8f0' }}>凡例</div>

      <div style={{ fontSize: 10, color: '#8892b0', marginBottom: 4 }}>── 線のタイプ ──</div>
      {Object.entries(KIND_STYLE).map(([k, s]) => (
        <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ display: 'inline-block', width: 20, height: 2, background: s.color, borderRadius: 2 }} />
          <span>{s.label}</span>
        </div>
      ))}

      <div style={{ fontSize: 10, color: '#8892b0', marginTop: 8, marginBottom: 4 }}>── ノードの形 ──</div>
      {Object.entries(CATEGORY_META).map(([, v]) => (
        <div key={v.label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ color: v.color, fontSize: 12, fontWeight: 700 }}>
            {v.shape === 'circle' ? '●' : v.shape === 'square' ? '■' : v.shape === 'diamond' ? '◆' : '⬡'}
          </span>
          <span>{v.label}</span>
        </div>
      ))}

      <div style={{ borderTop: '1px solid #1e2640', marginTop: 8, paddingTop: 6, fontSize: 10, color: '#8892b0' }}>
        点線 = 仮説 · 実線 = 確定<br />
        線の太さ = weight (Float)<br />
        ノードサイズ = 接続数(自動) · 右上=degree<br />
        ホイールでズーム · 背景ドラッグでパン<br />
        ノードをドラッグ可 · クリックで詳細
      </div>
    </div>
  )
}

/* ── DetailCard ── */
function DetailCard({ data, onClose, allNodes }) {
  const isNode = data.type === 'node'
  const p = data.payload
  return (
    <div style={{
      position: 'absolute', top: 16, right: 16, width: 340,
      maxHeight: 'calc(100% - 32px)', overflowY: 'auto',
      background: 'rgba(17, 24, 39, 0.95)',
      border: '1px solid #1e2640', borderRadius: 12,
      padding: 18, fontSize: 13, color: '#e4e8f0',
      boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
      backdropFilter: 'blur(8px)',
    }}>
      <button onClick={onClose} style={{
        position: 'absolute', top: 10, right: 10,
        background: 'transparent', border: 'none',
        color: '#8892b0', fontSize: 18, cursor: 'pointer',
      }}>×</button>
      {isNode ? <NodeCardDetail node={p} /> : <EdgeCard edge={p} allNodes={allNodes} />}
    </div>
  )
}

function NodeCardDetail({ node }) {
  const color = node.attrs?.color || '#8892b0'
  const cat = CATEGORY_META[node.attrs?.category]?.label || node.attrs?.category
  const shape = CATEGORY_META[node.attrs?.category]?.shape || 'circle'
  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        <div style={{ fontSize: 32 }}>{node.icon}</div>
        <div>
          <div style={{ fontSize: 18, fontWeight: 700 }}>{node.name}</div>
          <div style={{ fontSize: 11, color, fontWeight: 600 }}>
            {cat} · {shape === 'circle' ? '●' : shape === 'square' ? '■' : shape === 'diamond' ? '◆' : '⬡'}
          </div>
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
