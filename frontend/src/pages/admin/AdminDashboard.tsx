import React, { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { http } from '../../api/http'
import { Card, CardBody, CardHeader } from '../../components/ui/Card'
import { Page } from '../../components/ui/Page'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend,
  LineChart, Line, CartesianGrid,
  PieChart, Pie, Cell,
} from 'recharts'

// ── Types ──────────────────────────────────────────────────────────────────
type AdminSummary = {
  stats: {
    totalStudents: number
    totalTeachers: number
    totalAdmins: number
    totalSubjects: number
    totalAssignments: number
    attendancePct: number
  }
  attendanceByDay: { day: string; present: number; absent: number }[]
  fees: { total: number; paid: number; pending: number }
  events: { id: string; title: string; description: string; date: string }[]
  notices: { id: string; title: string; description: string; date: string }[]
}

// ── Stat Card — clickable ─────────────────────────────────────────────────
function StatCard({ label, value, color, to }: { label: string; value: number | string; color: string; to?: string }) {
  const navigate = useNavigate()
  return (
    <div
      onClick={() => to && navigate(to)}
      className={`rounded-2xl p-5 text-white ${color} ${to ? 'cursor-pointer hover:opacity-90 transition-opacity' : ''}`}
    >
      <div className="text-3xl font-bold">{value}</div>
      <div className="mt-1 text-sm font-medium opacity-90">{label}</div>
      {to && <div className="mt-1 text-xs opacity-70">Click to view →</div>}
    </div>
  )
}

