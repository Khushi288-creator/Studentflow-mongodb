import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { http } from '../../api/http'
import { Card, CardBody, CardHeader } from '../../components/ui/Card'
import { Page } from '../../components/ui/Page'
import type { FaceAttendanceRecord } from '../../types/faceAttendance'

export default function AdminFaceAttendance() {
  const [classFilter, setClassFilter] = useState('')
  const [dateFilter, setDateFilter] = useState('')

  const { data, isLoading, isError } = useQuery({
    queryKey: ['adminFaceAttendance'],
    queryFn: async () => {
      const res = await http.get('/attendance/face/all')
      return res.data as { attendance: FaceAttendanceRecord[] }
    },
  })

  const rows = (data?.attendance ?? []).filter((r) => {
    if (classFilter && r.classId !== classFilter) return false
    if (dateFilter && r.date !== dateFilter) return false
    return true
  })

  const classes = Array.from(new Set((data?.attendance ?? []).map((r) => r.classId).filter(Boolean) as string[])).sort()

  return (
    <Page title="Face Attendance Records" subtitle="All students marked via face recognition">
      <Card>
        <CardHeader
          title="Attendance Log"
          subtitle={`${rows.length} record(s)`}
          right={
            <div className="flex flex-wrap gap-2">
              <select
                value={classFilter}
                onChange={(e) => setClassFilter(e.target.value)}
                className="h-9 rounded-xl border border-slate-200 bg-white px-2 text-xs dark:border-slate-800 dark:bg-slate-900 dark:text-slate-50"
              >
                <option value="">All classes</option>
                {classes.map((c) => (
                  <option key={c} value={c}>
                    Class {c}
                  </option>
                ))}
              </select>
              <input
                type="date"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="h-9 rounded-xl border border-slate-200 bg-white px-2 text-xs dark:border-slate-800 dark:bg-slate-900 dark:text-slate-50"
              />
            </div>
          }
        />
        <CardBody className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800">
                <th className="py-2 pr-4 font-semibold text-slate-600 dark:text-slate-300">Student</th>
                <th className="py-2 pr-4 font-semibold text-slate-600 dark:text-slate-300">Class</th>
                <th className="py-2 pr-4 font-semibold text-slate-600 dark:text-slate-300">Date</th>
                <th className="py-2 pr-4 font-semibold text-slate-600 dark:text-slate-300">Time</th>
                <th className="py-2 font-semibold text-slate-600 dark:text-slate-300">Status</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr>
                  <td colSpan={5} className="py-4 text-slate-500">
                    Loading...
                  </td>
                </tr>
              )}
              {isError && (
                <tr>
                  <td colSpan={5} className="py-4 text-rose-600">
                    Failed to load records. Is MongoDB connected?
                  </td>
                </tr>
              )}
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-slate-100 dark:border-slate-900/60">
                  <td className="py-2 pr-4 font-medium text-slate-900 dark:text-slate-50">{r.studentName}</td>
                  <td className="py-2 pr-4 text-slate-600">{r.classId ? `Class ${r.classId}` : '—'}</td>
                  <td className="py-2 pr-4 text-slate-500">{r.date}</td>
                  <td className="py-2 pr-4 text-slate-500 text-xs">{r.time}</td>
                  <td
                    className={[
                      'py-2 font-semibold capitalize',
                      r.status === 'present' ? 'text-emerald-700' : 'text-rose-700',
                    ].join(' ')}
                  >
                    {r.status}
                  </td>
                </tr>
              ))}
              {!isLoading && !isError && rows.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-4 text-slate-500">
                    No face attendance records yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </CardBody>
      </Card>
    </Page>
  )
}
