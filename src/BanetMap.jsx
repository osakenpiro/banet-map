import { useEffect, useRef, useState, useMemo, useCallback } from 'react'
import VRHeader from './VRHeader'
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

/* ── VR CSV Standard v0.1 ── */
function csvStringify(rows) {
  if (!rows.length) return ''
  const cols = Object.keys(rows[0])
  const escape = v => {
    const s = v == null ? '' : String(v)
    return s.includes(',') || s.includes('"') || s.includes('\n')
      ? '"' + s.replace(/"/g, '""') + '"' : s
  }
  return [cols.map(escape).join(','), ...rows.map(r => cols.map(c => escape(r[c])).join(','))].join('\n')
}

function csvParse(text) {
  const lines = []; let cur = ''; let inQ = false
  for (const ch of text) {
    if (ch === '"') { inQ = !inQ; cur += ch }
    else if (ch === '\n' && !inQ) { lines.push(cur); cur = '' }
    else { cur += ch }
  }
  if (cur.trim()) lines.push(cur)
  const parseRow = (line) => {
    const cells = []; let cell = ''; let q = false
    for (let i = 0; i < line.length; i++) {
      const ch = line[i]
      if (ch === '"') { if (q && line[i+1] === '"') { cell += '"'; i++ } else { q = !q } }
      else if (ch === ',' && !q) { cells.push(cell); cell = '' }
      else { cell += ch }
    }
    cells.push(cell)
    return cells
  }
  if (!lines.length) return []
  const header = parseRow(lines[0])
  return lines.slice(1).filter(l => l.trim()).map(l => {
    const vals = parseRow(l)
    const obj = {}
    header.forEach((h, i) => { obj[h.trim()] = (vals[i] ?? '').trim() })
    return obj
  })
}

function jsonToCSVs(data) {
  const nodeRows = data.nodes.map(n => ({
    id: n.id, name: n.name, icon: n.icon || '',
    desc: n.attrs?.desc || '',
    'axis:category': n.attrs?.category || '',
    color: n.attrs?.color || '',
    radius: n.attrs?.radius ?? '',
  }))
  const relRows = data.relations.map(r => ({
    id: r.id,
    source: typeof r.source === 'object' ? r.source.id : r.source,
    target: typeof r.target === 'object' ? r.target.id : r.target,
    kind: r.kind, weight: r.weight ?? '',
    status: r.status || 'confirmed',
    evidence: r.evidence || '',
  }))
  return { nodes: csvStringify(nodeRows), relations: csvStringify(relRows) }
}

function csvsToJson(nodesCsv, relationsCsv, meta) {
  const nodeRows = csvParse(nodesCsv)
  const relRows = csvParse(relationsCsv)
  const nodes = nodeRows.map(r => {
    const axes = {}; const attrs = {}
    Object.entries(r).forEach(([k, v]) => {
      if (k.startsWith('axis:')) axes[k.slice(5)] = v
    })
    if (axes.category) attrs.category = axes.category
    if (r.color) attrs.color = r.color
    if (r.radius) attrs.radius = Number(r.radius)
    if (r.desc) attrs.desc = r.desc
    // If no color, derive from CATEGORY_META
    if (!attrs.color && attrs.category && CATEGORY_META[attrs.category]) {
      attrs.color = CATEGORY_META[attrs.category].color
    }
    return { id: r.id, name: r.name, icon: r.icon || '', attrs }
  })
  const relations = relRows.map(r => ({
    id: r.id, source: r.source, target: r.target,
    kind: r.kind, weight: r.weight ? Number(r.weight) : 0.5,
    status: r.status || 'confirmed',
    ...(r.evidence ? { evidence: r.evidence } : {}),
  }))
  return {
    meta: meta || { id: 'imported', title: 'Imported Data', version: '0.1', source: 'csv-import' },
    nodes, relations,
    axes: [{ id: 'by-category', title: 'カテゴリで分ける', groupBy: 'attrs.category' }],
  }
}

function downloadFile(content, filename) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a'); a.href = url; a.download = filename
  document.body.appendChild(a); a.click(); document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

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
  const [searchQuery, setSearchQuery] = useState('')
  const [showImport, setShowImport] = useState(false)

  useEffect(() => {
    fetch(import.meta.env.BASE_URL + 'data/visionium.json')
      .then(r => { if (!r.ok) throw new Error('failed: ' + r.status); return r.json() })
      .then(setData).catch(e => setError(e.message))
  }, [])

  const handleExport = useCallback(() => {
    if (!data) return
    const { nodes, relations } = jsonToCSVs(data)
    const prefix = (data.meta?.id || 'banet').replace(/\s+/g, '-')
    downloadFile(nodes, `${prefix}-nodes.csv`)
    setTimeout(() => downloadFile(relations, `${prefix}-relations.csv`), 200)
  }, [data])

  const handleImport = useCallback((nodesCsv, relationsCsv) => {
    try {
      const imported = csvsToJson(nodesCsv, relationsCsv, data?.meta)
      if (!imported.nodes.length) { setError('nodes.csv にノードがありません'); return }
      setData(imported)
      setFocus([])
      setSearchQuery('')
      setShowImport(false)
    } catch (e) { setError('CSV読込エラー: ' + e.message) }
  }, [data])

  const toggleCat = useCallback((cat) => setCatFilter(prev => ({ ...prev, [cat]: !prev[cat] })), [])

  // VR共通: ノード全文検索 → Set<nodeId>
  const searchMatchIds = useMemo(() => {
    if (!data || !searchQuery.trim()) return null // null = no filter
    const q = searchQuery.trim().toLowerCase()
    const ids = new Set()
    data.nodes.forEach(n => {
      const haystack = [n.name, n.id, n.icon, n.attrs?.desc, n.attrs?.category,
        ...Object.values(n.attrs || {}).map(String)].join(' ').toLowerCase()
      if (haystack.includes(q)) ids.add(n.id)
    })
    return ids
  }, [data, searchQuery])

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
        catFilter={catFilter} onToggleCat={toggleCat} phase={phase} onClearFocus={clearFocus}
        searchQuery={searchQuery} onSearch={setSearchQuery} searchMatchIds={searchMatchIds}
        totalNodes={data.nodes.length}
        onExport={handleExport} onImport={() => setShowImport(true)} />
      <main style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        <Graph
          nodes={data.nodes} relations={data.relations}
          showHypothesis={showHypothesis} catFilter={catFilter}
          focus={focus} onNodeFocus={handleNodeFocus} onClearFocus={clearFocus}
          onHoverNode={setHoveredNode} hoveredNodeId={hoveredNode?.id}
          onHoverEdge={setHoveredEdge}
          searchMatchIds={searchMatchIds}
        />
        <Legend phase={phase} />
        {phase === 1 && (
          <FocusPanel focus={focus} allNodes={data.nodes} relations={data.relations} onClear={clearFocus} onNodeFocus={handleNodeFocus} />
        )}
        {phase === 2 && (
          <PairOverlay focus={focus} allNodes={data.nodes} relations={data.relations} onClear={clearFocus} />
        )}
        {hoveredEdge && phase === 0 && <EdgeTooltip data={hoveredEdge} allNodes={data.nodes} />}
        {showImport && <ImportModal onImport={handleImport} onClose={() => setShowImport(false)} />}
      </main>
    </div>
  )
}

