import { Link, useLocation } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'
import { cn } from '../ui/cn'

type Item = { label: string; to: string; roles?: Array<'student' | 'teacher' | 'admin' | 'parent'> }

const items: Item[] = [
  { label: 'Dashboard', to: '/dashboard', roles: ['student', 'teacher', 'admin', 'parent'] },
  { label: 'Students', to: '/admin/students', roles: ['admin'] },
  { label: 'Teachers', to: '/admin/teachers', roles: ['admin'] },
  { label: 'Parents', to: '/admin/parents', roles: ['admin'] },
  { label: 'Subjects', to: '/admin/subjects', roles: ['admin'] },
  { label: 'Fees', to: '/fees', roles: ['admin'] },
  { label: 'Timetable', to: '/admin/timetable', roles: ['admin'] },
  { label: 'Salary', to: '/admin/salary', roles: ['admin'] },
  { label: 'Skill Hub', to: '/admin/skill-hub', roles: ['admin'] },
  { label: 'Subjects', to: '/courses', roles: ['student', 'teacher'] },
  { label: 'Assignments', to: '/assignments', roles: ['student', 'teacher'] },
  { label: 'Attendance', to: '/attendance', roles: ['student', 'teacher'] },
  { label: 'Face Scanner', to: '/attendance/face-scan', roles: ['teacher', 'admin'] },
  { label: 'Face Attendance', to: '/admin/face-attendance', roles: ['admin'] },
  { label: 'Results', to: '/results', roles: ['student', 'teacher', 'admin'] },
  { label: 'Fees', to: '/fees', roles: ['student'] },
  { label: 'Events', to: '/events', roles: ['student', 'teacher', 'admin'] },
  { label: 'Holidays', to: '/holidays', roles: ['student', 'admin'] },
  { label: 'Attendance', to: '/attendance', roles: ['parent'] },
  { label: 'Notifications', to: '/notifications', roles: ['student', 'admin', 'parent'] },
  { label: 'Student Hub', to: '/profile', roles: ['student'] },
  { label: 'Profile',     to: '/profile', roles: ['teacher'] },
  { label: 'Salary',      to: '/salary',  roles: ['teacher'] },
  { label: 'Support Center', to: '/contact', roles: ['student'] },
  { label: 'Skill Hub', to: '/skill-hub', roles: ['student'] },
  { label: 'Teacher Support', to: '/contact', roles: ['teacher'] },
  { label: 'Contact',         to: '/contact', roles: ['admin'] },
  { label: 'Student Achievements', to: '/achievements', roles: ['teacher'] },
  { label: 'Student Achievements', to: '/achievements', roles: ['admin'] },
]

function Brand() {
  return (
    <div className="flex items-center gap-2 px-3 py-2">
      <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-indigo-600 text-white">
        <span className="text-sm font-bold tracking-tight">SF</span>
      </div>
      <div className="min-w-0">
        <div className="truncate font-semibold tracking-tight text-slate-900 dark:text-slate-50">
          Student<span className="text-indigo-600">Flow</span>
        </div>
        <div className="truncate text-xs text-slate-500 dark:text-slate-400">Student management</div>
      </div>
    </div>
  )
}

export default function Sidebar() {
  const { user } = useAuthStore()
  const location = useLocation()
  const role = user?.role

  return (
    <aside className="hidden sticky top-0 h-screen w-[280px] shrink-0 border-r border-slate-200/60 bg-white/50 backdrop-blur dark:border-slate-800 dark:bg-slate-950/20 lg:flex lg:flex-col">
      <div className="flex h-full flex-col p-3">
        <Brand />

        <div className="mt-3 flex-1 overflow-y-auto pr-1">
          <div className="space-y-1">
            {items
              .filter((it) => !it.roles || (role ? it.roles.includes(role) : false))
              .map((it) => {
                const active = location.pathname === it.to
                return (
                  <Link
                    key={it.label + it.to}
                    to={it.to}
                    className={cn(
                      'group flex items-center justify-between rounded-2xl px-3 py-2 text-sm font-semibold transition',
                      active
                        ? 'bg-indigo-600 text-white'
                        : 'text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-900/60',
                    )}
                  >
                    <span>{it.label}</span>
                    <span
                      className={cn(
                        'rounded-xl px-2 py-0.5 text-[11px] font-semibold',
                        active ? 'bg-white/15 text-white' : 'bg-slate-100 text-slate-500 dark:bg-slate-900/60 dark:text-slate-400',
                      )}
                    >
                      →
                    </span>
                  </Link>
                )
              })}
          </div>
        </div>

        <div className="mt-3 rounded-2xl border border-slate-200 bg-white/60 p-3 text-xs text-slate-600 dark:border-slate-800 dark:bg-slate-950/30 dark:text-slate-300">
          <div className="font-semibold text-slate-900 dark:text-slate-50">Tip</div>
          <div className="mt-1">Use the search bar above to quickly jump to pages.</div>
        </div>
      </div>
    </aside>
  )
}

