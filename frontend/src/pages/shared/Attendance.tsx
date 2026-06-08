import React, { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { http } from '../../api/http'
import { useAuthStore } from '../../store/authStore'
import { useAttendanceStore } from '../../store/attendanceStore'
import { Card, CardBody, CardHeader } from '../../components/ui/Card'
import { Page } from '../../components/ui/Page'
import FaceAttendancePanel from '../../components/attendance/FaceAttendancePanel'
import { Link } from 'react-router-dom'

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
function dayFromDate(dateStr: string) {
  const d = new Date(dateStr)
  return isNaN(d.getTime()) ? '—' : DAYS[d.getDay()]
}

type AttendanceRow = { id: string; courseId: string; date: string; status: string }
type Course = { id: string; name: string }
type AttendanceStatus = 'present' | 'absent' | 'late'

const STATUS_STYLES: Record<AttendanceStatus, string> = {
  present: 'bg-emerald-50 text-emerald-700 ring-emerald-300 dark:bg-emerald-900/20 dark:text-emerald-300',
  absent:  'bg-rose-50 text-rose-700 ring-rose-300 dark:bg-rose-900/20 dark:text-rose-300',
  late:    'bg-amber-50 text-amber-700 ring-amber-300 dark:bg-amber-900/20 dark:text-amber-300',
}

// ── Teacher: Mark Attendance section ──────────────────────────────────────
function TeacherMarkAttendance() {
  const queryClient = useQueryClient()
  const [courseId, setCourseId] = useState('')
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [studentName, setStudentName] = useState('')
  const [pending, setPending] = useState<{ name: string; status: AttendanceStatus }[]>([])
  const [saved, setSaved] = useState<{ studentName: string; date: string; status: AttendanceStatus }[]>([])
  const addToStore = useAttendanceStore(s => s.addRecords)

  const { data: courses } = useQuery({
    queryKey: ['teacherCourses'],
    queryFn: async () => (await http.get('/courses?scope=teacher')).data as { courses: Course[] },
  })
  const courseList = courses?.courses ?? []
  // Auto-select first subject
  const activeCourseId = courseId || courseList[0]?.id || ''

  const saveMutation = useMutation({
    mutationFn: async () => {
      await http.post('/attendance/manual', {
        courseId: activeCourseId,
        date,
        students: pending.map(s => ({ studentName: s.name, status: s.status })),
      })
    },
    onSuccess: () => {
      const courseName = courseList.find(c => c.id === activeCourseId)?.name
      addToStore(pending.map(s => ({ studentName: s.name, courseId: activeCourseId, date, status: s.status, courseName })))
      setSaved(prev => [...prev, ...pending.map(s => ({ studentName: s.name, date, status: s.status }))])
      setPending([])
      // Refresh backend attendance records
      queryClient.invalidateQueries({ queryKey: ['attendance'] })
    },
  })

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader title="Mark Attendance" subtitle="Add students and mark status"
          right={<div className="rounded-xl bg-indigo-600/10 px-3 py-1 text-xs font-semibold text-indigo-700 dark:text-indigo-300">Manual</div>} />
        <CardBody className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            {/* Subject — auto from teacher's assigned subjects */}
            {courseList.length > 1 ? (
              <select value={activeCourseId} onChange={e => setCourseId(e.target.value)}
                className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none focus:border-indigo-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-50">
                {courseList.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            ) : (
              <div className="flex h-10 items-center rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-medium text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200">
                {courseList[0]?.name ?? 'No subject assigned'}
              </div>
            )}
            <input type="date" value={date} onChange={e => setDate(e.target.value)}
              className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none focus:border-indigo-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-50" />
          </div>

          <div className="flex gap-2">
            <input value={studentName} onChange={e => setStudentName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && studentName.trim()) { setPending(p => [...p, { name: studentName.trim(), status: 'present' }]); setStudentName('') } }}
              placeholder="Student name, press Enter to add"
              className="h-10 flex-1 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none focus:border-indigo-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-50" />
            <button type="button" disabled={!studentName.trim()}
              onClick={() => { if (!studentName.trim()) return; setPending(p => [...p, { name: studentName.trim(), status: 'present' }]); setStudentName('') }}
              className="rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50">
              Add
            </button>
          </div>

          {pending.length > 0 ? (
            <div className="space-y-1.5">
              {pending.map((s, i) => (
                <div key={i} className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-800 dark:bg-slate-900/20">
                  <span className="text-sm font-medium text-slate-900 dark:text-slate-50">{s.name}</span>
                  <div className="flex gap-1">
                    {(['present', 'absent', 'late'] as AttendanceStatus[]).map(st => (
                      <button key={st} type="button"
                        onClick={() => setPending(p => p.map((x, idx) => idx === i ? { ...x, status: st } : x))}
                        className={['rounded-lg px-2 py-0.5 text-xs font-semibold ring-1 transition-opacity',
                          s.status === st ? STATUS_STYLES[st] : 'opacity-30 ring-slate-200'].join(' ')}>
                        {st[0].toUpperCase() + st.slice(1)}
                      </button>
                    ))}
                    <button type="button" onClick={() => setPending(p => p.filter((_, idx) => idx !== i))}
                      className="ml-1 rounded-lg px-2 py-0.5 text-xs text-slate-400 hover:text-rose-600">✕</button>
                  </div>
                </div>
              ))}
              <button type="button" disabled={!activeCourseId || saveMutation.isPending}
                onClick={() => saveMutation.mutate()}
                className="w-full rounded-2xl bg-indigo-600 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60">
                {saveMutation.isPending ? 'Saving...' : 'Save Attendance'}
              </button>
              {saveMutation.isError && <p className="text-xs text-rose-600">Failed to save. Try again.</p>}
            </div>
          ) : (
            <p className="text-xs text-slate-500 dark:text-slate-400">Add student names above, then set their status.</p>
          )}
        </CardBody>
      </Card>

      {/* Saved records this session */}
      <Card>
        <CardHeader title="Saved This Session" subtitle="Attendance records marked today" />
        <CardBody className="overflow-x-auto">
          {saved.length === 0 ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">No records yet.</p>
          ) : (
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800">
                  <th className="py-2 pr-4 font-semibold text-slate-600 dark:text-slate-300">Student</th>
                  <th className="py-2 pr-4 font-semibold text-slate-600 dark:text-slate-300">Date</th>
                  <th className="py-2 font-semibold text-slate-600 dark:text-slate-300">Status</th>
                </tr>
              </thead>
              <tbody>
                {saved.map((r, i) => (
                  <tr key={i} className="border-b border-slate-100 dark:border-slate-900/60">
                    <td className="py-2 pr-4 font-medium text-slate-900 dark:text-slate-50">{r.studentName}</td>
                    <td className="py-2 pr-4 text-slate-500 text-xs">{r.date}</td>
                    <td className="py-2">
                      <span className={['rounded-lg px-2 py-0.5 text-xs font-semibold ring-1', STATUS_STYLES[r.status]].join(' ')}>
                        {r.status[0].toUpperCase() + r.status.slice(1)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardBody>
      </Card>
    </div>
  )
}

// ── Main Attendance Page ───────────────────────────────────────────────────
export default function Attendance() {
  const { user } = useAuthStore()

  const parentChildQuery = useQuery({
    queryKey: ['parentDashboardChild'],
    queryFn: async () => {
      const res = await http.get('/parents/dashboard')
      return res.data as { child: { id: string; name: string } | null }
    },
    enabled: user?.role === 'parent',
  })

  const attendanceQuery = useQuery({
    queryKey: ['attendance'],
    queryFn: async () => {
      const res = await http.get('/attendance')
      return res.data as { attendance: AttendanceRow[] }
    },
  })

  const allStoreRecords = useAttendanceStore(s => s.records)
  const teacherRows: AttendanceRow[] = user?.name
    ? allStoreRecords
        .filter(r => r.studentName.toLowerCase() === user.name.toLowerCase())
        .map((r, i) => ({ id: `teacher-${i}-${r.date}`, courseId: r.courseId, date: r.date, status: r.status }))
    : []

  const backendRows = attendanceQuery.data?.attendance ?? []
  const mergedRows: AttendanceRow[] = (() => {
    const result = [...backendRows]
    for (const tr of teacherRows) {
      const idx = result.findIndex(r => r.courseId === tr.courseId && r.date === tr.date)
      if (idx >= 0) result[idx] = tr
      else result.push(tr)
    }
    return result.sort((a, b) => b.date.localeCompare(a.date))
  })()

  return (
    <Page
      title="Attendance"
      subtitle={
        user?.role === 'teacher'
          ? 'Mark and view attendance.'
          : user?.role === 'parent'
            ? "Your child's attendance records."
            : 'Your daily attendance record.'
      }
      actions={
        <div className="rounded-2xl bg-indigo-600/10 px-4 py-2 text-sm font-semibold text-indigo-700 dark:text-indigo-300">
          {user?.role === 'student' ? 'Student' : user?.role === 'parent' ? 'Parent' : 'Teacher'}
        </div>
      }>

      {user?.role === 'teacher' && (
        <Card>
          <CardBody className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-sm font-semibold text-slate-900 dark:text-slate-50">Face Recognition Scanner</div>
              <p className="text-xs text-slate-500 dark:text-slate-400">Open the camera to mark attendance automatically.</p>
            </div>
            <Link
              to="/attendance/face-scan"
              className="inline-flex justify-center rounded-2xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
            >
              Open Face Scanner
            </Link>
          </CardBody>
        </Card>
      )}

      {/* Teacher: mark attendance section at top */}
      {user?.role === 'teacher' && <TeacherMarkAttendance />}

      {user?.role === 'student' && user.id && (
        <FaceAttendancePanel studentId={user.id} subtitle="Marked via face recognition at school" />
      )}

      {user?.role === 'parent' && parentChildQuery.data?.child?.id && (
        <FaceAttendancePanel
          studentId={parentChildQuery.data.child.id}
          title={`${parentChildQuery.data.child.name}'s Face Attendance`}
          subtitle="Live updates when scanned at school"
          pollMs={8000}
        />
      )}

      {/* Student: course attendance records */}
      {user?.role === 'student' && (
        <Card>
          <CardHeader title="Course Attendance" subtitle="Subject-wise records from teachers · Date · Day · Status" />
          <CardBody className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800">
                  <th className="py-2 pr-6 font-semibold text-slate-600 dark:text-slate-300">Date</th>
                  <th className="py-2 pr-6 font-semibold text-slate-600 dark:text-slate-300">Day</th>
                  <th className="py-2 pr-6 font-semibold text-slate-600 dark:text-slate-300">Subject</th>
                  <th className="py-2 pr-6 font-semibold text-slate-600 dark:text-slate-300">Class</th>
                  <th className="py-2 font-semibold text-slate-600 dark:text-slate-300">Status</th>
                </tr>
              </thead>
              <tbody>
                {mergedRows.map(r => (
                  <tr key={r.id} className="border-b border-slate-100 dark:border-slate-900/60">
                    <td className="py-3 pr-6 text-slate-600 dark:text-slate-300">{r.date}</td>
                    <td className="py-3 pr-6 text-slate-600 dark:text-slate-300">{dayFromDate(r.date)}</td>
                    <td className="py-3 pr-6 text-slate-600 dark:text-slate-300">{(r as any).courseName ?? '—'}</td>
                    <td className="py-3 pr-6 text-slate-600 dark:text-slate-300">{(r as any).className ? `Class ${(r as any).className}` : '—'}</td>
                    <td className={['py-3 text-sm font-semibold',
                      r.status === 'present' ? 'text-emerald-700 dark:text-emerald-300'
                      : r.status === 'absent' ? 'text-rose-700 dark:text-rose-300'
                      : r.status === 'late' ? 'text-amber-700 dark:text-amber-300'
                      : 'text-slate-700 dark:text-slate-200'].join(' ')}>
                      {r.status.charAt(0).toUpperCase() + r.status.slice(1)}
                    </td>
                  </tr>
                ))}
                {attendanceQuery.isLoading && mergedRows.length === 0 && (
                  <tr><td colSpan={5} className="py-4 text-sm text-slate-500">Loading...</td></tr>
                )}
                {!attendanceQuery.isLoading && mergedRows.length === 0 && (
                  <tr><td colSpan={5} className="py-4 text-sm text-slate-500">No attendance records yet.</td></tr>
                )}
              </tbody>
            </table>
          </CardBody>
        </Card>
      )}

      {/* Teacher: view all attendance records */}
      {user?.role === 'teacher' && (
        <Card>
          <CardHeader title="All Attendance Records" subtitle="All records for your subjects" />
          <CardBody className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800">
                  <th className="py-2 pr-4 font-semibold text-slate-600 dark:text-slate-300">Student</th>
                  <th className="py-2 pr-4 font-semibold text-slate-600 dark:text-slate-300">Class</th>
                  <th className="py-2 pr-4 font-semibold text-slate-600 dark:text-slate-300">Subject</th>
                  <th className="py-2 pr-4 font-semibold text-slate-600 dark:text-slate-300">Date</th>
                  <th className="py-2 font-semibold text-slate-600 dark:text-slate-300">Status</th>
                </tr>
              </thead>
              <tbody>
                {backendRows.map(r => (
                  <tr key={r.id} className="border-b border-slate-100 dark:border-slate-900/60">
                    <td className="py-2 pr-4 font-medium text-slate-900 dark:text-slate-50">{(r as any).studentName ?? '—'}</td>
                    <td className="py-2 pr-4 text-slate-600 dark:text-slate-300">{(r as any).className ? `Class ${(r as any).className}` : '—'}</td>
                    <td className="py-2 pr-4 text-slate-600 dark:text-slate-300">{(r as any).courseName ?? '—'}</td>
                    <td className="py-2 pr-4 text-slate-500 dark:text-slate-400">{r.date}</td>
                    <td className={['py-2 text-sm font-semibold',
                      r.status === 'present' ? 'text-emerald-700 dark:text-emerald-300'
                      : r.status === 'absent' ? 'text-rose-700 dark:text-rose-300'
                      : r.status === 'late' ? 'text-amber-700 dark:text-amber-300'
                      : 'text-slate-700 dark:text-slate-200'].join(' ')}>
                      {r.status.charAt(0).toUpperCase() + r.status.slice(1)}
                    </td>
                  </tr>
                ))}
                {attendanceQuery.isLoading && <tr><td colSpan={5} className="py-4 text-sm text-slate-500">Loading...</td></tr>}
                {!attendanceQuery.isLoading && backendRows.length === 0 && (
                  <tr><td colSpan={5} className="py-4 text-sm text-slate-500">No records yet.</td></tr>
                )}
              </tbody>
            </table>
          </CardBody>
        </Card>
      )}
    </Page>
  )
}
