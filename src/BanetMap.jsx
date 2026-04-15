import { useEffect, useRef, useState } from 'react'

export default function BanetMap() {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    fetch(import.meta.env.BASE_URL + 'data/visionium.json')
      .then(r => {
        if (!r.ok) throw new Error('failed to load: ' + r.status)
        return r.json()
      })
      .then(setData)
      .catch(e => setError(e.message))
  }, [])

  if (error) return <div style={{ padding: 24 }}>❌ {error}</div>
  if (!data) return <div style={{ padding: 24 }}>loading…</div>

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <header style={{ padding: '12px 20px', borderBottom: '1px solid #1e2640', display: 'flex', alignItems: 'center', gap: 16 }}>
        <div style={{ fontSize: 22, fontWeight: 700 }}>🌀 バネットマップ</div>
        <div style={{ fontSize: 13, color: '#8892b0' }}>{data.meta?.title}</div>
        <div style={{ marginLeft: 'auto', fontSize: 11, padding: '4px 10px', background: '#ffd166', color: '#0b0f1a', borderRadius: 12, fontWeight: 700 }}>β</div>
      </header>
      <main style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#8892b0' }}>
          {data.nodes?.length} nodes · {data.relations?.length} relations · ready to bounce
        </div>
      </main>
    </div>
  )
}