function Header({ meta, showHypothesis, onToggleHypothesis, catFilter, onToggleCat, phase, onClearFocus, searchQuery, onSearch, searchMatchIds, totalNodes, onExport, onImport }) {
  return (
    <VRHeader
      title="🌀 バネットマップ"
      currentApp="banet"
      version="β"
      centerSlot={<>
        {/* Search */}
        <div style={{ position:'relative', minWidth:180 }}>
          <input value={searchQuery} onChange={e=>onSearch(e.target.value)}
            placeholder="🔍 ノード検索…"
            style={{
              width:'100%',padding:'6px 28px 6px 10px',fontSize:13,
              background:'#111827',border:`1px solid ${searchMatchIds?'#ffd166':'#1e2640'}`,borderRadius:8,
              color:'#e4e8f0',outline:'none',transition:'border-color 0.2s',
            }}
          />
          {searchQuery && <button onClick={()=>onSearch('')} style={{
            position:'absolute',right:6,top:'50%',transform:'translateY(-50%)',
            background:'none',border:'none',color:'#5a6378',fontSize:12,cursor:'pointer',padding:2
          }}>✕</button>}
        </div>
        {searchMatchIds && (
          <span style={{fontSize:12,color:'#ffd166',fontWeight:600}}>{searchMatchIds.size}/{totalNodes}</span>
        )}
        <div style={{ display: 'flex', gap: 6 }}>
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
      </>}
      rightSlot={<>
        <button onClick={onImport} title="CSV インポート" style={{
          padding:'4px 10px',fontSize:12,fontWeight:600,borderRadius:8,cursor:'pointer',
          border:'1px solid #06d6a0',background:'transparent',color:'#06d6a0',
        }}>📥 CSV</button>
        <button onClick={onExport} title="CSV エクスポート" style={{
          padding:'4px 10px',fontSize:12,fontWeight:600,borderRadius:8,cursor:'pointer',
          border:'1px solid #118ab2',background:'transparent',color:'#118ab2',
        }}>📤 CSV</button>
        <label style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', color: showHypothesis ? '#e4e8f0' : '#5a6378' }}>
          <input type="checkbox" checked={showHypothesis} onChange={(e) => onToggleHypothesis(e.target.checked)} style={{ accentColor: '#ef476f' }} />
          仮説
        </label>
        <a href="https://github.com/osakenpiro/banet-map" target="_blank" rel="noreferrer" style={{ color: '#8892b0', fontSize: 12, textDecoration: 'none' }}>GitHub</a>
      </>}
    />
  )
}

