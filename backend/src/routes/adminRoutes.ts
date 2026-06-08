import express from 'express'
import { authenticateJWT, requireRole } from '../middleware/auth'
import { z } from 'zod'
import bcrypt from 'bcrypt'
import PDFDocument from 'pdfkit'
import { StudentFace } from '../models/StudentFace'
import { FaceAttendance } from '../models/FaceAttendance'
import { User } from '../models/User'
import { StudentProfile } from '../models/StudentProfile'
import { Teacher } from '../models/Teacher'
import { Course } from '../models/Course'
import { Notice } from '../models/Notice'
import { Event } from '../models/Event'
import { EventRegistration } from '../models/EventRegistration'
import { leanDoc } from '../utils/mongoHelpers'

const router = express.Router()

// ── Helper: generate unique ID ────────────────────────────────────────────
async function generateUniqueId(role: 'student' | 'teacher' | 'admin'): Promise<string> {
  const prefix = role === 'student' ? 'STU' : role === 'teacher' ? 'TCH' : 'ADM'
  const count = await User.countDocuments({ role })
  let num = count + 1
  let uniqueId = `${prefix}${String(num).padStart(3, '0')}`
  while (await User.findOne({ email: `${uniqueId}@school.local` }).lean()) {
    num++
    uniqueId = `${prefix}${String(num).padStart(3, '0')}`
  }
  return uniqueId
}

// ── GET students ──────────────────────────────────────────────────────────
router.get('/admin/students', authenticateJWT, requireRole(['admin']), async (_req, res) => {
  const users = await User.find({ role: 'student' })
    .select('name email role')
    .lean()
  const profiles = await StudentProfile.find({
    userId: { $in: users.map((u) => u._id) },
  }).lean()
  const profileByUser = new Map(profiles.map((p) => [p.userId, p]))

  res.json({
    students: users.map((u) => ({
      id: u._id,
      name: u.name,
      email: u.email,
      role: u.role,
      uniqueId: u.email.endsWith('@school.local') ? u.email.replace('@school.local', '') : null,
      profile: profileByUser.get(u._id) ? leanDoc(profileByUser.get(u._id)!) : null,
    })),
  })
})

// ── GET distinct classes ──────────────────────────────────────────────────
router.get('/admin/classes', authenticateJWT, async (_req, res) => {
  const classes = await StudentProfile.distinct('className', { className: { $ne: null } })
  res.json({ classes: (classes as string[]).filter(Boolean).sort() })
})

// ── CREATE student ────────────────────────────────────────────────────────
const createStudentSchema = z.object({
  name: z.string().min(2),
  password: z.string().min(6),
  gender: z.string().optional(),
  fatherName: z.string().optional(),
  motherName: z.string().optional(),
  dob: z.string().optional(),
  religion: z.string().optional(),
  fatherOccupation: z.string().optional(),
  address: z.string().optional(),
  className: z.string().optional(),
  phone: z.string().regex(/^\d{10}$/, 'Phone must be exactly 10 digits').optional().or(z.literal('')),
})

router.post('/admin/students', authenticateJWT, requireRole(['admin']), async (req, res) => {
  try {
    const parsed = createStudentSchema.safeParse(req.body)
    if (!parsed.success) return res.status(400).json({ message: parsed.error.issues[0]?.message })
    const { name, password, ...profile } = parsed.data

    const uniqueId = await generateUniqueId('student')
    const email = `${uniqueId}@school.local`

    const hash = await bcrypt.hash(password, 12)
    const user = await User.create({ name, email, password: hash, role: 'student' })
    await StudentProfile.create({
      userId: user.id,
      ...profile,
      phone: profile.phone || null,
    })
    res.status(201).json({ student: { id: user.id, name, uniqueId, loginId: uniqueId } })
  } catch (err: any) {
    console.error('[POST /admin/students] error:', err?.message, err?.stack)
    res.status(500).json({ message: err?.message ?? 'Failed to create student' })
  }
})

