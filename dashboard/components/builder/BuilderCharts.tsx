/*
 * Copyright (c) Dotcorr Studio. and affiliates.
 *
 * Licensed under the PolyForm Noncommercial License 1.0.0.
 * Commercial use requires a license from DotCorr.
 */

'use client'

import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  RadialBarChart,
  RadialBar,
  Legend,
} from 'recharts'

function parseNumbers(raw: unknown): number[] {
  const s = raw === undefined || raw === null ? '' : String(raw).trim()
  if (!s) return []
  if (s.startsWith('[')) {
    try {
      const arr = JSON.parse(s) as unknown[]
      return arr.map((v) => (typeof v === 'number' && !Number.isNaN(v) ? v : Number(v) || 0))
    } catch {
      return []
    }
  }
  return s.split(',').map((v) => Number(String(v).trim()) || 0).filter((n) => !Number.isNaN(n))
}

function parseScatter(raw: unknown): { x: number; y: number }[] {
  const s = raw === undefined || raw === null ? '' : String(raw).trim()
  if (!s) return []
  return s.split('|').map((pair) => {
    const [a, b] = pair.split(',').map((v) => Number(String(v).trim()) || 0)
    return { x: a, y: b }
  }).filter((p) => !Number.isNaN(p.x) && !Number.isNaN(p.y))
}

function parseBubble(raw: unknown): { x: number; y: number; z: number }[] {
  const s = raw === undefined || raw === null ? '' : String(raw).trim()
  if (!s) return []
  return s.split('|').map((triple) => {
    const [a, b, c] = triple.split(',').map((v) => Number(String(v).trim()) || 0)
    return { x: a, y: b, z: c }
  }).filter((p) => !Number.isNaN(p.x) && !Number.isNaN(p.y) && !Number.isNaN(p.z))
}

const CHART_COLORS = ['#2563eb', '#16a34a', '#ca8a04', '#dc2626', '#9333ea', '#0891b2', '#7c3aed', '#e11d48']

type BuilderChartProps = {
  type: string
  resolvedProps: Record<string, unknown>
  width: number | string
  height: number | string
}

const toSize = (v: number | string) => (typeof v === 'string' ? v : v)
const isPercent = (v: number | string) => typeof v === 'string' && v === '100%'
const toNum = (v: number | string, fallback: number) => (typeof v === 'number' ? v : fallback)

