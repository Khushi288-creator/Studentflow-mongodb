import express from 'express'
import crypto from 'crypto'
import { z } from 'zod'
import { authenticateJWT, requireRole } from '../middleware/auth'
import { StudentEnrollment } from '../models/StudentEnrollment'
import { Attendance } from '../models/Attendance'
import { Teacher } from '../models/Teacher'
import { Course } from '../models/Course'
import { User } from '../models/User'
import { StudentProfile } from '../models/StudentProfile'
import { AttendanceQrToken } from '../models/AttendanceQrToken'

const router = express.Router()

function toLocalDate(d: Date): string {
  const offset = 5.5 * 60 * 60 * 1000
  return new Date(d.getTime() + offset).toISOString().slice(0, 10)
}

router.get('/attendance', authenticateJWT, async (req, res) => {
  const role = req.auth!.role

  if (role === 'student') {
    const enrollments = await StudentEnrollment.find({ userId: req.auth!.userId }).select('_id').lean()
    const studentIds = enrollments.map((e) => e._id)
    const attendance = await Attendance.find({ studentId: { $in: studentIds } })
      .sort({ date: -1 })
      .lean()

    const courseIds = [...new Set(attendance.map((a) => a.courseId))]
    const courses = await Course.find({ _id: { $in: courseIds } }).select('name').lean()
    const courseNameById = new Map(courses.map((c) => [c._id, c.name]))

    const enrollmentById = new Map(enrollments.map((e) => [e._id, e]))
    const profile = await StudentProfile.findOne({ userId: req.auth!.userId }).select('className').lean()
    const className = profile?.className ?? null

    return res.json({
      attendance: attendance.map((a) => ({
        id: a._id,
        courseId: a.courseId,
        courseName: courseNameById.get(a.courseId) ?? '',
        date: toLocalDate(new Date(a.date)),
        status: a.status,
        className: enrollmentById.has(a.studentId) ? className : null,
      })),
    })
  }

  if (role === 'teacher') {
    const teacher = await Teacher.findOne({ userId: req.auth!.userId }).select('_id').lean()
    if (!teacher) return res.json({ attendance: [] })
    const courses = await Course.find({ teacherId: teacher._id }).select('_id name').lean()
    const courseIds = courses.map((c) => c._id)
    const courseNameById = new Map(courses.map((c) => [c._id, c.name]))

    const attendance = await Attendance.find({ courseId: { $in: courseIds } }).sort({ date: -1 }).lean()
    const enrollmentIds = [...new Set(attendance.map((a) => a.studentId))]
    const enrollments = await StudentEnrollment.find({ _id: { $in: enrollmentIds } }).lean()
    const enrollmentById = new Map(enrollments.map((e) => [e._id, e]))
    const userIds = [...new Set(enrollments.map((e) => e.userId))]
    const users = await User.find({ _id: { $in: userIds } }).select('name').lean()
    const profiles = await StudentProfile.find({ userId: { $in: userIds } }).select('userId className').lean()
    const userNameById = new Map(users.map((u) => [u._id, u.name]))
    const classNameByUserId = new Map(profiles.map((p) => [p.userId, p.className]))

    return res.json({
      attendance: attendance.map((a) => {
        const enrollment = enrollmentById.get(a.studentId)
        const userId = enrollment?.userId
        return {
          id: a._id,
          courseId: a.courseId,
          courseName: courseNameById.get(a.courseId) ?? '',
          studentName: userId ? (userNameById.get(userId) ?? '') : '',
          date: toLocalDate(new Date(a.date)),
          status: a.status,
          className: userId ? (classNameByUserId.get(userId) ?? null) : null,
        }
      }),
    })
  }

  const attendance = await Attendance.find().sort({ date: -1 }).lean()
  const courseIds = [...new Set(attendance.map((a) => a.courseId))]
  const courses = await Course.find({ _id: { $in: courseIds } }).select('name').lean()
  const courseNameById = new Map(courses.map((c) => [c._id, c.name]))

  return res.json({
    attendance: attendance.map((a) => ({
      id: a._id,
      courseId: a.courseId,
      courseName: courseNameById.get(a.courseId) ?? '',
      date: toLocalDate(new Date(a.date)),
      status: a.status,
    })),
  })
})

