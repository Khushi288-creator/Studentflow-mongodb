import { useEffect } from 'react'
import { Route, Routes, useLocation } from 'react-router-dom'
import { useAuthStore } from './store/authStore'
import Home from './pages/Home'
import Login from './pages/Login'
import Signup from './pages/Signup'
import StudentDashboard from './pages/student/StudentDashboard'
import TeacherDashboard from './pages/teacher/TeacherDashboard'
import TeacherProfile from './pages/teacher/TeacherProfile'
import TeacherSalary from './pages/teacher/TeacherSalary'
import AdminDashboard from './pages/admin/AdminDashboard'
import AdminStudents from './pages/admin/AdminStudents'
import AdminTeachers from './pages/admin/AdminTeachers'
import AdminSubjects from './pages/admin/AdminSubjects'
import AdminSalary from './pages/admin/AdminSalary'
import AdminTimetable from './pages/admin/AdminTimetable'
import AdminSkillHub from './pages/admin/AdminSkillHub'
import AdminParents from './pages/admin/AdminParents'
import SkillHub from './pages/student/SkillHub'
import ParentDashboard from './pages/parent/ParentDashboard'
import Courses from './pages/shared/Courses'
import Assignments from './pages/shared/Assignments'
import Attendance from './pages/shared/Attendance'
import FaceAttendanceScan from './pages/teacher/FaceAttendanceScan'
import AdminFaceAttendance from './pages/admin/AdminFaceAttendance'
import Result from './pages/shared/Result'
import Fee from './pages/shared/Fee'
import Events from './pages/shared/Events'
import Holidays from './pages/shared/Holidays'
import Profile from './pages/shared/Profile'
import Notifications from './pages/shared/Notifications'
import Contact from './pages/shared/Contact'
import Achievements from './pages/shared/Achievements'
import NotFound from './pages/NotFound'
import RequireRole from './components/routing/RequireRole'
import RequireAuth from './components/routing/RequireAuth'
import { http } from './api/http'
import AppLayout from './components/layout/AppLayout'
import DashboardLayout from './components/layout/DashboardLayout'

function DashboardSwitch() {
  const { user } = useAuthStore()
  if (!user) return null
  if (user.role === 'student') return <StudentDashboard />
  if (user.role === 'teacher') return <TeacherDashboard />
  if (user.role === 'parent') return <ParentDashboard />
  return <AdminDashboard />
}

function ProfileSwitch() {
  const { user } = useAuthStore()
  if (user?.role === 'teacher') return <TeacherProfile />
  return <Profile />
}

export default function App() {
  const { hydrateFromStorage, accessToken, user, setAuth, clearAuth } = useAuthStore()
  const location = useLocation()

  useEffect(() => {
    hydrateFromStorage()
  }, [hydrateFromStorage])

  useEffect(() => {
    // If we have a token but no user, fetch /me so role-based routes work.
    if (!accessToken || user) return
    ;(async () => {
      try {
        const res = await http.get('/me')
        setAuth({ accessToken: accessToken ?? '', user: res.data.user })
      } catch {
        clearAuth()
      }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken])

  useEffect(() => {
    // Smooth scroll on route changes.
    window.scrollTo(0, 0)
  }, [location.pathname])

  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />

        {/* 404 */}
        <Route path="*" element={<NotFound />} />
      </Route>

      {/* Authenticated app (dashboard layout) */}
      <Route
        element={
          <RequireRole roles={['student', 'teacher', 'admin', 'parent']}>
            <DashboardLayout />
          </RequireRole>
        }
      >
        <Route path="/dashboard" element={<DashboardSwitch />} />
        <Route path="/courses" element={<Courses />} />
        <Route path="/assignments" element={<Assignments />} />
        <Route path="/attendance" element={<Attendance />} />
        <Route
          path="/attendance/face-scan"
          element={
            <RequireRole roles={['teacher', 'admin']}>
              <FaceAttendanceScan />
            </RequireRole>
          }
        />
        <Route
          path="/admin/face-attendance"
          element={
            <RequireRole roles={['admin']}>
              <AdminFaceAttendance />
            </RequireRole>
          }
        />
        <Route path="/results" element={<Result />} />
        <Route path="/fees" element={<Fee />} />
        <Route path="/events" element={<Events />} />
        <Route path="/holidays" element={<Holidays />} />
        <Route path="/profile" element={<ProfileSwitch />} />
        <Route path="/notifications" element={<Notifications />} />
        <Route path="/contact" element={<Contact />} />
        <Route path="/achievements" element={<Achievements />} />
        {/* Admin pages */}
        <Route path="/admin/students" element={<AdminStudents />} />
        <Route path="/admin/teachers" element={<AdminTeachers />} />
        <Route path="/admin/subjects" element={<AdminSubjects />} />
        <Route path="/admin/salary" element={<AdminSalary />} />
        <Route path="/admin/timetable" element={<AdminTimetable />} />
        <Route path="/admin/skill-hub" element={<AdminSkillHub />} />
        <Route path="/admin/parents" element={<AdminParents />} />
        <Route path="/skill-hub" element={<SkillHub />} />
        <Route path="/salary" element={<TeacherSalary />} />
      </Route>
    </Routes>
  )
}