function Graph({ nodes, relations, showHypothesis, catFilter, focus, onNodeFocus, onClearFocus, onHoverNode, hoveredNodeId, onHoverEdge, searchMatchIds }) {
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
      const k = Math.min(w/(Math.abs(xs[0]-xs[1])+160), h/(Math.abs(ys[0]-ys[1])+160), 2.8)
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
  const searchActive = searchMatchIds !== null

  const getEdgeOp = (l) => {
    const sid = typeof l.source==='object'?l.source.id:l.source
    const tid = typeof l.target==='object'?l.target.id:l.target
    // Search dimming layer
    if (searchActive && !searchMatchIds.has(sid) && !searchMatchIds.has(tid)) return 0.05
    if (phase===2) {
      if (focusSet.has(sid)&&focusSet.has(tid)) return 1.0
      if (focusSet.has(sid)||focusSet.has(tid)) return 0.22
      return 0.10
    }
    if (phase===1) {
      if (focusSet.has(sid)||focusSet.has(tid)) return 0.8
      return 0.12
    }
    if (!hoveredNodeId) return l.status==='refuted'?0.4:0.7
    if (sid===hoveredNodeId||tid===hoveredNodeId) return 0.8
    return 0.18
  }

  const getNodeOp = (id) => {
    if (searchActive && !searchMatchIds.has(id)) return 0.08
    if (phase===2) { if(focusSet.has(id)) return 1.0; if(neighborSet?.has(id)) return 0.45; return 0.18 }
    if (phase===1) { if(focusSet.has(id)) return 1.0; if(neighborSet?.has(id)) return 0.7; return 0.2 }
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
    <div ref={wrapRef} style={{ position:'absolute', inset:0, transition:'filter 0.4s', filter: phase===2 ? 'blur(3px) brightness(0.4)' : 'none' }}>
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
            const sw = (1+(l.weight||0.5)*3)*(isFP?3.5:1)
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
                {isFP && <path d={pathD} fill="none" stroke={stroke} strokeWidth={sw*2.5} strokeOpacity={0.15} style={{filter:'blur(6px)'}}/>}
                <path d={pathD} fill="none" stroke={stroke} strokeWidth={sw} strokeOpacity={opacity} strokeDasharray={dash} markerEnd={me}/>
                <path d={pathD} fill="none" stroke="transparent" strokeWidth="14"/>
              </g>
            }
            const ex=tx-(dx/len)*tr, ey=ty-(dy/len)*tr
            return <g key={l.id} style={{cursor:'pointer'}} onClick={e=>e.stopPropagation()}
              onPointerEnter={e=>onHoverEdge({edge:l,x:e.clientX,y:e.clientY})}
              onPointerMove={e=>onHoverEdge({edge:l,x:e.clientX,y:e.clientY})}
              onPointerLeave={()=>onHoverEdge(null)}>
              {isFP && <line x1={sx} y1={sy} x2={ex} y2={ey} stroke={stroke} strokeWidth={sw*2.5} strokeOpacity={0.15} style={{filter:'blur(6px)'}}/>}
              <line x1={sx} y1={sy} x2={ex} y2={ey} stroke={stroke} strokeWidth={sw} strokeOpacity={opacity} strokeDasharray={dash} markerEnd={me}/>
              <line x1={sx} y1={sy} x2={ex} y2={ey} stroke="transparent" strokeWidth="14"/>
            </g>
          })}</g>

          <g>{simNodes.map(d => {
            if (!nodeVisible(d)) return null
            const isF=focusSet.has(d.id)
            const r = isF && phase > 0 ? d._r * 1.4 : d._r
            const color=d.attrs?.color||'#8892b0'
            const isH=hoveredNodeId===d.id
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

function FocusPanel({ focus, allNodes, relations, onClear, onNodeFocus }) {
  const [kindFilter, setKindFilter] = useState(null) // null = all
  const [sortBy, setSortBy] = useState('weight') // weight | name | kind
  const nodeA = allNodes.find(n=>n.id===focus[0])
  const catA = CATEGORY_META[nodeA?.attrs?.category]
  const shapeG = (cat) => !cat?'':cat.shape==='circle'?'●':cat.shape==='square'?'■':cat.shape==='diamond'?'◆':'⬡'

  const connections = relations.filter(r => {
    const sid=typeof r.source==='object'?r.source.id:r.source
    const tid=typeof r.target==='object'?r.target.id:r.target
    return sid===focus[0]||tid===focus[0]
  })
  const usedKinds = [...new Set(connections.map(e=>e.kind))]

  const filtered = kindFilter ? connections.filter(e=>e.kind===kindFilter) : connections
  const sorted = [...filtered].sort((a,b) => {
    if (sortBy==='weight') return (b.weight||0)-(a.weight||0)
    if (sortBy==='name') {
      const aOther = allNodes.find(n=>n.id===(typeof a.source==='object'?a.source.id:a.source)===focus[0]?(typeof a.target==='object'?a.target.id:a.target):(typeof a.source==='object'?a.source.id:a.source))
      const bOther = allNodes.find(n=>n.id===(typeof b.source==='object'?b.source.id:b.source)===focus[0]?(typeof b.target==='object'?b.target.id:b.target):(typeof b.source==='object'?b.source.id:b.source))
      return (aOther?.name||'').localeCompare(bOther?.name||'')
    }
    return (a.kind||'').localeCompare(b.kind||'')
  })
  const maxW = Math.max(...connections.map(e=>e.weight||0), 0.1)

  return (
    <div style={{
      position:'absolute',top:0,right:0,bottom:0,width:'50%',minWidth:360,maxWidth:600,
      background:'rgba(17,24,39,0.97)',borderLeft:'1px solid #1e2640',
      display:'flex',flexDirection:'column',zIndex:15,
      boxShadow:'-4px 0 24px rgba(0,0,0,0.4)',
      backdropFilter:'blur(8px)',
    }}>
      {/* Node header */}
      <div style={{padding:'20px 24px 16px',borderBottom:'1px solid #1e2640'}}>
        <div style={{display:'flex',alignItems:'center',gap:12}}>
          <span style={{fontSize:36}}>{nodeA?.icon}</span>
          <div style={{flex:1}}>
            <div style={{fontSize:22,fontWeight:700,color:'#e4e8f0'}}>{nodeA?.name}</div>
            <div style={{display:'flex',alignItems:'center',gap:6,marginTop:3}}>
              {catA && <span style={{fontSize:13,padding:'2px 8px',borderRadius:8,background:catA.color+'22',color:catA.color,fontWeight:700,display:'inline-flex',alignItems:'center',gap:4}}>
                <span>{shapeG(catA)}</span> {catA.label}
              </span>}
            </div>
          </div>
          <button onClick={onClear} style={{background:'transparent',border:'1px solid #5a6378',color:'#8892b0',fontSize:14,padding:'6px 12px',borderRadius:8,cursor:'pointer'}}>✕</button>
        </div>
        {nodeA?.attrs?.desc && <div style={{fontSize:13,color:'#b8bfcc',marginTop:8,lineHeight:1.5}}>{nodeA.attrs.desc}</div>}
      </div>

      {/* Kind filter + sort */}
      <div style={{padding:'12px 24px',borderBottom:'1px solid #1e2640',display:'flex',flexDirection:'column',gap:8}}>
        <div style={{display:'flex',gap:5,flexWrap:'wrap'}}>
          <button onClick={()=>setKindFilter(null)} style={{
            padding:'3px 10px',fontSize:11,fontWeight:600,borderRadius:10,cursor:'pointer',border:'none',
            background:kindFilter===null?'#e4e8f0':'#1e2640',color:kindFilter===null?'#0b0f1a':'#5a6378',
          }}>すべて ({connections.length})</button>
          {usedKinds.map(k => {
            const st=KIND_STYLE[k]||{label:k,color:'#8892b0'}
            const cnt=connections.filter(e=>e.kind===k).length
            return <button key={k} onClick={()=>setKindFilter(kindFilter===k?null:k)} style={{
              padding:'3px 10px',fontSize:11,fontWeight:600,borderRadius:10,cursor:'pointer',border:'none',
              background:kindFilter===k?st.color:'#1e2640',color:kindFilter===k?'#0b0f1a':'#5a6378',
            }}>{st.label} ({cnt})</button>
          })}
        </div>
        <div style={{display:'flex',gap:6,fontSize:11,color:'#5a6378'}}>
          <span>並替:</span>
          {[['weight','重さ順'],['name','名前順'],['kind','種類順']].map(([v,l])=>
            <button key={v} onClick={()=>setSortBy(v)} style={{
              padding:'2px 8px',fontSize:10,borderRadius:6,cursor:'pointer',border:'none',
              background:sortBy===v?'#2a3050':'transparent',color:sortBy===v?'#e4e8f0':'#5a6378',
            }}>{l}</button>
          )}
        </div>
      </div>

      {/* Connection list */}
      <div style={{flex:1,overflowY:'auto',padding:'8px 0'}}>
        {sorted.map(e => {
          const sid=typeof e.source==='object'?e.source.id:e.source
          const tid=typeof e.target==='object'?e.target.id:e.target
          const otherId=sid===focus[0]?tid:sid
          const other=allNodes.find(n=>n.id===otherId)
          const otherCat=CATEGORY_META[other?.attrs?.category]
          const st=KIND_STYLE[e.kind]||{label:e.kind,color:'#8892b0'}
          const dir=sid===focus[0]?'→':'←'
          const barW = ((e.weight||0)/maxW)*100
          const statusEmoji = e.status==='hypothesis'?'🔮':e.status==='refuted'?'❌':''
          return <div key={e.id} onClick={()=>onNodeFocus&&onNodeFocus(otherId)}
            style={{padding:'12px 24px',cursor:'pointer',borderBottom:'1px solid #111827',
              transition:'background 0.15s',
            }}
            onMouseEnter={ev=>ev.currentTarget.style.background='#1a1f35'}
            onMouseLeave={ev=>ev.currentTarget.style.background='transparent'}>
            <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:6}}>
              <span style={{width:4,height:20,borderRadius:2,background:st.color,flexShrink:0}}/>
              <span style={{color:st.color,fontWeight:700,fontSize:12}}>{st.label}</span>
              <span style={{color:'#5a6378',fontSize:12}}>{dir}</span>
              {otherCat && <span style={{color:otherCat.color,fontSize:11}}>{shapeG(otherCat)}</span>}
              <span style={{fontWeight:600,fontSize:16,color:'#e4e8f0'}}>{other?.icon} {other?.name}</span>
              {statusEmoji && <span style={{fontSize:11}}>{statusEmoji}</span>}
            </div>
            {/* Weight bar */}
            <div style={{display:'flex',alignItems:'center',gap:8}}>
              <div style={{flex:1,height:10,background:'#111827',borderRadius:5,overflow:'hidden'}}>
                <div style={{height:'100%',width:barW+'%',background:st.color,borderRadius:4,transition:'width 0.3s'}}/>
              </div>
              <span style={{color:'#ffd166',fontWeight:700,fontSize:16,minWidth:40,textAlign:'right'}}>{e.weight?.toFixed(2)}</span>
            </div>
            {e.evidence && <div style={{fontSize:11,color:'#8892b0',marginTop:4,paddingLeft:12}}>{e.evidence}</div>}
          </div>
        })}
        {sorted.length===0 && <div style={{padding:20,color:'#5a6378',textAlign:'center',fontSize:13}}>接続なし</div>}
      </div>

      {/* Footer hint */}
      <div style={{padding:'10px 20px',borderTop:'1px solid #1e2640',fontSize:11,color:'#5a6378'}}>
        行をクリック → 関係確認モード
      </div>
    </div>
  )
}

/* ── PairOverlay — Phase 2 専用ビュー ── */
function PairOverlay({ focus, allNodes, relations, onClear }) {
  const nodeA = allNodes.find(n=>n.id===focus[0])
  const nodeB = allNodes.find(n=>n.id===focus[1])
  const catA = CATEGORY_META[nodeA?.attrs?.category]
  const catB = CATEGORY_META[nodeB?.attrs?.category]
  const shapeG = (cat) => !cat?'':cat.shape==='circle'?'●':cat.shape==='square'?'■':cat.shape==='diamond'?'◆':'⬡'

  const pairEdges = relations.filter(r => {
    const sid=typeof r.source==='object'?r.source.id:r.source
    const tid=typeof r.target==='object'?r.target.id:r.target
    return (sid===focus[0]&&tid===focus[1])||(sid===focus[1]&&tid===focus[0])
  })

  // Find shared neighbors (2-hop bridges)
  const aNeighbors = new Set(), bNeighbors = new Set()
  relations.forEach(r => {
    const sid=typeof r.source==='object'?r.source.id:r.source
    const tid=typeof r.target==='object'?r.target.id:r.target
    if (sid===focus[0]) aNeighbors.add(tid)
    if (tid===focus[0]) aNeighbors.add(sid)
    if (sid===focus[1]) bNeighbors.add(tid)
    if (tid===focus[1]) bNeighbors.add(sid)
  })
  const bridges = [...aNeighbors].filter(id => bNeighbors.has(id) && id!==focus[0] && id!==focus[1])

  const NodeCard = ({node, cat}) => (
    <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:8,minWidth:140}}>
      <div style={{fontSize:56,lineHeight:1}}>{node?.icon}</div>
      <div style={{fontSize:24,fontWeight:700,textAlign:'center'}}>{node?.name}</div>
      {cat && <span style={{fontSize:14,padding:'3px 12px',borderRadius:10,background:cat.color+'22',color:cat.color,fontWeight:700}}>
        {shapeG(cat)} {cat.label}
      </span>}
      {node?.attrs?.desc && <div style={{fontSize:14,color:'#b8bfcc',textAlign:'center',maxWidth:200,lineHeight:1.5}}>{node.attrs.desc}</div>}
    </div>
  )

  const maxW = Math.max(...pairEdges.map(e=>e.weight||0), 0.1)

  return (
    <div style={{
      position:'absolute', inset:0, zIndex:20,
      display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
      background:'rgba(11,15,26,0.6)', backdropFilter:'blur(2px)',
    }} onClick={onClear}>
      <div style={{
        background:'rgba(17,24,39,0.97)', border:'1px solid #ffd166',
        borderRadius:20, padding:'32px 40px', maxWidth:720, width:'90%',
        boxShadow:'0 8px 48px rgba(0,0,0,0.6), 0 0 30px rgba(255,209,102,0.08)',
      }} onClick={e=>e.stopPropagation()}>

        {/* Two nodes + sankey bands */}
        <div style={{display:'flex',alignItems:'center',gap:0,marginBottom:20}}>
          <NodeCard node={nodeA} cat={catA}/>

          {/* Edge bands (sankey-like) */}
          <div style={{flex:1,display:'flex',flexDirection:'column',gap:10,padding:'0 20px',minWidth:200}}>
            {pairEdges.length > 0 ? pairEdges.map(e => {
              const st=KIND_STYLE[e.kind]||{label:e.kind,color:'#8892b0'}
              const srcId=typeof e.source==='object'?e.source.id:e.source
              const dir=srcId===focus[0]?'→':'←'
              const bandH = Math.max(24, 16 + (e.weight||0.5)/maxW * 32)
              return (
                <div key={e.id} style={{position:'relative'}}>
                  {/* Band */}
                  <div style={{
                    height:bandH, borderRadius:bandH/2,
                    background:`linear-gradient(90deg, ${st.color}33, ${st.color}88, ${st.color}33)`,
                    border:`1px solid ${st.color}66`,
                    display:'flex', alignItems:'center', justifyContent:'center', gap:10,
                    padding:'0 16px', cursor:'default',
                  }}>
                    <span style={{color:st.color,fontWeight:700,fontSize:16}}>{st.label}</span>
                    <span style={{color:'#8892b0',fontSize:14}}>{dir}</span>
                    <span style={{fontSize:12,padding:'1px 8px',borderRadius:6,background:e.status==='hypothesis'?'#ef476f22':'#06d6a022',color:e.status==='hypothesis'?'#ef476f':'#06d6a0',fontWeight:600}}>{e.status==='hypothesis'?'🔮 仮説':e.status==='refuted'?'❌ 反証':'✅ 確定'}</span>
                    <span style={{color:'#ffd166',fontWeight:700,fontSize:18}}>{e.weight?.toFixed(2)}</span>
                  </div>
                  {/* Evidence below band */}
                  {e.evidence && (
                    <div style={{fontSize:14,color:'#c4c9d4',marginTop:6,padding:'6px 14px',lineHeight:1.6}}>
                      {e.evidence}
                    </div>
                  )}
                </div>
              )
            }) : (
              <div style={{textAlign:'center',color:'#8892b0',fontSize:16,fontStyle:'italic',padding:'20px 0'}}>
                直接の関係なし
              </div>
            )}
          </div>

          <NodeCard node={nodeB} cat={catB}/>
        </div>

        {/* Bridges (shared neighbors) */}
        {bridges.length > 0 && (
          <div style={{borderTop:'1px solid #1e2640',paddingTop:12,marginTop:4}}>
            <div style={{fontSize:14,color:'#8892b0',marginBottom:8,fontWeight:600}}>経由ノード（両者に接続）:</div>
            <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
              {bridges.map(id => {
                const n = allNodes.find(x=>x.id===id)
                const c = CATEGORY_META[n?.attrs?.category]
                return <span key={id} style={{padding:'6px 12px',background:'#0b0f1a',borderRadius:8,fontSize:14,display:'inline-flex',alignItems:'center',gap:4}}>
                  {c && <span style={{color:c.color}}>{shapeG(c)}</span>}
                  {n?.icon} {n?.name}
                </span>
              })}
            </div>
          </div>
        )}

        {/* L2 expansion slot (future) */}
        <div style={{borderTop:'1px solid #1e2640',paddingTop:12,marginTop:12,display:'flex',alignItems:'center',gap:8}}>
          <span style={{fontSize:11,color:'#5a6378'}}>🔮 将来: ここにL2チャート（棒グラフ・円グラフ・サンキー）が展開される</span>
        </div>

        {/* Close */}
        <div style={{textAlign:'center',marginTop:16}}>
          <button onClick={onClear} style={{
            padding:'10px 28px',borderRadius:10,border:'1px solid #5a6378',
            background:'transparent',color:'#c4c9d4',fontSize:15,cursor:'pointer',
          }}>✕ 背景に戻る</button>
        </div>
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

/* ── ImportModal — CSV import UI ── */
function ImportModal({ onImport, onClose }) {
  const [nodesFile, setNodesFile] = useState(null)
  const [relsFile, setRelsFile] = useState(null)
  const [nodesText, setNodesText] = useState('')
  const [relsText, setRelsText] = useState('')
  const [preview, setPreview] = useState(null)
  const [dragOver, setDragOver] = useState(false)

  const readFile = (file) => new Promise((resolve) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.readAsText(file, 'utf-8')
  })

  const handleFiles = async (files) => {
    for (const f of files) {
      const text = await readFile(f)
      const name = f.name.toLowerCase()
      if (name.includes('node')) { setNodesFile(f.name); setNodesText(text) }
      else if (name.includes('relation') || name.includes('edge') || name.includes('rel')) { setRelsFile(f.name); setRelsText(text) }
      else if (!nodesText) { setNodesFile(f.name); setNodesText(text) }
      else { setRelsFile(f.name); setRelsText(text) }
    }
  }

  const handleDrop = (e) => { e.preventDefault(); setDragOver(false); handleFiles([...e.dataTransfer.files]) }
  const handleFileInput = (e, type) => {
    const f = e.target.files[0]; if (!f) return
    readFile(f).then(text => {
      if (type === 'nodes') { setNodesFile(f.name); setNodesText(text) }
      else { setRelsFile(f.name); setRelsText(text) }
    })
  }

  useEffect(() => {
    if (!nodesText) { setPreview(null); return }
    try {
      const nodes = csvParse(nodesText)
      const rels = relsText ? csvParse(relsText) : []
      setPreview({ nodeCount: nodes.length, relCount: rels.length, sampleNode: nodes[0], sampleRel: rels[0] })
    } catch { setPreview(null) }
  }, [nodesText, relsText])

  const doImport = () => { if (nodesText) onImport(nodesText, relsText || '') }

  const dropStyle = {
    border: `2px dashed ${dragOver ? '#06d6a0' : '#1e2640'}`,
    borderRadius: 12, padding: 24, textAlign: 'center',
    background: dragOver ? '#06d6a011' : '#0b0f1a',
    transition: 'all 0.2s', cursor: 'pointer', marginBottom: 16,
  }
  const btnStyle = (active) => ({
    padding: '6px 16px', fontSize: 13, fontWeight: 600, borderRadius: 8, cursor: 'pointer',
    border: `1px solid ${active ? '#06d6a0' : '#5a6378'}`,
    background: active ? '#06d6a0' : 'transparent',
    color: active ? '#0b0f1a' : '#8892b0',
  })

  return (
    <div style={{
      position: 'absolute', inset: 0, zIndex: 25,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(11,15,26,0.7)', backdropFilter: 'blur(3px)',
    }} onClick={onClose}>
      <div style={{
        background: 'rgba(17,24,39,0.98)', border: '1px solid #06d6a0',
        borderRadius: 16, padding: 28, width: '90%', maxWidth: 540,
        boxShadow: '0 8px 40px rgba(0,0,0,0.5)',
      }} onClick={e => e.stopPropagation()}>

        <div style={{ fontSize: 18, fontWeight: 700, color: '#e4e8f0', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
          📥 CSV インポート
          <span style={{ fontSize: 12, color: '#5a6378', fontWeight: 400 }}>VR CSV Standard v0.1</span>
        </div>

        {/* Drop zone */}
        <div style={dropStyle}
          onDragOver={e => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>📂</div>
          <div style={{ color: '#8892b0', fontSize: 14 }}>
            nodes.csv と relations.csv をドロップ
          </div>
          <div style={{ color: '#5a6378', fontSize: 12, marginTop: 6 }}>
            またはファイルを選択 ↓
          </div>
        </div>

        {/* File selectors */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
          <label style={{ flex: 1 }}>
            <div style={{ fontSize: 12, color: '#8892b0', marginBottom: 4 }}>nodes.csv {nodesFile && <span style={{ color: '#06d6a0' }}>✓ {nodesFile}</span>}</div>
            <input type="file" accept=".csv,.tsv,.txt" onChange={e => handleFileInput(e, 'nodes')}
              style={{ fontSize: 12, color: '#e4e8f0', width: '100%' }} />
          </label>
          <label style={{ flex: 1 }}>
            <div style={{ fontSize: 12, color: '#8892b0', marginBottom: 4 }}>relations.csv {relsFile && <span style={{ color: '#06d6a0' }}>✓ {relsFile}</span>}</div>
            <input type="file" accept=".csv,.tsv,.txt" onChange={e => handleFileInput(e, 'rels')}
              style={{ fontSize: 12, color: '#e4e8f0', width: '100%' }} />
          </label>
        </div>

        {/* Preview */}
        {preview && (
          <div style={{
            background: '#0b0f1a', borderRadius: 8, padding: 14, marginBottom: 16,
            border: '1px solid #1e2640', fontSize: 13, color: '#c4c9d4',
          }}>
            <div style={{ fontWeight: 700, color: '#e4e8f0', marginBottom: 6 }}>プレビュー</div>
            <div>ノード: <span style={{ color: '#06d6a0', fontWeight: 700 }}>{preview.nodeCount}</span></div>
            <div>関係: <span style={{ color: '#118ab2', fontWeight: 700 }}>{preview.relCount}</span></div>
            {preview.sampleNode && (
              <div style={{ marginTop: 6, fontSize: 11, color: '#8892b0' }}>
                例: {preview.sampleNode.id} — {preview.sampleNode.name}
                {preview.sampleNode['axis:category'] && ` [${preview.sampleNode['axis:category']}]`}
              </div>
            )}
          </div>
        )}

        {/* Actions */}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={btnStyle(false)}>キャンセル</button>
          <button onClick={doImport} disabled={!nodesText} style={btnStyle(!!nodesText)}>
            読み込む ({preview?.nodeCount || 0} ノード)
          </button>
        </div>

        {/* Format hint */}
        <div style={{ marginTop: 16, fontSize: 11, color: '#5a6378', lineHeight: 1.6 }}>
          <div style={{ fontWeight: 600, marginBottom: 4 }}>フォーマット:</div>
          <code style={{ display: 'block', background: '#0b0f1a', padding: 8, borderRadius: 6, fontSize: 10 }}>
            nodes.csv: id, name, icon, desc, axis:category, color, radius<br/>
            relations.csv: id, source, target, kind, weight, status, evidence
          </code>
        </div>
      </div>
    </div>
  )
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

