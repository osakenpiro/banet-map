import { useEffect, useRef, useState, useMemo, useCallback } from 'react'
import {
  forceSimulation, forceLink, forceManyBody, forceCenter, forceCollide,
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
const R_MIN = 14, R_SCALE = 3.2

function NodeShape({ shape, r, fill, stroke, strokeWidth }) {
  switch (shape) {
    case 'square': { const s = r * 1.6; return <rect x={-s/2} y={-s/2} width={s} height={s} rx={3} fill={fill} stroke={stroke} strokeWidth={strokeWidth} /> }
    case 'diamond': { const s = r * 1.5; return <polygon points={`0,${-s} ${s},0 0,${s} ${-s},0`} fill={fill} stroke={stroke} strokeWidth={strokeWidth} /> }
    case 'hexagon': {
      const pts = Array.from({length:6},(_,i)=>{const a=Math.PI/6+i*Math.PI/3;return `${Math.cos(a)*r*1.3},${Math.sin(a)*r*1.3}`}).join(' ')
      return <polygon points={pts} fill={fill} stroke={stroke} strokeWidth={strokeWidth} />
    }
    default: return <circle r={r} fill={fill} stroke={stroke} strokeWidth={strokeWidth} />
  }
}

export default function BanetMap() {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [showHypothesis, setShowHypothesis] = useState(true)
  const [hoveredNode, setHoveredNode] = useState(null)
  const [hoveredEdge, setHoveredEdge] = useState(null)
  const [focus, setFocus] = useState([])
  const [catFilter, setCatFilter] = useState(() => {
    const f = {}; for (const k of Object.keys(CATEGORY_META)) f[k] = true; return f
  })

  useEffect(() => {
    fetch(import.meta.env.BASE_URL + 'data/visionium.json')
      .then(r => { if (!r.ok) throw new Error('failed: ' + r.status); return r.json() })
      .then(setData).catch(e => setError(e.message))
  }, [])

  const toggleCat = useCallback((cat) => setCatFilter(prev => ({ ...prev, [cat]: !prev[cat] })), [])

  const handleNodeFocus = useCallback((id) => {
    setFocus(prev => {
      if (prev.length === 0) return [id]
      if (prev.length === 1 && prev[0] === id) return []
      if (prev.length === 1) return [prev[0], id]
      return [id]
    })
  }, [])
  const clearFocus = useCallback(() => setFocus([]), [])

  if (error) return <div style={{ padding: 24, color: '#ef476f' }}>❌ {error}</div>
  if (!data) return <div style={{ padding: 24 }}>loading…</div>

  const phase = focus.length

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <Header meta={data.meta} showHypothesis={showHypothesis} onToggleHypothesis={setShowHypothesis}
        catFilter={catFilter} onToggleCat={toggleCat} phase={phase} onClearFocus={clearFocus} />
      <main style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        <Graph
          nodes={data.nodes} relations={data.relations}
          showHypothesis={showHypothesis} catFilter={catFilter}
          focus={focus} onNodeFocus={handleNodeFocus} onClearFocus={clearFocus}
          onHoverNode={setHoveredNode} hoveredNodeId={hoveredNode?.id}
          onHoverEdge={setHoveredEdge}
        />
        <Legend phase={phase} />
        {phase > 0 && (
          <FocusPanel focus={focus} allNodes={data.nodes} relations={data.relations} onClear={clearFocus} />
        )}
        {hoveredEdge && phase === 0 && <EdgeTooltip data={hoveredEdge} allNodes={data.nodes} />}
      </main>
    </div>
  )
}

