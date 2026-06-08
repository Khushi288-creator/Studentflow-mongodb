import express from 'express'
import { authenticateJWT } from '../middleware/auth'
import { User } from '../models/User'
import { Course } from '../models/Course'
import { Assignment } from '../models/Assignment'
import { Attendance } from '../models/Attendance'
import { Fee } from '../models/Fee'
import { Event } from '../models/Event'
import { Notice } from '../models/Notice'
import { Teacher } from '../models/Teacher'
import { StudentEnrollment } from '../models/StudentEnrollment'
import { Submission } from '../models/Submission'

const router = express.Router()

router.get('/dashboard/admin/summary', authenticateJWT, async (req, res) => {
  try {
    const totalStudents = await User.countDocuments({ role: 'student' })
    const totalTeachers = await User.countDocuments({ role: 'teacher' })
    const totalAdmins = await User.countDocuments({ role: 'admin' })
    const totalSubjects = await Course.countDocuments()
    const totalAssignments = await Assignment.countDocuments()

    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
    const attendanceByDay: { day: string; present: number; absent: number }[] = []
    let totalPresent = 0
    let totalAttendance = 0
    for (let i = 6; i >= 0; i--) {
      const d = new Date()
      d.setDate(d.getDate() - i)
      d.setHours(0, 0, 0, 0)
      const next = new Date(d)
      next.setDate(next.getDate() + 1)
      const present = await Attendance.countDocuments({ date: { $gte: d, $lt: next }, status: 'present' })
      const absent = await Attendance.countDocuments({ date: { $gte: d, $lt: next }, status: 'absent' })
      totalPresent += present
      totalAttendance += present + absent
      attendanceByDay.push({ day: days[d.getDay() === 0 ? 6 : d.getDay() - 1], present, absent })
    }
    const attendancePct = totalAttendance > 0 ? Math.round((totalPresent / totalAttendance) * 100) : 0

    const fees = await Fee.find().select('amount status').lean()
    const totalFees = fees.reduce((a, f) => a + f.amount, 0)
    const paidFees = fees.filter((f) => f.status === 'paid').reduce((a, f) => a + f.amount, 0)
    const pendingFees = fees.filter((f) => f.status !== 'paid').reduce((a, f) => a + f.amount, 0)

    const events = await Event.find({ date: { $gte: new Date() } })
      .sort({ date: 1 })
      .limit(5)
      .select('title description date')
      .lean()

    const notices = await Notice.find({ userId: null })
      .sort({ date: -1 })
      .limit(5)
      .select('title description date')
      .lean()

    res.json({
      stats: { totalStudents, totalTeachers, totalAdmins, totalSubjects, totalAssignments, attendancePct },
      attendanceByDay,
      fees: { total: totalFees, paid: paidFees, pending: pendingFees },
      events: events.map((e) => ({
        id: e._id,
        title: e.title,
        description: e.description,
        date: new Date(e.date).toISOString().slice(0, 10),
      })),
      notices: notices.map((n) => ({
        id: n._id,
        title: n.title,
        description: n.description,
        date: new Date(n.date).toISOString().slice(0, 10),
      })),
    })
  } catch (err) {
    console.error('[GET /dashboard/admin/summary]', err)
    res.status(500).json({ message: 'Failed' })
  }
})