// ── Mini Calendar ──────────────────────────────────────────────────────────
function MiniCalendar() {
  const today = new Date()
  const [current, setCurrent] = useState(new Date(today.getFullYear(), today.getMonth(), 1))

  const year = current.getFullYear()
  const month = current.getMonth()
  const monthName = current.toLocaleString('default', { month: 'long' })
  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const blanks = Array(firstDay).fill(null)
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1)

  const prev = () => setCurrent(new Date(year, month - 1, 1))
  const next = () => setCurrent(new Date(year, month + 1, 1))

  return (
    <div className="text-sm">
      <div className="flex items-center justify-between mb-3">
        <button onClick={prev} className="px-2 py-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300">‹</button>
        <span className="font-semibold text-slate-800 dark:text-slate-100">{monthName} {year}</span>
        <button onClick={next} className="px-2 py-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300">›</button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">
        {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d => <div key={d}>{d}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-xs">
        {blanks.map((_, i) => <div key={`b${i}`} />)}
        {days.map(d => {
          const isToday = d === today.getDate() && month === today.getMonth() && year === today.getFullYear()
          return (
            <div key={d} className={`rounded-full w-7 h-7 flex items-center justify-center mx-auto cursor-default
              ${isToday ? 'bg-indigo-600 text-white font-bold' : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'}`}>
              {d}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Main Component ─────────────────────────────────────────────────────────
export default function AdminDashboard() {
  const summaryQuery = useQuery({
    queryKey: ['adminSummary'],
    queryFn: async () => {
      const res = await http.get('/dashboard/admin/summary')
      return res.data as AdminSummary
    },
  })

  const s = summaryQuery.data
  const stats = s?.stats
  const attendanceData = s?.attendanceByDay ?? []
  const feeSummary = s?.fees
  const feeChartData = feeSummary ? [
    { name: 'Paid', value: feeSummary.paid },
    { name: 'Pending', value: feeSummary.pending },
  ] : []

  return (
    <Page title="Dashboard" subtitle="School overview" actions={
      <button type="button" onClick={() => window.open('/api/admin/reports/summary.pdf', '_blank')}
        className="rounded-2xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700">
        Download Report
      </button>
    }>

      {/* ── Row 1: Stat Cards ── */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <StatCard label="Total Students"   value={stats?.totalStudents ?? 0}   color="bg-amber-400"   to="/admin/students" />
        <StatCard label="Total Teachers"   value={stats?.totalTeachers ?? 0}   color="bg-violet-500"  to="/admin/teachers" />
        <StatCard label="Attendance %"     value={stats?.attendancePct != null ? `${stats.attendancePct}%` as any : 0} color="bg-emerald-500" />
        <StatCard label="Pending Fees ₹"  value={feeSummary?.pending ?? 0}    color="bg-rose-500"    to="/fees" />
        <StatCard label="Assignments"      value={stats?.totalAssignments ?? 0} color="bg-indigo-500"  to="/assignments" />
      </div>

      {/* ── Row 2: Charts + Calendar ── */}
      <div className="grid gap-4 lg:grid-cols-12">

        {/* Students donut */}
        <Card className="lg:col-span-3">
          <CardHeader title="Students" subtitle="Enrolled count" />
          <CardBody>
            <div style={{ height: 180 }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={[{ name: 'Students', value: stats?.totalStudents ?? 0 }]}
                    dataKey="value" innerRadius={50} outerRadius={70} stroke="none">
                    <Cell fill="#f59e0b" />
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-2 text-center text-2xl font-bold text-slate-800 dark:text-slate-100">
              {stats?.totalStudents ?? 0}
            </div>
            <div className="text-center text-xs text-slate-500">Total Students</div>
          </CardBody>
        </Card>

        {/* Attendance bar chart */}
        <Card className="lg:col-span-5">
          <CardHeader title="Attendance" subtitle="Last 7 days" />
          <CardBody>
            <div style={{ height: 200 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={attendanceData} barSize={10}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="present" fill="#818cf8" radius={[4,4,0,0]} />
                  <Bar dataKey="absent" fill="#fbbf24" radius={[4,4,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardBody>
        </Card>

        {/* Calendar */}
        <Card className="lg:col-span-4">
          <CardHeader title="Calendar" subtitle={new Date().toLocaleString('default', { month: 'long', year: 'numeric' })} />
          <CardBody>
            <MiniCalendar />
          </CardBody>
        </Card>
      </div>

      {/* ── Row 3: Finance + Events + Announcements ── */}
      <div className="grid gap-4 lg:grid-cols-12">

        {/* Finance line chart */}
        <Card className="lg:col-span-5">
          <CardHeader title="Finance" subtitle="Paid vs Pending fees" />
          <CardBody>
            <div style={{ height: 180 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={feeChartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                 <Tooltip
  formatter={(value) => [`₹${value ?? 0}`, 'Amount']}
/>
                  <Line type="monotone" dataKey="value" stroke="#818cf8" strokeWidth={2} dot={{ r: 5 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-3 flex gap-4 text-xs">
              <div><span className="font-semibold text-emerald-600">₹{feeSummary?.paid ?? 0}</span> Paid</div>
              <div><span className="font-semibold text-amber-600">₹{feeSummary?.pending ?? 0}</span> Pending</div>
              <div><span className="font-semibold text-slate-600">₹{feeSummary?.total ?? 0}</span> Total</div>
            </div>
          </CardBody>
        </Card>

        {/* Events */}
        <Card className="lg:col-span-3">
          <CardHeader title="Events" subtitle="Upcoming" />
          <CardBody className="space-y-3">
            {(s?.events ?? []).length === 0 && <p className="text-xs text-slate-500">No upcoming events.</p>}
            {(s?.events ?? []).map(e => (
              <div key={e.id} className="border-b border-slate-100 dark:border-slate-800 pb-2 last:border-0">
                <div className="font-semibold text-sm text-slate-800 dark:text-slate-100">{e.title}</div>
                <div className="text-xs text-slate-500 mt-0.5">{e.description}</div>
                <div className="text-xs text-indigo-500 mt-0.5">{e.date}</div>
              </div>
            ))}
          </CardBody>
        </Card>

        {/* Announcements */}
        <Card className="lg:col-span-4">
          <CardHeader title="Announcements" subtitle="Recent notices" />
          <CardBody className="space-y-3">
            {(s?.notices ?? []).length === 0 && <p className="text-xs text-slate-500">No announcements yet.</p>}
            {(s?.notices ?? []).map(n => (
              <div key={n.id} className="border-b border-slate-100 dark:border-slate-800 pb-2 last:border-0">
                <div className="font-semibold text-sm text-slate-800 dark:text-slate-100">{n.title}</div>
                <div className="text-xs text-slate-500 mt-0.5 line-clamp-2">{n.description}</div>
                <div className="text-xs text-slate-400 mt-0.5">{n.date}</div>
              </div>
            ))}
          </CardBody>
        </Card>
      </div>

    </Page>
  )
}
