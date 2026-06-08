import express from 'express'
import { z } from 'zod'
import { authenticateJWT } from '../middleware/auth'
import { photoUpload } from '../utils/upload'
import { User } from '../models/User'
import { StudentProfile } from '../models/StudentProfile'
import { Teacher } from '../models/Teacher'
import { Course } from '../models/Course'
import { Attendance } from '../models/Attendance'
import { Assignment } from '../models/Assignment'
import { Resume } from '../models/Resume'
import { StudyTask } from '../models/StudyTask'
import { Doubt } from '../models/Doubt'
import { Notice } from '../models/Notice'
import { leanDoc } from '../utils/mongoHelpers'

const router = express.Router()

router.get('/students', authenticateJWT, async (req, res) => {
  try {
    const role = req.auth!.role
    if (role !== 'teacher' && role !== 'admin') return res.status(403).json({ message: 'Forbidden' })
    const users = await User.find({ role: 'student' }).select('name').sort({ name: 1 }).lean()
    const profiles = await StudentProfile.find({ userId: { $in: users.map((u) => u._id) } })
      .select('userId className')
      .lean()
    const classNameByUser = new Map(profiles.map((p) => [p.userId, p.className]))
    res.json({
      students: users.map((u) => ({
        id: u._id,
        name: u.name,
        className: classNameByUser.get(u._id) ?? null,
      })),
    })
  } catch (err: any) {
    res.status(500).json({ message: err?.message ?? 'Failed' })
  }
})

router.get('/students/me', authenticateJWT, async (req, res) => {
  const profile = await StudentProfile.findOne({ userId: req.auth!.userId }).lean()
  res.json({
    student: profile
      ? {
          gender: profile.gender,
          fatherName: profile.fatherName,
          motherName: profile.motherName,
          dob: profile.dob,
          religion: profile.religion,
          fatherOccupation: profile.fatherOccupation,
          address: profile.address,
          className: profile.className,
          phone: profile.phone,
          photoUrl: profile.photoUrl,
        }
      : null,
  })
})

router.get('/teachers/me', authenticateJWT, async (req, res) => {
  const teacher = await Teacher.findOne({ userId: req.auth!.userId })
    .select('subject phone address bloodType birthday sex photoUrl')
    .lean()
  res.json({ teacher: teacher ?? null })
})

router.post('/admin/students/:userId/photo', authenticateJWT, photoUpload.single('photo'), async (req, res) => {
  const userId = req.params.userId as string
  const file = req.file
  if (!file) return res.status(400).json({ message: 'No file uploaded' })
  const photoUrl = `/uploads/photos/${file.filename}`
  await StudentProfile.findOneAndUpdate(
    { userId },
    { $set: { photoUrl }, $setOnInsert: { userId } },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  )
  res.json({ photoUrl })
})

router.post('/admin/teachers/:userId/photo', authenticateJWT, photoUpload.single('photo'), async (req, res) => {
  const userId = req.params.userId as string
  const file = req.file
  if (!file) return res.status(400).json({ message: 'No file uploaded' })
  const photoUrl = `/uploads/photos/${file.filename}`
  const teacher = await Teacher.findOne({ userId }).select('_id').lean()
  if (!teacher) return res.status(404).json({ message: 'Teacher not found' })
  await Teacher.findOneAndUpdate({ userId }, { photoUrl })
  res.json({ photoUrl })
})

router.get('/teachers/me/activity', authenticateJWT, async (req, res) => {
  const teacher = await Teacher.findOne({ userId: req.auth!.userId }).select('_id').lean()
  if (!teacher) return res.json({ lastAttendance: null, lastAssignment: null })

  const courses = await Course.find({ teacherId: teacher._id }).select('_id name').lean()
  const courseIds = courses.map((c) => c._id)
  const courseNameById = new Map(courses.map((c) => [c._id, c.name]))

  const lastAttendance = await Attendance.findOne({ courseId: { $in: courseIds } })
    .sort({ createdAt: -1 })
    .lean()

  const lastAssignment = await Assignment.findOne({ courseId: { $in: courseIds } })
    .sort({ createdAt: -1 })
    .lean()

  res.json({
    lastAttendance: lastAttendance
      ? {
          date: new Date(lastAttendance.date).toISOString().slice(0, 10),
          subject: courseNameById.get(lastAttendance.courseId) ?? '',
        }
      : null,
    lastAssignment: lastAssignment
      ? {
          title: lastAssignment.title,
          subject: courseNameById.get(lastAssignment.courseId) ?? '',
          date: new Date(lastAssignment.createdAt).toISOString().slice(0, 10),
        }
      : null,
  })
})