router.get('/dashboard/teacher/summary', authenticateJWT, async (req, res) => {
  try {
    if (req.auth!.role !== 'teacher') return res.status(403).json({ message: 'Forbidden' })

    const teacher = await Teacher.findOne({ userId: req.auth!.userId }).select('_id subject').lean()
    if (!teacher) return res.json({ summary: null })

    const courses = await Course.find({ teacherId: teacher._id }).select('name').lean()
    const courseIds = courses.map((c) => c._id)

    const enrollments = await StudentEnrollment.find({ courseId: { $in: courseIds } }).select('userId').lean()
    const uniqueStudents = new Set(enrollments.map((e) => e.userId)).size

    const assignments = await Assignment.find({ courseId: { $in: courseIds } }).select('_id').lean()
    const assignmentIds = assignments.map((a) => a._id)
    const totalAssignments = assignments.length

    const submissions = await Submission.find({ assignmentId: { $in: assignmentIds } })
      .select('marks studentId')
      .lean()
    const enrollmentIds = [...new Set(submissions.map((s) => s.studentId))]
    const submissionEnrollments = await StudentEnrollment.find({ _id: { $in: enrollmentIds } }).lean()
    const enrollmentById = new Map(submissionEnrollments.map((e) => [e._id, e]))
    const userIds = [...new Set(submissionEnrollments.map((e) => e.userId))]
    const users = await User.find({ _id: { $in: userIds } }).select('name').lean()
    const userNameById = new Map(users.map((u) => [u._id, u.name]))

    const submittedCount = submissions.length
    const pendingCount = Math.max(0, totalAssignments * uniqueStudents - submittedCount)

    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)
    const todayAttendance = await Attendance.find({
      courseId: { $in: courseIds },
      date: { $gte: today, $lt: tomorrow },
    })
      .select('status studentId')
      .lean()
    const presentToday = todayAttendance.filter((a) => a.status === 'present').length
    const absentToday = todayAttendance.filter((a) => a.status === 'absent').length
    const lateToday = todayAttendance.filter((a) => a.status === 'late').length

    const marksData = submissions.filter((s) => s.marks != null)
    const avgMarks = marksData.length
      ? Math.round(marksData.reduce((acc, s) => acc + (s.marks ?? 0), 0) / marksData.length)
      : null

    const studentMarksMap = new Map<string, { name: string; marks: number[] }>()
    for (const s of marksData) {
      const enrollment = enrollmentById.get(s.studentId)
      if (!enrollment) continue
      const name = userNameById.get(enrollment.userId) ?? ''
      const uid = enrollment.userId
      if (!studentMarksMap.has(uid)) studentMarksMap.set(uid, { name, marks: [] })
      studentMarksMap.get(uid)!.marks.push(s.marks!)
    }
    const weakStudents = Array.from(studentMarksMap.entries())
      .map(([uid, d]) => ({
        userId: uid,
        name: d.name,
        avg: Math.round(d.marks.reduce((a, b) => a + b, 0) / d.marks.length),
      }))
      .filter((s) => s.avg < 60)
      .sort((a, b) => a.avg - b.avg)
      .slice(0, 5)

    const marksTrend = [1, 2, 3, 4]
      .map((w) => {
        const weekSubmissions = marksData.slice(
          Math.max(0, marksData.length - w * Math.ceil(marksData.length / 4)),
          marksData.length - (w - 1) * Math.ceil(marksData.length / 4),
        )
        const avg = weekSubmissions.length
          ? Math.round(weekSubmissions.reduce((a, s) => a + (s.marks ?? 0), 0) / weekSubmissions.length)
          : 0
        return { label: `Week ${5 - w}`, value: avg }
      })
      .reverse()

    res.json({
      totalStudents: uniqueStudents,
      subjects: courses.map((c) => c.name),
      totalAssignments,
      submittedCount,
      pendingCount,
      attendance: { present: presentToday, absent: absentToday, late: lateToday },
      avgMarks,
      weakStudents,
      marksTrend,
    })
  } catch (err) {
    console.error('[GET /dashboard/teacher/summary]', err)
    res.status(500).json({ message: 'Failed' })
  }
})

router.get('/dashboard/student/summary', authenticateJWT, async (req, res) => {
  try {
    const role = req.auth!.role
    if (role !== 'student' && role !== 'teacher' && role !== 'admin') {
      return res.status(403).json({ message: 'Forbidden' })
    }
    if (role !== 'student') return res.json({ summary: null })

    const now = new Date()
    const nowPlus14 = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)

    const enrollments = await StudentEnrollment.find({ userId: req.auth!.userId })
      .select('_id courseId')
      .lean()

    const courseIds = enrollments.map((e) => e.courseId)
    const studentIds = enrollments.map((e) => e._id)

    const totalCourses = courseIds.length

    const assignments = await Assignment.find({
      courseId: { $in: courseIds },
      dueDate: { $gte: now },
    })
      .sort({ dueDate: 1 })
      .select('_id dueDate courseId')
      .lean()

    let pendingAssignments = 0
    const upcomingAssignments = assignments.filter((a) => new Date(a.dueDate) <= nowPlus14)

    for (const a of assignments) {
      const hasSubmission = await Submission.findOne({
        assignmentId: a._id,
        studentId: { $in: studentIds },
      })
        .select('_id')
        .lean()
      if (!hasSubmission) pendingAssignments += 1
    }

    const attendanceRows = await Attendance.find({ studentId: { $in: studentIds } })
      .select('status')
      .lean()
    const totalAttendance = attendanceRows.length
    const presentCount = attendanceRows.filter((r) => r.status === 'present').length
    const attendancePercentage = totalAttendance === 0 ? 0 : Math.round((presentCount / totalAttendance) * 100)

    const anyFee = await Fee.findOne({ studentId: { $in: studentIds } })
      .sort({ createdAt: -1 })
      .lean()
    const feeStatus = anyFee?.status ?? 'pending'

    const allFees = await Fee.find({ studentId: { $in: studentIds } }).lean()
    const feesPending = allFees.filter((f) => f.status !== 'paid').reduce((a, f) => a + f.amount, 0)

    const submissions = await Submission.find({
      studentId: { $in: studentIds },
      marks: { $ne: null },
    })
      .sort({ createdAt: -1 })
      .limit(4)
      .select('marks assignmentId createdAt')
      .lean()

    const marksTrend = submissions
      .slice()
      .reverse()
      .map((s, idx) => ({
        label: `W${idx + 1}`,
        value: s.marks ?? 0,
      }))

    const latestResult = submissions[0]
    const latestResultPct = latestResult?.marks ?? null

    res.json({
      totalCourses,
      pendingAssignments,
      attendancePercentage,
      feeStatus,
      feesPending,
      latestResultPct,
      upcomingExams: upcomingAssignments.length,
      marksTrend: marksTrend.length
        ? marksTrend
        : [
            { label: 'W1', value: 0 },
            { label: 'W2', value: 0 },
            { label: 'W3', value: 0 },
            { label: 'W4', value: 0 },
          ],
    })
  } catch (err) {
    console.error('[GET /dashboard/student/summary]', err)
    res.status(500).json({ message: 'Failed to load dashboard summary' })
  }
})

export default router