export function BuilderChart({ type, resolvedProps, width, height }: BuilderChartProps) {
  const color = String(resolvedProps.color ?? '#2563eb').trim()
  const dataNumbers = parseNumbers(resolvedProps.data)
  const w = toSize(width) as number | `${number}%`
  const h = toSize(height) as number | `${number}%`
  const usePercent = isPercent(width) && isPercent(height)
  const numW = toNum(width, 300)
  const numH = toNum(height, 200)

  if (type === 'lineChart') {
    const data = dataNumbers.map((value, i) => ({ name: `${i + 1}`, value }))
    const showDots = resolvedProps.showDots !== false
    return (
      <ResponsiveContainer width={w} height={h}>
        <LineChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis dataKey="name" tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} />
          <Tooltip />
          <Line type="monotone" dataKey="value" stroke={color} strokeWidth={2} dot={showDots} />
        </LineChart>
      </ResponsiveContainer>
    )
  }

  if (type === 'areaChart') {
    const data = dataNumbers.map((value, i) => ({ name: `${i + 1}`, value }))
    return (
      <ResponsiveContainer width={w} height={h}>
        <AreaChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis dataKey="name" tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} />
          <Tooltip />
          <Area type="monotone" dataKey="value" stroke={color} fill={color} fillOpacity={0.4} strokeWidth={2} />
        </AreaChart>
      </ResponsiveContainer>
    )
  }

  if (type === 'barChart') {
    const data = dataNumbers.map((value, i) => ({ name: `${i + 1}`, value }))
    return (
      <ResponsiveContainer width={w} height={h}>
        <BarChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis dataKey="name" tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} />
          <Tooltip />
          <Bar dataKey="value" fill={color} radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    )
  }

  if (type === 'pieChart') {
    const data = dataNumbers.map((value, i) => ({ name: `Item ${i + 1}`, value }))
    return (
      <ResponsiveContainer width={w} height={h}>
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            outerRadius={usePercent ? '45%' : Math.min(numW, numH) / 2 - 8}
            label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
          >
            {data.map((_, i) => (
              <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} stroke="#fff" strokeWidth={1} />
            ))}
          </Pie>
          <Tooltip />
        </PieChart>
      </ResponsiveContainer>
    )
  }

  if (type === 'doughnutChart') {
    const innerPercent = Math.min(100, Math.max(0, Number(resolvedProps.innerRadiusPercent) ?? 50))
    const data = dataNumbers.map((value, i) => ({ name: `Item ${i + 1}`, value }))
    const outerR = usePercent ? '45%' : Math.min(numW, numH) / 2 - 8
    const innerR = typeof outerR === 'number' ? outerR * (innerPercent / 100) : `${innerPercent * 0.45}%`
    return (
      <ResponsiveContainer width={w} height={h}>
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            outerRadius={outerR}
            innerRadius={innerR}
            label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
          >
            {data.map((_, i) => (
              <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} stroke="#fff" strokeWidth={1} />
            ))}
          </Pie>
          <Tooltip />
        </PieChart>
      </ResponsiveContainer>
    )
  }

  if (type === 'horizontalBarChart') {
    const data = dataNumbers.map((value, i) => ({ name: `Item ${i + 1}`, value }))
    return (
      <ResponsiveContainer width={w} height={h}>
        <BarChart data={data} layout="vertical" margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis type="number" tick={{ fontSize: 11 }} />
          <YAxis type="category" dataKey="name" width={48} tick={{ fontSize: 11 }} />
          <Tooltip />
          <Bar dataKey="value" fill={color} radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
    )
  }

  if (type === 'stackedBarChart') {
    const a = parseNumbers(resolvedProps.dataA ?? '10,20,15')
    const b = parseNumbers(resolvedProps.dataB ?? '20,15,25')
    const c = parseNumbers(resolvedProps.dataC ?? '15,25,20')
    const n = Math.max(a.length, b.length, c.length, 1)
    const data = Array.from({ length: n }, (_, i) => ({
      name: `${i + 1}`,
      A: a[i] ?? 0,
      B: b[i] ?? 0,
      C: c[i] ?? 0,
    }))
    return (
      <ResponsiveContainer width={w} height={h}>
        <BarChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis dataKey="name" tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} />
          <Tooltip />
          <Legend />
          <Bar dataKey="A" stackId="1" fill={CHART_COLORS[0]} radius={[0, 0, 0, 0]} />
          <Bar dataKey="B" stackId="1" fill={CHART_COLORS[1]} radius={[0, 0, 0, 0]} />
          <Bar dataKey="C" stackId="1" fill={CHART_COLORS[2]} radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    )
  }

  if (type === 'scatterChart') {
    const points = parseScatter(resolvedProps.data)
    const data = points.map((p) => ({ x: p.x, y: p.y }))
    return (
      <ResponsiveContainer width={w} height={h}>
        <ScatterChart margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis type="number" dataKey="x" tick={{ fontSize: 11 }} />
          <YAxis type="number" dataKey="y" tick={{ fontSize: 11 }} />
          <Tooltip cursor={{ strokeDasharray: '3 3' }} />
          <Scatter name="Points" data={data} fill={color} />
        </ScatterChart>
      </ResponsiveContainer>
    )
  }

  if (type === 'bubbleChart') {
    const points = parseBubble(resolvedProps.data)
    return (
      <ResponsiveContainer width={w} height={h}>
        <ScatterChart margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis type="number" dataKey="x" tick={{ fontSize: 11 }} />
          <YAxis type="number" dataKey="y" tick={{ fontSize: 11 }} />
          <Tooltip cursor={{ strokeDasharray: '3 3' }} />
          <Scatter name="Bubbles" data={points} fill={color} fillOpacity={0.7} />
        </ScatterChart>
      </ResponsiveContainer>
    )
  }

  if (type === 'radarChart') {
    const data = dataNumbers.map((value, i) => ({ subject: `S${i + 1}`, value, fullMark: Math.max(...dataNumbers, 100) }))
    return (
      <ResponsiveContainer width={w} height={h}>
        <RadarChart cx="50%" cy="50%" outerRadius={usePercent ? '40%' : Math.min(numW, numH) / 2 - 24} data={data}>
          <PolarGrid stroke="#e5e7eb" />
          <PolarAngleAxis dataKey="subject" tick={{ fontSize: 10 }} />
          <PolarRadiusAxis angle={90} tick={{ fontSize: 10 }} />
          <Radar name="Value" dataKey="value" stroke={color} fill={color} fillOpacity={0.3} strokeWidth={2} />
          <Tooltip />
        </RadarChart>
      </ResponsiveContainer>
    )
  }

  if (type === 'gaugeChart') {
    const value = Number(resolvedProps.value) ?? 72
    const min = Number(resolvedProps.min) ?? 0
    const max = Number(resolvedProps.max) ?? 100
    const pct = Math.min(1, Math.max(0, (value - min) / (max - min || 1)))
    const data = [{ name: 'value', value: pct * 100, fill: color }]
    return (
      <ResponsiveContainer width={w} height={h}>
        <RadialBarChart
          cx="50%"
          cy="70%"
          innerRadius="60%"
          outerRadius="90%"
          barSize={12}
          data={data}
          startAngle={180}
          endAngle={0}
        >
          <RadialBar background cornerRadius={6} dataKey="value" />
          <text x="50%" y="65%" textAnchor="middle" dominantBaseline="middle" className="text-2xl font-semibold fill-current">
            {value}
          </text>
        </RadialBarChart>
      </ResponsiveContainer>
    )
  }

  if (type === 'funnelChart') {
    const data = dataNumbers.map((value, i) => ({ name: `Stage ${i + 1}`, value })).reverse()
    return (
      <ResponsiveContainer width={w} height={h}>
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 8, left: 8, bottom: 4 }}>
          <XAxis type="number" hide />
          <YAxis type="category" dataKey="name" width={56} tick={{ fontSize: 10 }} />
          <Bar dataKey="value" radius={[0, 4, 4, 0]}>
            {data.map((_, i) => (
              <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
            ))}
          </Bar>
          <Tooltip />
        </BarChart>
      </ResponsiveContainer>
    )
  }

  if (type === 'stepLineChart') {
    const data = dataNumbers.map((value, i) => ({ name: `${i + 1}`, value }))
    return (
      <ResponsiveContainer width={w} height={h}>
        <LineChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis dataKey="name" tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} />
          <Tooltip />
          <Line type="step" dataKey="value" stroke={color} strokeWidth={2} dot />
        </LineChart>
      </ResponsiveContainer>
    )
  }

  if (type === 'heatmapChart') {
    const s = String(resolvedProps.data ?? '').trim()
    const rows = s ? s.split('|').map((row) => row.split(',').map((v) => Number(String(v).trim()) || 0)) : []
    const flat = rows.flat()
    const minV = Math.min(...flat, 0)
    const maxV = Math.max(...flat, 1)
    const range = maxV - minV || 1
    const cols = Math.max(rows[0]?.length ?? 1, 1)
    const rowCount = Math.max(rows.length, 1)
    const gridStyle: Record<string, string | number> = usePercent
      ? { width: w, height: h, display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gridTemplateRows: `repeat(${rowCount}, 1fr)`, gap: 2, padding: 4 }
      : { width: numW, height: numH, display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gridTemplateRows: `repeat(${rowCount}, 1fr)`, gap: 2, padding: 4 }
    return (
      <div className="w-full h-full min-h-0 min-w-0" style={gridStyle}>
        {rows.map((row, ri) =>
          row.map((v, ci) => {
            const t = (v - minV) / range
            const r = Math.round(59 + (1 - t) * 196)
            const g = Math.round(130 + (1 - t) * 125)
            const b = Math.round(246 + (1 - t) * 9)
            return (
              <div
                key={`${ri}-${ci}`}
                className="rounded-sm flex items-center justify-center text-xs font-medium text-white min-w-0 min-h-0"
                style={{ backgroundColor: `rgb(${r},${g},${b})` }}
              >
                {v}
              </div>
            )
          })
        )}
      </div>
    )
  }

  return null
}