router.get('/resume', authenticateJWT, async (req, res) => {
  const resume = await Resume.findOne({ userId: req.auth!.userId }).lean()
  res.json({ resume: resume ? leanDoc(resume) : { headline: '', summary: '', skills: '' } })
})

const resumeSchema = z.object({
  headline: z.string().default(''),
  summary: z.string().default(''),
  skills: z.string().default(''),
})

router.put('/resume', authenticateJWT, async (req, res) => {
  const parsed = resumeSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ message: parsed.error.issues[0]?.message })

  const { headline, summary, skills } = parsed.data

  const resume = await Resume.findOneAndUpdate(
    { userId: req.auth!.userId },
    { $set: { headline, summary, skills }, $setOnInsert: { userId: req.auth!.userId } },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  )

  res.json({ resume: leanDoc(resume.toObject()) })
})

router.get('/study-planner', authenticateJWT, async (req, res) => {
  const tasks = await StudyTask.find({ userId: req.auth!.userId }).sort({ dueDate: 1 }).lean()
  res.json({
    tasks: tasks.map((t) => ({
      id: t._id,
      title: t.title,
      dueDate: new Date(t.dueDate).toISOString().slice(0, 10),
    })),
  })
})

const plannerSchema = z.object({
  title: z.string().min(2),
  dueDate: z.string().min(1),
})

router.post('/study-planner', authenticateJWT, async (req, res) => {
  const parsed = plannerSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ message: parsed.error.issues[0]?.message })

  const { title, dueDate } = parsed.data
  const task = await StudyTask.create({
    userId: req.auth!.userId,
    title,
    dueDate: new Date(dueDate),
  })
  res.json({ task: leanDoc(task.toObject()) })
})

router.get('/subjects', authenticateJWT, async (_req, res) => {
  const teachers = await Teacher.find().select('subject').lean()
  const courses = await Course.distinct('name')
  const fromTeachers = teachers.map((t) => t.subject).filter(Boolean)
  const fromCourses = (courses as string[]).filter(Boolean)
  const all = [...new Set([...fromTeachers, ...fromCourses])].sort()
  res.json({ subjects: all })
})

router.get('/doubts', authenticateJWT, async (req, res) => {
  const role = req.auth!.role

  if (role === 'student') {
    const doubts = await Doubt.find({ userId: req.auth!.userId }).sort({ createdAt: -1 }).lean()
    return res.json({
      doubts: doubts.map((d) => ({
        id: d._id,
        subject: d.subject ?? '',
        question: d.question,
        status: d.status,
        teacherReply: d.teacherReply,
        createdAt: new Date(d.createdAt).toISOString().slice(0, 10),
      })),
    })
  }

  if (role === 'teacher') {
    const teacher = await Teacher.findOne({ userId: req.auth!.userId }).select('_id subject').lean()
    const courses = teacher
      ? await Course.find({ teacherId: teacher._id }).select('name').lean()
      : []
    const teacherSubjects = [teacher?.subject, ...courses.map((c) => c.name)]
      .filter(Boolean)
      .map((s) => s!.toLowerCase())

    const allDoubts = await Doubt.find().sort({ createdAt: -1 }).limit(100).lean()
    const userIds = [...new Set(allDoubts.map((d) => d.userId))]
    const users = await User.find({ _id: { $in: userIds } }).select('name').lean()
    const profiles = await StudentProfile.find({ userId: { $in: userIds } }).select('userId className').lean()
    const userNameById = new Map(users.map((u) => [u._id, u.name]))
    const classNameByUserId = new Map(profiles.map((p) => [p.userId, p.className]))

    const filtered = allDoubts.filter(
      (d) => !d.subject || teacherSubjects.includes(d.subject.toLowerCase()),
    )

    return res.json({
      doubts: filtered.map((d) => ({
        id: d._id,
        subject: d.subject ?? '',
        question: d.question,
        status: d.status,
        teacherReply: d.teacherReply,
        createdAt: new Date(d.createdAt).toISOString().slice(0, 10),
        studentName: userNameById.get(d.userId) ?? '—',
        className: classNameByUserId.get(d.userId) ?? null,
      })),
    })
  }

  const doubts = await Doubt.find().sort({ createdAt: -1 }).limit(100).lean()
  const userIds = [...new Set(doubts.map((d) => d.userId))]
  const users = await User.find({ _id: { $in: userIds } }).select('name').lean()
  const profiles = await StudentProfile.find({ userId: { $in: userIds } }).select('userId className').lean()
  const userNameById = new Map(users.map((u) => [u._id, u.name]))
  const classNameByUserId = new Map(profiles.map((p) => [p.userId, p.className]))

  res.json({
    doubts: doubts.map((d) => ({
      id: d._id,
      subject: d.subject ?? '',
      question: d.question,
      status: d.status,
      teacherReply: d.teacherReply,
      createdAt: new Date(d.createdAt).toISOString().slice(0, 10),
      studentName: userNameById.get(d.userId) ?? '—',
      className: classNameByUserId.get(d.userId) ?? null,
    })),
  })
})