function Header({ meta, showHypothesis, onToggleHypothesis, catFilter, onToggleCat, phase, onClearFocus }) {
  return (
    <header style={{
      padding: '10px 20px', borderBottom: '1px solid #1e2640',
      display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap',
      background: '#0b0f1a', zIndex: 5,
    }}>
      <div style={{ fontSize: 20, fontWeight: 700, whiteSpace: 'nowrap' }}>🌀 バネットマップ</div>
      <div style={{ fontSize: 13, color: '#8892b0' }}>{meta?.title}</div>
      <div style={{ display: 'flex', gap: 6, marginLeft: 12 }}>
        {Object.entries(CATEGORY_META).map(([k, v]) => (
          <button key={k} onClick={() => onToggleCat(k)} style={{
            padding: '3px 10px', fontSize: 11, fontWeight: 600, borderRadius: 12,
            cursor: 'pointer', border: 'none', transition: 'all .2s',
            background: catFilter[k] ? v.color : '#1e2640',
            color: catFilter[k] ? '#0b0f1a' : '#5a6378',
          }}>{v.label}</button>
        ))}
      </div>
      {phase > 0 && (
        <button onClick={onClearFocus} style={{
          padding: '3px 12px', fontSize: 11, fontWeight: 600, borderRadius: 12,
          cursor: 'pointer', border: '1px solid #ef476f', background: 'transparent',
          color: '#ef476f', marginLeft: 8,
        }}>✕ 解除</button>
      )}
      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 12 }}>
        <label style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', color: showHypothesis ? '#e4e8f0' : '#5a6378' }}>
          <input type="checkbox" checked={showHypothesis} onChange={(e) => onToggleHypothesis(e.target.checked)} style={{ accentColor: '#ef476f' }} />
          仮説
        </label>
        <a href="https://github.com/osakenpiro/banet-map" target="_blank" rel="noreferrer" style={{ color: '#8892b0', fontSize: 12, textDecoration: 'none' }}>GitHub</a>
        <a href="https://osakenpiro.github.io/wakkazukan/" target="_blank" rel="noreferrer" style={{ color: '#06d6a0', fontSize: 12, textDecoration: 'none' }}>🪐 わっかずかん</a>
        <div style={{ fontSize: 11, padding: '3px 10px', background: '#ffd166', color: '#0b0f1a', borderRadius: 12, fontWeight: 700 }}>β</div>
      </div>
    </header>
  )
}

