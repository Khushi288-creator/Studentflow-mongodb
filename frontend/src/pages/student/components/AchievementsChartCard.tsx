import { useQuery } from '@tanstack/react-query'
import { http } from '../../../api/http'
import { Card, CardBody, CardHeader } from '../../../components/ui/Card'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts'

type AchievRow = { id: string; type: string; rank: string | null }

const RANK_COLORS: Record<string, string> = {
  '1st':  '#22c55e', // green
  '2nd':  '#3b82f6', // blue
  '3rd':  '#f97316', // orange
  'none': '#a855f7', // purple (participation / no rank)
}

const RANK_LABELS: Record<string, string> = {
  '1st':  '🥇 1st Rank',
  '2nd':  '🥈 2nd Rank',
  '3rd':  '🥉 3rd Rank',
  'none': '🎖 Participation',
}

export default function AchievementsChartCard() {
  const { data, isLoading } = useQuery({
    queryKey: ['achievements'],
    queryFn: async () => (await http.get('/achievements')).data as { achievements: AchievRow[] },
    retry: false,
  })

  const rows = data?.achievements ?? []

  // Build pie data
  const counts: Record<string, number> = { '1st': 0, '2nd': 0, '3rd': 0, 'none': 0 }
  for (const r of rows) {
    const key = r.rank ?? 'none'
    counts[key] = (counts[key] ?? 0) + 1
  }
  const pieData = Object.entries(counts)
    .filter(([, v]) => v > 0)
    .map(([key, value]) => ({ name: RANK_LABELS[key] ?? key, value, color: RANK_COLORS[key] ?? '#6366f1' }))

  return (
    <Card className="h-full min-h-0 overflow-hidden">
      <CardHeader title="Achievements Overview 🏆" subtitle={`${rows.length} total achievement${rows.length !== 1 ? 's' : ''}`} />
      <CardBody className="min-h-0">
        {isLoading ? (
          <div className="flex h-full items-center justify-center text-sm text-slate-500 dark:text-slate-400">
            Loading…
          </div>
        ) : rows.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
            <span className="text-3xl">🏆</span>
            <p className="text-sm text-slate-500 dark:text-slate-400">No achievements yet.</p>
            <p className="text-xs text-slate-400 dark:text-slate-500">Keep working hard!</p>
          </div>
        ) : (
          <div className="flex h-full flex-col gap-2">
            <div className="flex-1 min-h-0" style={{ minHeight: 120 }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius="35%"
                    outerRadius="60%"
                    paddingAngle={3}
                    dataKey="value"
                    animationBegin={0}
                    animationDuration={800}
                  >
                    {pieData.map((entry, i) => (
                      <Cell key={i} fill={entry.color} stroke="transparent" />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      borderRadius: '12px',
                      border: '1px solid rgba(99,102,241,0.2)',
                      background: 'rgba(15,23,42,0.95)',
                      color: '#f1f5f9',
                      fontSize: 12,
                    }}
                    formatter={(value, name) => [`${value ?? 0}`, String(name)]}
                  />
                  <Legend
                    iconType="circle"
                    iconSize={8}
                    formatter={(value) => <span style={{ fontSize: 11, color: '#94a3b8' }}>{value}</span>}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* Mini stat row — glowing badges */}
            <div className="grid grid-cols-2 gap-1.5">
              {pieData.map(d => (
                <div key={d.name}
                  className="flex items-center gap-2 rounded-xl border border-slate-200 dark:border-white/8 bg-white/5 px-2.5 py-1.5"
                  style={{ boxShadow: `0 0 8px ${d.color}22` }}>
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: d.color, boxShadow: `0 0 6px ${d.color}` }} />
                  <span className="truncate text-[11px] font-semibold text-slate-600 dark:text-slate-300">{d.name}</span>
                  <span className="ml-auto text-[11px] font-bold" style={{ color: d.color }}>{d.value}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardBody>
    </Card>
  )
}