router.post('/attendance/manual', authenticateJWT, requireRole(['teacher']), async (req, res) => {
  const schema = z.object({
    courseId: z.string().min(1),
    date: z.string().min(1),
    students: z.array(z.object({
      studentName: z.string().min(1),
      status: z.enum(['present', 'absent', 'late']),
    })).min(1),
  })
  const parsed = schema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ message: parsed.error.issues[0]?.message })
  const { courseId, date, students } = parsed.data

  const teacher = await Teacher.findOne({ userId: req.auth!.userId }).select('_id').lean()
  if (!teacher) return res.status(403).json({ message: 'Teacher profile missing' })
  const course = await Course.findOne({ _id: courseId, teacherId: teacher._id }).select('_id').lean()
  if (!course) return res.status(403).json({ message: 'Not your course' })

  const attendanceDate = new Date(date)
  attendanceDate.setHours(0, 0, 0, 0)

  const allStudents = await User.find({ role: 'student' }).select('name').lean()

  const results = []
  for (const s of students) {
    const searchName = s.studentName.toLowerCase().trim()
    const user = allStudents.find((u) =>
      u.name.toLowerCase() === searchName ||
      u.name.toLowerCase().includes(searchName) ||
      searchName.includes(u.name.toLowerCase().split(' ')[0]),
    )
    if (!user) {
      results.push({ studentName: s.studentName, status: s.status, saved: false, reason: 'Student not found' })
      continue
    }

    let enrollment = await StudentEnrollment.findOne({ userId: user._id, courseId }).lean()
    if (!enrollment) {
      const created = await StudentEnrollment.create({
        userId: user._id,
        courseId,
        phone: 'NA',
      })
      enrollment = created.toObject()
    }

    await Attendance.findOneAndUpdate(
      { studentId: enrollment._id, courseId, date: attendanceDate },
      {
        $set: { status: s.status },
        $setOnInsert: { studentId: enrollment._id, courseId, date: attendanceDate },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    )
    results.push({ studentName: s.studentName, status: s.status, saved: true })
  }

  res.json({ saved: results.filter((r) => (r as any).saved !== false).length, results })
})

router.post('/attendance/qr/generate', authenticateJWT, requireRole(['teacher']), async (req, res) => {
  const parsed = z.object({ courseId: z.string().min(1) }).safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ message: parsed.error.issues[0]?.message })
  const { courseId } = parsed.data

  const teacher = await Teacher.findOne({ userId: req.auth!.userId }).select('_id').lean()
  if (!teacher) return res.status(403).json({ message: 'Teacher profile missing' })

  const course = await Course.findOne({ _id: courseId, teacherId: teacher._id }).select('_id').lean()
  if (!course) return res.status(403).json({ message: 'Not allowed for this course' })

  const token = crypto.randomBytes(16).toString('hex')
  const attendanceDate = new Date()
  attendanceDate.setHours(0, 0, 0, 0)
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000)

  const qr = await AttendanceQrToken.create({
    courseId,
    token,
    attendanceDate,
    expiresAt,
  })

  res.status(201).json({
    token: qr.token,
    attendanceDate: toLocalDate(qr.attendanceDate),
  })
})

router.post('/attendance/qr/check-in', authenticateJWT, requireRole(['student']), async (req, res) => {
  const parsed = z.object({ token: z.string().min(1) }).safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ message: parsed.error.issues[0]?.message })
  const { token } = parsed.data

  const qr = await AttendanceQrToken.findOne({ token }).lean()
  if (!qr) return res.status(400).json({ message: 'Invalid token' })
  if (qr.expiresAt < new Date()) return res.status(400).json({ message: 'Token expired' })

  let enrollment = await StudentEnrollment.findOne({
    userId: req.auth!.userId,
    courseId: qr.courseId,
  }).lean()
  if (!enrollment) {
    const created = await StudentEnrollment.create({
      userId: req.auth!.userId,
      courseId: qr.courseId,
      phone: 'NA',
    })
    enrollment = created.toObject()
  }

  await Attendance.findOneAndUpdate(
    {
      studentId: enrollment._id,
      courseId: qr.courseId,
      date: qr.attendanceDate,
    },
    {
      $set: { status: 'present' },
      $setOnInsert: {
        studentId: enrollment._id,
        courseId: qr.courseId,
        date: qr.attendanceDate,
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  )

  res.json({ ok: true })
})

export default router
