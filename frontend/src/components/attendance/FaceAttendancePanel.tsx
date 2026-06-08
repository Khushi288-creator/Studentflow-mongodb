import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { http } from '../../api/http'
import { Card, CardBody, CardHeader } from '../ui/Card'
import AttendanceCalendar from './AttendanceCalendar'
import type { FaceAttendanceStudentResponse } from '../../types/faceAttendance'

const STATUS_STYLE = {
  present: 'text-emerald-700 dark:text-emerald-300',
  absent: 'text-rose-700 dark:text-rose-300',
} as const

export default function FaceAttendancePanel({
  studentId,
  title = 'Face Recognition Attendance',
  subtitle = 'Daily records marked via camera',
  pollMs,
}: {
  studentId: string
  title?: string
  subtitle?: string
  pollMs?: number
}) {
  const today = new Date()
  const [calYear, setCalYear] = useState(today.getFullYear())
  const [calMonth, setCalMonth] = useState(today.getMonth())

  const query = useQuery({
    queryKey: ['faceAttendance', studentId],
    queryFn: async () =>
      (await http.get(`/attendance/student/${studentId}`)).data as FaceAttendanceStudentResponse,
    enabled: !!studentId,
    refetchInterval: pollMs,
  })

  const records = query.data?.attendance ?? []
  const stats = query.data?.stats ?? { total: 0, present: 0, absent: 0, percentage: 0 }

  const monthRecords = useMemo(
    () =>
      records.filter((r) => {
        const [y, m] = r.date.split('-').map(Number)
        return y === calYear && m === calMonth + 1
      }),
    [records, calYear, calMonth],
  )

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader title={title} subtitle={subtitle} />
        <CardBody className="space-y-4">
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-2xl bg-emerald-50 p-3 dark:bg-emerald-950/30">
              <div className="text-2xl font-bold text-emerald-700 dark:text-emerald-300">{stats.present}</div>
              <div className="text-xs text-slate-600 dark:text-slate-400">Present</div>
            </div>
            <div className="rounded-2xl bg-rose-50 p-3 dark:bg-rose-950/30">
              <div className="text-2xl font-bold text-rose-700 dark:text-rose-300">{stats.absent}</div>
              <div className="text-xs text-slate-600 dark:text-slate-400">Absent</div>
            </div>
            <div className="rounded-2xl bg-indigo-50 p-3 dark:bg-indigo-950/30">
              <div className="text-2xl font-bold text-indigo-700 dark:text-indigo-300">{stats.percentage}%</div>
              <div className="text-xs text-slate-600 dark:text-slate-400">Attendance</div>
            </div>
          </div>

          {query.isLoading ? (
            <p className="text-sm text-slate-500">Loading attendance...</p>
          ) : query.isError ? (
            <p className="text-sm text-rose-600">Could not load face attendance records.</p>
          ) : records.length === 0 ? (
            <p className="text-sm text-slate-500">No face attendance records yet.</p>
          ) : (
            <div className="max-h-64 overflow-y-auto">
              <table className="min-w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800">
                    <th className="py-2 pr-4 font-semibold text-slate-600 dark:text-slate-300">Date</th>
                    <th className="py-2 pr-4 font-semibold text-slate-600 dark:text-slate-300">Time</th>
                    <th className="py-2 font-semibold text-slate-600 dark:text-slate-300">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {records.map((r) => (
                    <tr key={r.id} className="border-b border-slate-100 dark:border-slate-900/60">
                      <td className="py-2 pr-4 text-slate-600 dark:text-slate-300">{r.date}</td>
                      <td className="py-2 pr-4 text-slate-500 text-xs">{r.time}</td>
                      <td className={['py-2 text-sm font-semibold capitalize', STATUS_STYLE[r.status]].join(' ')}>
                        {r.status}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardBody>
      </Card>

      <AttendanceCalendar
        year={calYear}
        month={calMonth}
        records={monthRecords.map((r) => ({ date: r.date, status: r.status }))}
        onMonthChange={(y, m) => {
          setCalYear(y)
          setCalMonth(m)
        }}
      />
    </div>
  )
}
