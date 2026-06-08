import express from 'express'
import { z } from 'zod'
import { authenticateJWT, requireRole } from '../middleware/auth'
import { FaceAttendance } from '../models/FaceAttendance'
import { User } from '../models/User'
import { StudentProfile } from '../models/StudentProfile'
import { ParentProfile } from '../models/ParentProfile'
import { asyncHandler } from '../utils/asyncHandler'
import { nowInIST } from '../utils/faceTime'

const router = express.Router()

async function canAccessStudent(
  requesterId: string,
  requesterRole: string,
  studentId: string,
): Promise<boolean> {
  if (requesterRole === 'admin' || requesterRole === 'teacher') return true
  if (requesterRole === 'student') return requesterId === studentId
  if (requesterRole === 'parent') {
    const parent = await ParentProfile.findOne({ userId: requesterId }).lean()
    return parent?.studentId === studentId
  }
  return false
}

function attendanceStats(records: { status: string }[]) {
  const total = records.length
  const present = records.filter((r) => r.status === 'present').length
  const absent = records.filter((r) => r.status === 'absent').length
  const percentage = total > 0 ? Math.round((present / total) * 100) : 0
  return { total, present, absent, percentage }
}

const markSchema = z.object({
  studentId: z.string().min(1),
  classId: z.string().optional().nullable(),
  status: z.enum(['present', 'absent']).default('present'),
  date: z.string().optional(),
  time: z.string().optional(),
})

router.post(
  '/attendance/mark',
  authenticateJWT,
  requireRole(['admin', 'teacher']),
  asyncHandler(async (req, res) => {
    const parsed = markSchema.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({ message: parsed.error.issues[0]?.message ?? 'Invalid payload' })
      return
    }

    const { studentId, status } = parsed.data
    const ist = nowInIST()
    const date = parsed.data.date ?? ist.date
    const time = parsed.data.time ?? ist.time

    const user = await User.findOne({ _id: studentId, role: 'student' }).lean()
    if (!user) {
      res.status(404).json({ message: 'Student not found' })
      return
    }

    const studentProfile = await StudentProfile.findOne({ userId: studentId }).lean()
    const classId = parsed.data.classId ?? studentProfile?.className ?? null

    const existing = await FaceAttendance.findOne({ studentId, date })
    if (existing) {
      res.status(409).json({
        message: `${user.name} is already marked ${existing.status} for ${date}`,
        attendance: {
          id: String(existing._id),
          studentId: existing.studentId,
          studentName: existing.studentName,
          date: existing.date,
          time: existing.time,
          status: existing.status,
        },
      })
      return
    }

    const record = await FaceAttendance.create({
      studentId,
      studentName: user.name,
      classId,
      date,
      time,
      status,
      markedBy: req.auth!.userId,
    })

    res.status(201).json({
      attendance: {
        id: String(record._id),
        studentId: record.studentId,
        studentName: record.studentName,
        classId: record.classId,
        date: record.date,
        time: record.time,
        status: record.status,
        markedBy: record.markedBy,
      },
    })
  }),
)

router.get(
  '/attendance/student/:id',
  authenticateJWT,
  asyncHandler(async (req, res) => {
    const studentId = req.params.id as string
    const allowed = await canAccessStudent(req.auth!.userId, req.auth!.role, studentId)
    if (!allowed) {
      res.status(403).json({ message: 'Forbidden' })
      return
    }

    const records = await FaceAttendance.find({ studentId }).sort({ date: -1, time: -1 }).lean()
    const stats = attendanceStats(records)

    res.json({
      studentId,
      stats,
      attendance: records.map((r) => ({
        id: String(r._id),
        studentId: r.studentId,
        studentName: r.studentName,
        classId: r.classId,
        date: r.date,
        time: r.time,
        status: r.status,
        markedBy: r.markedBy,
      })),
    })
  }),
)

router.get(
  '/attendance/class/:id',
  authenticateJWT,
  requireRole(['admin', 'teacher']),
  asyncHandler(async (req, res) => {
    const classId = req.params.id as string
    const date = typeof req.query.date === 'string' ? req.query.date : undefined

    const filter: { classId: string; date?: string } = { classId }
    if (date) filter.date = date

    const records = await FaceAttendance.find(filter).sort({ time: -1 }).lean()

    res.json({
      classId,
      date: date ?? null,
      attendance: records.map((r) => ({
        id: String(r._id),
        studentId: r.studentId,
        studentName: r.studentName,
        classId: r.classId,
        date: r.date,
        time: r.time,
        status: r.status,
        markedBy: r.markedBy,
      })),
    })
  }),
)

/** Admin: all face attendance records */
router.get(
  '/attendance/face/all',
  authenticateJWT,
  requireRole(['admin']),
  asyncHandler(async (req, res) => {
    const limit = Math.min(Number(req.query.limit) || 200, 500)
    const records = await FaceAttendance.find().sort({ date: -1, time: -1 }).limit(limit).lean()
    res.json({
      attendance: records.map((r) => ({
        id: String(r._id),
        studentId: r.studentId,
        studentName: r.studentName,
        classId: r.classId,
        date: r.date,
        time: r.time,
        status: r.status,
        markedBy: r.markedBy,
      })),
    })
  }),
)

export default router
