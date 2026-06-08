import express from 'express'
import { z } from 'zod'
import { authenticateJWT, requireRole } from '../middleware/auth'
import { Activity } from '../models/Activity'
import { ActivityFaculty } from '../models/ActivityFaculty'
import { ActivityEnrollment } from '../models/ActivityEnrollment'
import { ActivityCertificate } from '../models/ActivityCertificate'
import { User } from '../models/User'
import { leanDoc } from '../utils/mongoHelpers'

const router = express.Router()

const strDefault = (def: string) => z.string().transform((v) => (v === '' ? def : v))
const optStr = z.string().transform((v) => (v === '' ? null : v)).nullable().optional()

const activitySchema = z.object({
  name: z.string().min(1),
  description: z.string().min(1),
  duration: z.string().min(1),
  fees: z.coerce.number().int().min(0),
  scheduleDays: z.string().min(1),
  scheduleTime: optStr,
  targetClass: strDefault('All Classes'),
  capacity: z.coerce.number().int().positive().optional().nullable(),
  level: strDefault('Beginner'),
  batch: strDefault('Morning'),
  icon: strDefault('🎯'),
})

const facultySchema = z.object({
  name: z.string().min(1),
  activityId: z.string().min(1),
  salaryType: z.enum(['fixed', 'per_student']),
  salaryAmount: z.number().int().min(0),
})

router.get('/skill-hub/activities', authenticateJWT, async (req, res) => {
  const activities = await Activity.find().sort({ createdAt: -1 }).lean()
  const activityIds = activities.map((a) => a._id)

  const allFaculty = await ActivityFaculty.find({ activityId: { $in: activityIds } }).lean()
  const facultyByActivity = new Map<string, (typeof allFaculty)[0][]>()
  for (const f of allFaculty) {
    const list = facultyByActivity.get(f.activityId) ?? []
    list.push(f)
    facultyByActivity.set(f.activityId, list)
  }

  const allEnrollments = await ActivityEnrollment.find({ activityId: { $in: activityIds } })
    .select('_id activityId')
    .lean()
  const enrollmentCountByActivity = new Map<string, number>()
  for (const e of allEnrollments) {
    enrollmentCountByActivity.set(e.activityId, (enrollmentCountByActivity.get(e.activityId) ?? 0) + 1)
  }

  const userId = req.auth!.userId
  const myEnrollments = await ActivityEnrollment.find({ studentId: userId })
    .select('activityId paymentStatus rating')
    .lean()
  const enrollMap = new Map(myEnrollments.map((e) => [e.activityId, e]))

  res.json({
    activities: activities.map((a) => ({
      id: a._id,
      name: a.name,
      description: a.description,
      duration: a.duration,
      fees: a.fees,
      scheduleDays: a.scheduleDays,
      scheduleTime: a.scheduleTime ?? '',
      targetClass: a.targetClass,
      capacity: a.capacity,
      level: a.level,
      batch: a.batch,
      icon: a.icon,
      faculty: facultyByActivity.get(a._id)?.[0] ? leanDoc(facultyByActivity.get(a._id)![0]) : null,
      enrolledCount: enrollmentCountByActivity.get(a._id) ?? 0,
      isEnrolled: enrollMap.has(a._id),
      paymentStatus: enrollMap.get(a._id)?.paymentStatus ?? null,
      myRating: enrollMap.get(a._id)?.rating ?? null,
    })),
  })
})

router.get('/skill-hub/faculty', authenticateJWT, requireRole(['admin']), async (_req, res) => {
  const faculty = await ActivityFaculty.find().sort({ createdAt: -1 }).lean()
  const activityIds = [...new Set(faculty.map((f) => f.activityId))]
  const activities = await Activity.find({ _id: { $in: activityIds } }).select('name').lean()
  const activityNameById = new Map(activities.map((a) => [a._id, a.name]))

  res.json({
    faculty: faculty.map((f) => ({
      ...leanDoc(f),
      activity: { name: activityNameById.get(f.activityId) ?? '' },
    })),
  })
})

router.post('/skill-hub/activities', authenticateJWT, requireRole(['admin']), async (req, res) => {
  try {
    const parsed = activitySchema.safeParse(req.body)
    if (!parsed.success) return res.status(400).json({ message: parsed.error.issues[0]?.message })
    const data = {
      ...parsed.data,
      scheduleTime: parsed.data.scheduleTime || null,
    }
    const activity = await Activity.create(data)
    res.status(201).json({ activity: leanDoc(activity.toObject()) })
  } catch (err: any) {
    console.error('CREATE ACTIVITY ERROR:', err)
    return res.status(500).json({ message: err?.message ?? 'Internal server error' })
  }
})

router.put('/skill-hub/activities/:id', authenticateJWT, requireRole(['admin']), async (req, res) => {
  try {
    const id = req.params.id as string
    const parsed = activitySchema.partial().safeParse(req.body)
    if (!parsed.success) return res.status(400).json({ message: parsed.error.issues[0]?.message })
    const data: Record<string, unknown> = { ...parsed.data }
    if (parsed.data.scheduleTime !== undefined) {
      data.scheduleTime = parsed.data.scheduleTime || null
    }
    const activity = await Activity.findByIdAndUpdate(id, data, { new: true })
    if (!activity) return res.status(404).json({ message: 'Activity not found' })
    res.json({ activity: leanDoc(activity.toObject()) })
  } catch (err: any) {
    console.error('UPDATE ACTIVITY ERROR:', err)
    return res.status(500).json({ message: err?.message ?? 'Internal server error' })
  }
})