function Graph({ nodes, relations, showHypothesis, catFilter, focus, onNodeFocus, onClearFocus, onHoverNode, hoveredNodeId, onHoverEdge }) {
  const svgRef = useRef(null), wrapRef = useRef(null), simRef = useRef(null), zoomRef = useRef(null)

  const degreeMap = useMemo(() => {
    const m = {}; nodes.forEach(n => { m[n.id] = 0 })
    relations.forEach(r => { m[r.source] = (m[r.source]||0)+1; m[r.target] = (m[r.target]||0)+1 })
    return m
  }, [nodes, relations])

  const simNodes = useMemo(() => nodes.map(n => {
    const deg = degreeMap[n.id]||0, autoR = R_MIN + deg * R_SCALE
    return { ...n, _r: n.attrs?.radius ? Math.max(n.attrs.radius, autoR) : autoR }
  }), [nodes, degreeMap])

  const simLinks = useMemo(() => relations.map(r => ({ ...r })), [relations])

  const edgePairMap = useMemo(() => {
    const m = {}
    relations.forEach(r => { const k = [r.source,r.target].sort().join('|'); if(!m[k])m[k]=[]; m[k].push(r.id) })
    return m
  }, [relations])

  const neighborSet = useMemo(() => {
    if (!focus.length) return null
    const s = new Set(focus)
    relations.forEach(r => {
      const sid = typeof r.source === 'string' ? r.source : r.source?.id
      const tid = typeof r.target === 'string' ? r.target : r.target?.id
      if (focus.includes(sid)) s.add(tid)
      if (focus.includes(tid)) s.add(sid)
    })
    return s
  }, [focus, relations])

  const [, setTick] = useState(0)
  const [transform, setTransform] = useState({ x:0, y:0, k:1 })

  useEffect(() => {
    const w = wrapRef.current?.clientWidth||800, h = wrapRef.current?.clientHeight||600
    const sim = forceSimulation(simNodes)
      .force('link', forceLink(simLinks).id(d=>d.id).distance(d=>100+(1-(d.weight||0.5))*80).strength(d=>(d.weight||0.5)*0.9))
      .force('charge', forceManyBody().strength(-480))
      .force('center', forceCenter(w/2, h/2))
      .force('collide', forceCollide().radius(d=>(d._r||20)+8).strength(0.8))
      .alphaDecay(0.02).velocityDecay(0.35).on('tick', () => setTick(t=>t+1))
    simRef.current = sim
    return () => sim.stop()
  }, [simNodes, simLinks])

  useEffect(() => {
    if (!svgRef.current) return
    const svg = select(svgRef.current)
    const zb = d3Zoom().scaleExtent([0.15,5]).on('zoom', e => { const t=e.transform; setTransform({x:t.x,y:t.y,k:t.k}) })
    svg.call(zb); svg.on('dblclick.zoom', null); zoomRef.current = zb
    return () => { svg.on('.zoom', null) }
  }, [])

  // Auto-zoom on focus change
  useEffect(() => {
    if (!svgRef.current || !zoomRef.current || !wrapRef.current) return
    if (!focus.length) {
      select(svgRef.current).transition().duration(400).call(zoomRef.current.transform, zoomIdentity)
      return
    }
    const targets = simNodes.filter(n => focus.includes(n.id))
    if (!targets.length || targets.some(t => t.x == null)) return
    const w = wrapRef.current.clientWidth, h = wrapRef.current.clientHeight

    if (targets.length === 1) {
      const n = targets[0], k = 2.0
      select(svgRef.current).transition().duration(500)
        .call(zoomRef.current.transform, zoomIdentity.translate(w/2-n.x*k, h/2-n.y*k).scale(k))
    } else {
      const xs = targets.map(t=>t.x), ys = targets.map(t=>t.y)
      const cx = (Math.min(...xs)+Math.max(...xs))/2, cy = (Math.min(...ys)+Math.max(...ys))/2
      const k = Math.min(w/(Math.abs(xs[0]-xs[1])+200), h/(Math.abs(ys[0]-ys[1])+200), 2.5)
      select(svgRef.current).transition().duration(500)
        .call(zoomRef.current.transform, zoomIdentity.translate(w/2-cx*k, h/2-cy*k).scale(k))
    }
  }, [focus, simNodes])

  useEffect(() => {
    const onResize = () => {
      if (!simRef.current || !wrapRef.current) return
      simRef.current.force('center', forceCenter(wrapRef.current.clientWidth/2, wrapRef.current.clientHeight/2))
      simRef.current.alpha(0.4).restart()
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  const dragState = useRef(null)
  const onPD = (e,d) => {
    e.stopPropagation(); if(!simRef.current) return
    simRef.current.alphaTarget(0.3).restart(); d.fx=d.x; d.fy=d.y
    dragState.current = {node:d,startX:e.clientX,startY:e.clientY,origX:d.x,origY:d.y,moved:false,k:transform.k}
    try{e.currentTarget.setPointerCapture(e.pointerId)}catch{}
  }
  const onPM = (e) => {
    const ds=dragState.current; if(!ds) return
    const dx=(e.clientX-ds.startX)/ds.k, dy=(e.clientY-ds.startY)/ds.k
    ds.node.fx=ds.origX+dx; ds.node.fy=ds.origY+dy
    if(Math.abs(dx)>3||Math.abs(dy)>3) ds.moved=true
  }
  const onPU = (e,d) => {
    const ds=dragState.current; if(!ds) return
    if(simRef.current) simRef.current.alphaTarget(0)
    d.fx=null; d.fy=null
    if(!ds.moved) onNodeFocus(d.id)
    dragState.current=null
    try{e.currentTarget.releasePointerCapture(e.pointerId)}catch{}
  }

  const phase = focus.length
  const focusSet = new Set(focus)

  const getEdgeOp = (l) => {
    const sid = typeof l.source==='object'?l.source.id:l.source
    const tid = typeof l.target==='object'?l.target.id:l.target
    if (phase===2) {
      if (focusSet.has(sid)&&focusSet.has(tid)) return 1.0
      if (focusSet.has(sid)||focusSet.has(tid)) return 0.15
      return 0.03
    }
    if (phase===1) {
      if (focusSet.has(sid)||focusSet.has(tid)) return 0.8
      return 0.04
    }
    if (!hoveredNodeId) return l.status==='refuted'?0.4:0.7
    if (sid===hoveredNodeId||tid===hoveredNodeId) return 0.8
    return 0.08
  }

  const getNodeOp = (id) => {
    if (phase===2) { if(focusSet.has(id)) return 1.0; if(neighborSet?.has(id)) return 0.35; return 0.08 }
    if (phase===1) { if(focusSet.has(id)) return 1.0; if(neighborSet?.has(id)) return 0.7; return 0.1 }
    return 1.0
  }

  const nodeVisible = (n) => catFilter[n.attrs?.category] !== false
  const visIds = new Set(simNodes.filter(nodeVisible).map(n=>n.id))
  const visibleLinks = simLinks.filter(l => {
    if (!showHypothesis && l.status==='hypothesis') return false
    const sid = typeof l.source==='object'?l.source.id:l.source
    const tid = typeof l.target==='object'?l.target.id:l.target
    return visIds.has(sid) && visIds.has(tid)
  })

  return (
    <div ref={wrapRef} style={{ position:'absolute', inset:0 }}>
      <svg ref={svgRef} width="100%" height="100%"
        style={{ display:'block', userSelect:'none', touchAction:'none', background:'#0b0f1a' }}
        onClick={() => { if(focus.length>0) onClearFocus() }}
      >
        <defs>
          {Object.entries(KIND_STYLE).map(([k,s]) => (
            <marker key={k} id={`arrow-${k}`} viewBox="0 -5 10 10" refX="10" refY="0" markerWidth="6" markerHeight="6" orient="auto">
              <path d="M0,-5L10,0L0,5" fill={s.color} />
            </marker>
          ))}
        </defs>
        <g transform={`translate(${transform.x},${transform.y}) scale(${transform.k})`}>
          <g>{visibleLinks.map(l => {
            if (typeof l.source!=='object'||typeof l.target!=='object') return null
            const style = KIND_STYLE[l.kind]||{color:'#8892b0'}
            const dashed = l.status==='hypothesis', refuted = l.status==='refuted'
            const stroke = refuted?'#5a6378':style.color, opacity = getEdgeOp(l)
            const sx=l.source.x,sy=l.source.y,tx=l.target.x,ty=l.target.y
            const tr=(l.target._r||20)+4, dx=tx-sx, dy=ty-sy, len=Math.hypot(dx,dy)||1
            const pairKey=[l.source.id,l.target.id].sort().join('|')
            const siblings=edgePairMap[pairKey]||[l.id], idx=siblings.indexOf(l.id), total=siblings.length
            const offset=total<=1?0:(idx-(total-1)/2)*22, nx=-dy/len, ny=dx/len
            const isFP = phase===2&&focusSet.has(l.source.id)&&focusSet.has(l.target.id)
            const sw = (1+(l.weight||0.5)*3)*(isFP?2.5:1)
            const dash = dashed?'6 5':refuted?'2 4':undefined
            const me = refuted?undefined:`url(#arrow-${l.kind})`

            if (total>1) {
              const mx=(sx+tx)/2+nx*offset*2.5, my=(sy+ty)/2+ny*offset*2.5
              const d2x=tx-mx, d2y=ty-my, len2=Math.hypot(d2x,d2y)||1
              const ex=tx-(d2x/len2)*tr, ey=ty-(d2y/len2)*tr
              const pathD=`M${sx},${sy} Q${mx},${my} ${ex},${ey}`
              return <g key={l.id} style={{cursor:'pointer'}} onClick={e=>e.stopPropagation()}
                onPointerEnter={e=>onHoverEdge({edge:l,x:e.clientX,y:e.clientY})}
                onPointerMove={e=>onHoverEdge({edge:l,x:e.clientX,y:e.clientY})}
                onPointerLeave={()=>onHoverEdge(null)}>
                <path d={pathD} fill="none" stroke={stroke} strokeWidth={sw} strokeOpacity={opacity} strokeDasharray={dash} markerEnd={me}/>
                <path d={pathD} fill="none" stroke="transparent" strokeWidth="14"/>
              </g>
            }
            const ex=tx-(dx/len)*tr, ey=ty-(dy/len)*tr
            return <g key={l.id} style={{cursor:'pointer'}} onClick={e=>e.stopPropagation()}
              onPointerEnter={e=>onHoverEdge({edge:l,x:e.clientX,y:e.clientY})}
              onPointerMove={e=>onHoverEdge({edge:l,x:e.clientX,y:e.clientY})}
              onPointerLeave={()=>onHoverEdge(null)}>
              <line x1={sx} y1={sy} x2={ex} y2={ey} stroke={stroke} strokeWidth={sw} strokeOpacity={opacity} strokeDasharray={dash} markerEnd={me}/>
              <line x1={sx} y1={sy} x2={ex} y2={ey} stroke="transparent" strokeWidth="14"/>
            </g>
          })}</g>

          <g>{simNodes.map(d => {
            if (!nodeVisible(d)) return null
            const r=d._r, color=d.attrs?.color||'#8892b0'
            const isH=hoveredNodeId===d.id, isF=focusSet.has(d.id)
            const shape=CATEGORY_META[d.attrs?.category]?.shape||'circle'
            const deg=degreeMap[d.id]||0, op=getNodeOp(d.id)
            const glowR = isF&&phase>0 ? r+10 : deg>=6 ? r+6 : 0

            return <g key={d.id} transform={`translate(${d.x||0},${d.y||0})`}
              style={{ cursor:'grab', opacity:op, transition:'opacity 0.3s' }}
              onClick={e => e.stopPropagation()}
              onPointerDown={e=>onPD(e,d)} onPointerMove={onPM} onPointerUp={e=>onPU(e,d)}
              onPointerEnter={()=>onHoverNode(d)} onPointerLeave={()=>onHoverNode(null)}>
              {glowR>0 && <circle r={glowR} fill="none" stroke={isF?'#ffd166':color}
                strokeWidth={isF?2.5:1.2} strokeOpacity={isF?0.6:0.25}
                style={{filter:`drop-shadow(0 0 ${isF?12:deg}px ${isF?'#ffd166':color})`}}/>}
              <NodeShape shape={shape} r={r} fill={isF?'#1a1f35':'#111827'}
                stroke={isF?'#ffd166':color} strokeWidth={isF?4:isH?3.5:2.5}/>
              <text textAnchor="middle" dominantBaseline="central" fontSize={r*0.85}
                style={{pointerEvents:'none'}}>{d.icon||'·'}</text>
              <text y={r+14} textAnchor="middle" fontSize="11"
                fill={isF?'#ffd166':'#e4e8f0'} fontWeight="600"
                style={{pointerEvents:'none',paintOrder:'stroke',stroke:'#0b0f1a',strokeWidth:3}}>
                {d.name}</text>
              <g transform={`translate(${r-2},${-r+2})`}>
                <circle r={7} fill="#1e2640" stroke={color} strokeWidth={1}/>
                <text textAnchor="middle" dominantBaseline="central" fontSize="8"
                  fill="#e4e8f0" fontWeight="700" style={{pointerEvents:'none'}}>{deg}</text>
              </g>
            </g>
          })}</g>
        </g>
      </svg>
      <div style={{position:'absolute',bottom:16,right:16,display:'flex',flexDirection:'column',gap:4}}>
        <ZoomBtn label="＋" onClick={()=>{if(svgRef.current&&zoomRef.current)select(svgRef.current).transition().duration(250).call(zoomRef.current.scaleBy,1.4)}}/>
        <ZoomBtn label="⟲" onClick={()=>{if(svgRef.current&&zoomRef.current)select(svgRef.current).transition().duration(350).call(zoomRef.current.transform,zoomIdentity)}}/>
        <ZoomBtn label="−" onClick={()=>{if(svgRef.current&&zoomRef.current)select(svgRef.current).transition().duration(250).call(zoomRef.current.scaleBy,0.7)}}/>
      </div>
    </div>
  )
}

function ZoomBtn({label,onClick}) {
  return <button onClick={onClick} style={{width:36,height:36,borderRadius:8,background:'rgba(17,24,39,0.85)',border:'1px solid #1e2640',color:'#e4e8f0',fontSize:16,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',backdropFilter:'blur(6px)'}}>{label}</button>
}

function FocusPanel({ focus, allNodes, relations, onClear }) {
  const phase = focus.length
  const nodeA = allNodes.find(n=>n.id===focus[0])
  const nodeB = phase===2 ? allNodes.find(n=>n.id===focus[1]) : null
  const colorA = nodeA?.attrs?.color||'#8892b0'

  const pairEdges = phase===2 ? relations.filter(r => {
    const sid=typeof r.source==='object'?r.source.id:r.source
    const tid=typeof r.target==='object'?r.target.id:r.target
    return (sid===focus[0]&&tid===focus[1])||(sid===focus[1]&&tid===focus[0])
  }) : []

  const connections = phase===1 ? relations.filter(r => {
    const sid=typeof r.source==='object'?r.source.id:r.source
    const tid=typeof r.target==='object'?r.target.id:r.target
    return sid===focus[0]||tid===focus[0]
  }) : []

  return (
    <div style={{
      position:'absolute',bottom:16,left:'50%',transform:'translateX(-50%)',
      background:'rgba(17,24,39,0.95)',
      border:`1px solid ${phase===2?'#ffd166':colorA}`,
      borderRadius:14,padding:'14px 20px',fontSize:13,color:'#e4e8f0',
      boxShadow:'0 4px 24px rgba(0,0,0,0.5)',backdropFilter:'blur(8px)',
      maxWidth:560,width:'max-content',zIndex:15,transition:'all 0.3s',
    }}>
      <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:10}}>
        <span style={{fontSize:28}}>{nodeA?.icon}</span>
        <div>
          <div style={{fontSize:16,fontWeight:700}}>{nodeA?.name}</div>
          {nodeA?.attrs?.desc && <div style={{fontSize:11,color:'#8892b0',maxWidth:300}}>{nodeA.attrs.desc}</div>}
        </div>
        {phase===2 && <>
          <span style={{color:'#ffd166',fontSize:20,margin:'0 4px'}}>⇄</span>
          <span style={{fontSize:28}}>{nodeB?.icon}</span>
          <div>
            <div style={{fontSize:16,fontWeight:700}}>{nodeB?.name}</div>
            {nodeB?.attrs?.desc && <div style={{fontSize:11,color:'#8892b0',maxWidth:200}}>{nodeB.attrs.desc}</div>}
          </div>
        </>}
        <button onClick={onClear} style={{marginLeft:'auto',background:'transparent',border:'1px solid #5a6378',color:'#8892b0',fontSize:11,padding:'4px 10px',borderRadius:6,cursor:'pointer'}}>✕</button>
      </div>

      {phase===1 && connections.length>0 && (
        <div style={{display:'flex',flexWrap:'wrap',gap:6,marginTop:4}}>
          {connections.map(e => {
            const sid=typeof e.source==='object'?e.source.id:e.source
            const tid=typeof e.target==='object'?e.target.id:e.target
            const otherId=sid===focus[0]?tid:sid
            const other=allNodes.find(n=>n.id===otherId)
            const st=KIND_STYLE[e.kind]||{label:e.kind,color:'#8892b0'}
            const dir=sid===focus[0]?'→':'←'
            return <div key={e.id} style={{padding:'4px 10px',background:'#0b0f1a',borderRadius:8,borderLeft:`3px solid ${st.color}`,fontSize:11,display:'flex',alignItems:'center',gap:6}}>
              <span style={{color:st.color,fontWeight:600}}>{st.label}</span>
              <span style={{color:'#5a6378'}}>{dir}</span>
              <span>{other?.icon} {other?.name}</span>
              <span style={{color:'#ffd166',fontWeight:600}}>w={e.weight?.toFixed(1)}</span>
            </div>
          })}
        </div>
      )}
      {phase===1 && connections.length===0 && <div style={{color:'#5a6378',fontSize:12,fontStyle:'italic'}}>接続なし</div>}

      {phase===2 && pairEdges.length>0 && (
        <div style={{display:'flex',flexDirection:'column',gap:6}}>
          {pairEdges.map(e => {
            const st=KIND_STYLE[e.kind]||{label:e.kind,color:'#8892b0'}
            const srcId=typeof e.source==='object'?e.source.id:e.source
            const dir=srcId===focus[0]?'→':'←'
            return <div key={e.id} style={{padding:'8px 12px',background:'#0b0f1a',borderRadius:8,borderLeft:`3px solid ${st.color}`}}>
              <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:e.evidence?4:0}}>
                <span style={{color:st.color,fontWeight:700,fontSize:12}}>{st.label}</span>
                <span style={{color:'#5a6378',fontSize:11}}>{dir}</span>
                <span style={{marginLeft:'auto',color:'#ffd166',fontWeight:600}}>w={e.weight?.toFixed(2)}</span>
              </div>
              {e.evidence && <div style={{fontSize:11,color:'#8892b0'}}>{e.evidence}</div>}
            </div>
          })}
        </div>
      )}
      {phase===2 && pairEdges.length===0 && <div style={{color:'#5a6378',fontSize:12,fontStyle:'italic'}}>直接の関係なし（経由ノードは半透明で表示中）</div>}

      <div style={{marginTop:8,fontSize:10,color:'#5a6378'}}>
        {phase===1?'別のノードをクリック → 関係確認モード':'背景クリック or ✕ で解除'}
      </div>
    </div>
  )
}

function EdgeTooltip({ data, allNodes }) {
  const {edge,x,y} = data
  const st = KIND_STYLE[edge.kind]||{label:edge.kind,color:'#8892b0'}
  const src = allNodes.find(n=>n.id===(typeof edge.source==='object'?edge.source.id:edge.source))
  const tgt = allNodes.find(n=>n.id===(typeof edge.target==='object'?edge.target.id:edge.target))
  const emoji = edge.status==='hypothesis'?'🔮':edge.status==='refuted'?'❌':'✅'
  return <div style={{position:'fixed',left:x+14,top:y-10,background:'rgba(17,24,39,0.95)',
    border:`1px solid ${st.color}44`,borderLeft:`3px solid ${st.color}`,borderRadius:8,
    padding:'8px 12px',fontSize:12,color:'#e4e8f0',pointerEvents:'none',zIndex:20,
    maxWidth:280,lineHeight:1.5,boxShadow:'0 4px 16px rgba(0,0,0,0.4)',backdropFilter:'blur(6px)'}}>
    <div style={{fontWeight:700,color:st.color,fontSize:11,marginBottom:4}}>{st.label} {emoji}</div>
    <div style={{marginBottom:4}}>{src?.icon} {src?.name} <span style={{color:st.color}}>→</span> {tgt?.icon} {tgt?.name}</div>
    <div style={{color:'#ffd166',fontWeight:600}}>weight: {edge.weight?.toFixed(2)}</div>
    {edge.evidence && <div style={{marginTop:4,fontSize:11,color:'#8892b0',fontStyle:'italic'}}>{edge.evidence}</div>}
  </div>
}

function Legend({ phase }) {
  return <div style={{position:'absolute',top:16,left:16,background:'rgba(17,24,39,0.85)',
    border:'1px solid #1e2640',borderRadius:8,padding:'10px 14px',fontSize:11,lineHeight:1.6,
    color:'#c4c9d4',backdropFilter:'blur(6px)',maxWidth:260}}>
    <div style={{fontWeight:700,marginBottom:6,color:'#e4e8f0'}}>凡例</div>
    <div style={{fontSize:10,color:'#8892b0',marginBottom:4}}>── 線 ──</div>
    {Object.entries(KIND_STYLE).map(([k,s]) => <div key={k} style={{display:'flex',alignItems:'center',gap:8}}>
      <span style={{display:'inline-block',width:20,height:2,background:s.color,borderRadius:2}}/><span>{s.label}</span>
    </div>)}
    <div style={{fontSize:10,color:'#8892b0',marginTop:8,marginBottom:4}}>── 形 ──</div>
    {Object.entries(CATEGORY_META).map(([,v]) => <div key={v.label} style={{display:'flex',alignItems:'center',gap:8}}>
      <span style={{color:v.color,fontSize:12,fontWeight:700}}>{v.shape==='circle'?'●':v.shape==='square'?'■':v.shape==='diamond'?'◆':'⬡'}</span>
      <span>{v.label}</span>
    </div>)}
    <div style={{borderTop:'1px solid #1e2640',marginTop:8,paddingTop:6,fontSize:10,color:'#8892b0'}}>
      {phase===0 && <>クリック → フォーカス<br/>もう1つクリック → 関係確認</>}
      {phase===1 && <>🔍 フォーカス中（1ホップ表示）<br/>別ノードクリック → 関係確認</>}
      {phase===2 && <>🔗 関係確認中<br/>背景クリック → 解除</>}
      <br/>ホイールでズーム · ドラッグで移動
    </div>
  </div>
}
