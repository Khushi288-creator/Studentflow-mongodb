import React from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { http } from '../../api/http'
import { Card, CardBody, CardHeader } from '../../components/ui/Card'
import { Page } from '../../components/ui/Page'
import { useAuthStore } from '../../store/authStore'
import { DEFAULT_SUBJECTS } from '../../lib/defaultSubjects'

type Course = { id: string; name: string; teacherName?: string }

export default function Courses() {
  const { user } = useAuthStore()
  const isStudent = user?.role === 'student'

  const { data, isLoading } = useQuery({
    queryKey: ['courses'],
    queryFn: async () => {
      const res = await http.get('/courses')
      return res.data as { courses: Course[] }
    },
  })

  const dynamicCourses = data?.courses ?? []
  // Only show default subjects if DB has NO courses at all
  // If DB has courses, show only DB courses (with teacher names)
  const subjects: Course[] =
  dynamicCourses.length > 0
    ? dynamicCourses
    : DEFAULT_SUBJECTS.map((s) => ({
        id: s.id,
        name: s.name,
        teacherName: undefined,
      }))

  return (
    <Page
      title="Subjects"
      subtitle="Explore your subjects and start assignments."
      actions={
        <Link
          to="/assignments"
          className="rounded-2xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
        >
          Go to Assignments
        </Link>
      }
    >
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {isLoading ? <div className="text-sm text-slate-500">Loading subjects...</div> : null}
        {subjects.map((c) => {
          const isDefault = c.id.startsWith('default-')
          return (
            <Card key={c.id}>
              <CardHeader
                title={c.name}
                subtitle={c.teacherName ? `Teacher: ${c.teacherName}` : 'No teacher assigned'}
                right={
                  <div className="rounded-xl bg-indigo-600/10 px-3 py-1 text-xs font-semibold text-indigo-700 dark:text-indigo-300">
                    Active
                  </div>
                }
              />
              <CardBody>
                <div className="flex gap-2">
                  {!isDefault ? (
                    <Link
                      to={`/assignments?courseId=${encodeURIComponent(c.id)}`}
                      className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950/30 dark:text-slate-50"
                    >
                      View Assignments
                    </Link>
                  ) : (
                    <span className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm text-slate-400 dark:border-slate-800 dark:bg-slate-900/20">
                      Core Subject
                    </span>
                  )}
                </div>
              </CardBody>
            </Card>
          )
        })}
        {!isLoading && subjects.length === 0 ? (
          <Card className="border-dashed bg-white/50 p-8 text-center text-sm text-slate-500 dark:bg-slate-950/30">
            No subjects found yet.{!isStudent ? ' Ask admin to create subjects.' : ''}
          </Card>
        ) : null}
      </div>
    </Page>
  )
}