router.delete('/skill-hub/activities/:id', authenticateJWT, requireRole(['admin']), async (req, res) => {
  const id = req.params.id as string
  await Activity.findByIdAndDelete(id)
  res.json({ ok: true })
})

router.post('/skill-hub/faculty', authenticateJWT, requireRole(['admin']), async (req, res) => {
  const parsed = facultySchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ message: parsed.error.issues[0]?.message })
  const faculty = await ActivityFaculty.create(parsed.data)
  res.status(201).json({ faculty: leanDoc(faculty.toObject()) })
})

router.delete('/skill-hub/faculty/:id', authenticateJWT, requireRole(['admin']), async (req, res) => {
  const id = req.params.id as string
  await ActivityFaculty.findByIdAndDelete(id)
  res.json({ ok: true })
})

router.post('/skill-hub/activities/:id/enroll', authenticateJWT, async (req, res) => {
  const activityId = req.params.id as string
  const studentId = req.auth!.userId

  const existing = await ActivityEnrollment.findOne({ studentId, activityId }).lean()
  if (existing) return res.status(409).json({ message: 'Already enrolled' })

  const activity = await Activity.findById(activityId).lean()
  if (!activity) return res.status(404).json({ message: 'Activity not found' })

  if (activity.capacity) {
    const count = await ActivityEnrollment.countDocuments({ activityId })
    if (count >= activity.capacity) return res.status(400).json({ message: 'Activity is full' })
  }

  const enrollment = await ActivityEnrollment.create({
    studentId,
    activityId,
    paymentStatus: 'paid',
  })
  res.status(201).json({ enrollment: leanDoc(enrollment.toObject()) })
})

router.post('/skill-hub/activities/:id/rate', authenticateJWT, async (req, res) => {
  const activityId = req.params.id as string
  const studentId = req.auth!.userId
  const rating = Number(req.body.rating)
  if (!rating || rating < 1 || rating > 5) return res.status(400).json({ message: 'Rating must be 1–5' })

  const enrollment = await ActivityEnrollment.findOne({ studentId, activityId }).lean()
  if (!enrollment) return res.status(403).json({ message: 'Not enrolled' })

  await ActivityEnrollment.findOneAndUpdate({ studentId, activityId }, { rating })
  res.json({ ok: true })
})

router.get('/skill-hub/salary', authenticateJWT, requireRole(['admin']), async (_req, res) => {
  const faculty = await ActivityFaculty.find().lean()
  const activityIds = [...new Set(faculty.map((f) => f.activityId))]
  const activities = await Activity.find({ _id: { $in: activityIds } }).select('name').lean()
  const activityNameById = new Map(activities.map((a) => [a._id, a.name]))
  const enrollmentCounts = await ActivityEnrollment.aggregate([
    { $match: { activityId: { $in: activityIds } } },
    { $group: { _id: '$activityId', count: { $sum: 1 } } },
  ])
  const countByActivity = new Map(enrollmentCounts.map((e) => [e._id, e.count as number]))

  const report = faculty.map((f) => {
    const studentCount = countByActivity.get(f.activityId) ?? 0
    const netSalary = f.salaryType === 'fixed' ? f.salaryAmount : f.salaryAmount * studentCount
    return {
      id: f._id,
      facultyName: f.name,
      activityName: activityNameById.get(f.activityId) ?? '',
      salaryType: f.salaryType,
      salaryAmount: f.salaryAmount,
      studentCount,
      netSalary,
    }
  })

  res.json({ report })
})

router.post('/skill-hub/activities/:id/certificate', authenticateJWT, requireRole(['admin']), async (req, res) => {
  const activityId = req.params.id as string
  const { studentId } = req.body
  if (!studentId) return res.status(400).json({ message: 'studentId required' })

  const issuedDate = new Date().toISOString().slice(0, 10)
  const cert = await ActivityCertificate.findOneAndUpdate(
    { studentId, activityId },
    { $set: { issuedDate }, $setOnInsert: { studentId, activityId } },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  )
  res.json({ certificate: leanDoc(cert.toObject()) })
})

router.get('/skill-hub/activities/:id/enrollments', authenticateJWT, requireRole(['admin']), async (req, res) => {
  const activityId = req.params.id as string
  const enrollments = await ActivityEnrollment.find({ activityId }).lean()
  const studentIds = [...new Set(enrollments.map((e) => e.studentId))]
  const students = await User.find({ _id: { $in: studentIds } }).select('name').lean()
  const studentById = new Map(students.map((s) => [s._id, s]))

  res.json({
    enrollments: enrollments.map((e) => ({
      ...leanDoc(e),
      student: {
        id: e.studentId,
        name: studentById.get(e.studentId)?.name ?? '',
      },
    })),
  })
})

export default router