// ── EDIT student ──────────────────────────────────────────────────────────
router.put('/admin/students/:id', authenticateJWT, requireRole(['admin']), async (req, res) => {
  try {
    const userId = req.params.id as string

    console.log('[PUT /admin/students/:id] body:', JSON.stringify(req.body))

    const {
      name,
      password,
      gender,
      fatherName,
      motherName,
      dob,
      religion,
      fatherOccupation,
      address,
      className,
      phone,
    } = req.body

    if (name !== undefined && (typeof name !== 'string' || name.trim().length < 2)) {
      return res.status(400).json({ message: 'Name must be at least 2 characters' })
    }

    if (phone && phone !== '' && !/^\d{10}$/.test(phone)) {
      return res.status(400).json({ message: 'Phone must be exactly 10 digits' })
    }

    if (dob && dob !== '') {
      const d = new Date(dob)
      if (isNaN(d.getTime())) {
        return res.status(400).json({ message: 'Invalid date of birth' })
      }
    }

    if (password !== undefined && password !== '' && password.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters' })
    }

    const userUpdate: Record<string, any> = {}
    if (name && name.trim()) userUpdate.name = name.trim()
    if (password && password.trim().length >= 6) {
      userUpdate.password = await bcrypt.hash(password.trim(), 12)
    }

    if (Object.keys(userUpdate).length > 0) {
      await User.findByIdAndUpdate(userId, userUpdate)
    }

    const profileData = {
      gender: gender || null,
      fatherName: fatherName || null,
      motherName: motherName || null,
      dob: dob || null,
      religion: religion || null,
      fatherOccupation: fatherOccupation || null,
      address: address || null,
      className: className || null,
      phone: phone && phone.trim() ? phone.trim() : null,
    }

    await StudentProfile.findOneAndUpdate(
      { userId },
      { $set: profileData, $setOnInsert: { userId } },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    )

    res.json({ ok: true })
  } catch (err: any) {
    console.error('[PUT /admin/students/:id] error:', err?.message, err?.stack)
    res.status(500).json({ message: err?.message ?? 'Failed to update student' })
  }
})

// ── DELETE student ────────────────────────────────────────────────────────
router.delete('/admin/students/:id', authenticateJWT, requireRole(['admin']), async (req, res) => {
  const userId = req.params.id as string
  await Promise.all([
    StudentFace.deleteOne({ studentId: userId }).catch(() => undefined),
    FaceAttendance.deleteMany({ studentId: userId }).catch(() => undefined),
  ])
  await User.findByIdAndDelete(userId)
  res.json({ ok: true })
})

// ── GET teachers ──────────────────────────────────────────────────────────
router.get('/admin/teachers', authenticateJWT, requireRole(['admin']), async (_req, res) => {
  const users = await User.find({ role: 'teacher' }).select('name email role').lean()
  const teachers = await Teacher.find({ userId: { $in: users.map((u) => u._id) } }).lean()
  const teacherByUser = new Map(teachers.map((t) => [t.userId, t]))

  res.json({
    teachers: users.map((u) => {
      const teacher = teacherByUser.get(u._id)
      return {
        id: u._id,
        name: u.name,
        email: u.email,
        role: u.role,
        uniqueId: u.email.endsWith('@school.local') ? u.email.replace('@school.local', '') : null,
        subject: teacher?.subject ?? null,
        profile: teacher ? leanDoc(teacher) : null,
      }
    }),
  })
})

// ── CREATE teacher ────────────────────────────────────────────────────────
const createTeacherSchema = z.object({
  name: z.string().min(2),
  password: z.string().min(6),
  subject: z.string().min(1),
  phone: z.string().optional(),
  address: z.string().optional(),
  bloodType: z.string().optional(),
  birthday: z.string().optional(),
  sex: z.string().optional(),
})

router.post('/admin/teachers', authenticateJWT, requireRole(['admin']), async (req, res) => {
  const parsed = createTeacherSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ message: parsed.error.issues[0]?.message })
  const { name, password, subject, ...profile } = parsed.data

  const uniqueId = await generateUniqueId('teacher')
  const email = `${uniqueId}@school.local`

  const hash = await bcrypt.hash(password, 12)
  const user = await User.create({ name, email, password: hash, role: 'teacher' })
  const teacherProfile = await Teacher.create({ userId: user.id, subject, ...profile })

  const existing = await Course.findOne({ name: subject, teacherId: teacherProfile.id })
  if (!existing) {
    await Course.create({ name: subject, teacherId: teacherProfile.id })
  }

  res.status(201).json({ teacher: { id: user.id, name, uniqueId, loginId: uniqueId, subject } })
})