router.post('/doubts', authenticateJWT, async (req, res) => {
  try {
    if (req.auth!.role !== 'student') return res.status(403).json({ message: 'Only students can post doubts' })

    const schema = z.object({
      subject: z.string().min(1, 'Subject is required'),
      question: z.string().min(5, 'Question must be at least 5 characters'),
    })
    const parsed = schema.safeParse(req.body)
    if (!parsed.success) return res.status(400).json({ message: parsed.error.issues[0]?.message })

    const { subject, question } = parsed.data

    const doubt = await Doubt.create({
      userId: req.auth!.userId,
      subject,
      question,
      studentId: null,
      status: 'open',
    })

    const student = await User.findById(req.auth!.userId).select('name').lean()

    const allTeachers = await Teacher.find().select('userId subject').lean()
    const allCourses = await Course.find().lean()
    const teacherIds = [...new Set(allCourses.map((c) => c.teacherId))]
    const courseTeachers = await Teacher.find({ _id: { $in: teacherIds } }).select('userId').lean()
    const teacherUserIdByCourseId = new Map(
      allCourses.map((c) => {
        const t = courseTeachers.find((ct) => ct._id === c.teacherId)
        return [c._id, t?.userId]
      }),
    )

    const subjectLower = subject.toLowerCase()
    const notifyIds = new Set<string>()

    for (const t of allTeachers) {
      if (t.subject && t.subject.toLowerCase() === subjectLower) notifyIds.add(t.userId)
    }
    for (const c of allCourses) {
      if (c.name.toLowerCase() === subjectLower) {
        const uid = teacherUserIdByCourseId.get(c._id)
        if (uid) notifyIds.add(uid)
      }
    }
    if (notifyIds.size === 0) allTeachers.forEach((t) => notifyIds.add(t.userId))

    for (const userId of notifyIds) {
      await Notice.create({
        title: `New Doubt: ${subject}`,
        description: `${student?.name ?? 'A student'} asked: "${question}"`,
        type: 'notice',
        userId,
      })
    }

    res.json({ doubt: leanDoc(doubt.toObject()) })
  } catch (err: any) {
    console.error('[POST /doubts]', err?.message, err?.stack)
    res.status(500).json({ message: err?.message ?? 'Failed to submit doubt' })
  }
})

router.post('/doubts/:doubtId/reply', authenticateJWT, async (req, res) => {
  try {
    const role = req.auth!.role
    if (role !== 'teacher' && role !== 'admin') return res.status(403).json({ message: 'Forbidden' })

    const schema = z.object({ reply: z.string().min(2) })
    const parsed = schema.safeParse(req.body)
    if (!parsed.success) return res.status(400).json({ message: parsed.error.issues[0]?.message })

    const doubtId = Array.isArray(req.params.doubtId) ? req.params.doubtId[0] : req.params.doubtId
    const doubt = await Doubt.findById(doubtId).lean()
    if (!doubt) return res.status(404).json({ message: 'Doubt not found' })

    const updated = await Doubt.findByIdAndUpdate(
      doubtId,
      { teacherReply: parsed.data.reply, status: 'answered' },
      { new: true },
    )

    await Notice.create({
      title: `Doubt Answered: ${doubt.subject ?? 'Your doubt'}`,
      description: `Your doubt has been answered: "${parsed.data.reply.slice(0, 100)}"`,
      type: 'notice',
      userId: doubt.userId,
    })

    res.json({ doubt: leanDoc(updated!.toObject()) })
  } catch (err: any) {
    console.error('[POST /doubts/:id/reply]', err?.message)
    res.status(500).json({ message: err?.message ?? 'Failed to reply' })
  }
})

export default router