// ── EDIT teacher ──────────────────────────────────────────────────────────
router.put('/admin/teachers/:id', authenticateJWT, requireRole(['admin']), async (req, res) => {
  const userId = req.params.id as string
  const { name, subject, phone, address, bloodType, birthday, sex } = req.body

  if (name) await User.findByIdAndUpdate(userId, { name })
  await Teacher.findOneAndUpdate(
    { userId },
    {
      $set: { subject, phone, address, bloodType, birthday, sex },
      $setOnInsert: { userId, subject: subject ?? 'General' },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  )
  res.json({ ok: true })
})

// ── DELETE teacher ────────────────────────────────────────────────────────
router.delete('/admin/teachers/:id', authenticateJWT, requireRole(['admin']), async (req, res) => {
  const userId = req.params.id as string
  await User.findByIdAndDelete(userId)
  res.json({ ok: true })
})

router.get('/admin/courses', authenticateJWT, requireRole(['admin']), async (_req, res) => {
  const courses = await Course.find().lean()
  const teacherIds = [...new Set(courses.map((c) => c.teacherId))]
  const teachers = await Teacher.find({ _id: { $in: teacherIds } }).lean()
  const users = await User.find({ _id: { $in: teachers.map((t) => t.userId) } })
    .select('name')
    .lean()
  const teacherById = new Map(teachers.map((t) => [t._id, t]))
  const userNameById = new Map(users.map((u) => [u._id, u.name]))

  res.json({
    courses: courses.map((c) => {
      const teacher = teacherById.get(c.teacherId)
      const teacherName = teacher ? (userNameById.get(teacher.userId) ?? '') : ''
      return { id: c._id, name: c.name, teacherName }
    }),
  })
})

const createCourseSchema = z.object({
  name: z.string().min(2),
  teacherId: z.string().min(1),
})

router.post('/admin/courses', authenticateJWT, requireRole(['admin']), async (req, res) => {
  try {
    const parsed = createCourseSchema.safeParse(req.body)
    if (!parsed.success) return res.status(400).json({ message: parsed.error.issues[0]?.message })

    const { name, teacherId } = parsed.data
    const teacherProfile = await Teacher.findOne({ userId: teacherId }).lean()
    if (!teacherProfile) return res.status(404).json({ message: 'Teacher not found' })

    const course = await Course.create({ name, teacherId: teacherProfile._id })

    res.status(201).json({ course: leanDoc(course.toObject()) })
  } catch (err) {
    console.error('[POST /admin/courses]', err)
    res.status(500).json({ message: 'Failed to create course' })
  }
})

const noticesSchema = z.object({
  title: z.string().min(2),
  description: z.string().min(2),
})

router.post('/admin/notices', authenticateJWT, requireRole(['admin']), async (req, res) => {
  try {
    const parsed = noticesSchema.safeParse(req.body)
    if (!parsed.success) return res.status(400).json({ message: parsed.error.issues[0]?.message })

    const notice = await Notice.create({
      title: parsed.data.title,
      description: parsed.data.description,
      date: new Date(),
    })
    res.status(201).json({ notice: leanDoc(notice.toObject()) })
  } catch (err) {
    console.error('[POST /admin/notices]', err)
    res.status(500).json({ message: 'Failed to create notice' })
  }
})

// PDF downloads: no auth so your frontend `window.open()` works.
router.get('/admin/reports/summary.pdf', async (_req, res) => {
  const doc = new PDFDocument({ margin: 40 })
  res.setHeader('Content-Type', 'application/pdf')
  res.setHeader('Content-Disposition', 'inline; filename="summary.pdf"')

  doc.pipe(res)

  const totalStudents = await User.countDocuments({ role: 'student' })
  const totalTeachers = await User.countDocuments({ role: 'teacher' })
  const activeCourses = await Course.countDocuments()
  const totalEvents = await Event.countDocuments()
  const registrations = await EventRegistration.countDocuments()

  doc.fontSize(22).text('Admin Summary Report', { align: 'left' })
  doc.moveDown()
  doc.fontSize(12).text(`Total Students: ${totalStudents}`)
  doc.text(`Total Teachers: ${totalTeachers}`)
  doc.text(`Active Courses: ${activeCourses}`)
  doc.text(`Events: ${totalEvents}`)
  doc.text(`Event Registrations: ${registrations}`)

  doc.moveDown()
  doc.fontSize(12).text(`Generated at: ${new Date().toISOString()}`)
  doc.end()
})

export default router
