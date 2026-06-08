import express from 'express'
import { z } from 'zod'
import { authenticateJWT, requireRole } from '../middleware/auth'
import { Teacher } from '../models/Teacher'
import { User } from '../models/User'
import { ContactMessage } from '../models/ContactMessage'
import { Notice } from '../models/Notice'
import { leanDoc } from '../utils/mongoHelpers'

const router = express.Router()

// ── Public: list teachers (any authenticated user — for dropdowns) ────────
router.get('/teachers', authenticateJWT, async (_req, res) => {
  try {
    const teachers = await Teacher.find().lean()
    const userIds = teachers.map((t) => t.userId)
    const users = await User.find({ _id: { $in: userIds } }).select('name').lean()
    const userMap = Object.fromEntries(users.map((u) => [String(u._id), u]))

    const sorted = [...teachers].sort((a, b) =>
      (userMap[a.userId]?.name ?? '').localeCompare(userMap[b.userId]?.name ?? ''),
    )

    res.json({
      teachers: sorted.map((t) => ({
        id: t.userId,
        name: userMap[t.userId]?.name ?? '—',
        subject: t.subject ?? '',
      })),
    })
  } catch (err: any) {
    res.status(500).json({ message: err?.message ?? 'Failed' })
  }
})

// ── Teacher: contact admin ────────────────────────────────────────────────
const teacherContactSchema = z.object({
  category: z.enum(['technical', 'student_issue', 'request', 'other']),
  message: z.string().min(5, 'Description must be at least 5 characters'),
})

router.post('/contact/teacher', authenticateJWT, requireRole(['teacher']), async (req, res) => {
  try {
    console.log('[POST /contact/teacher] body:', JSON.stringify(req.body))
    const parsed = teacherContactSchema.safeParse(req.body)
    if (!parsed.success) return res.status(400).json({ message: parsed.error.issues[0]?.message })

    const { category, message } = parsed.data
    const teacher = await User.findById(req.auth!.userId).select('name email').lean()

    await ContactMessage.create({
      userId: req.auth!.userId,
      name: teacher?.name ?? 'Teacher',
      email: teacher?.email ?? '',
      message,
      teacherId: req.auth!.userId,
      category,
      senderRole: 'teacher',
    })

    const admins = await User.find({ role: 'admin' }).select('_id').lean()
    const catLabel: Record<string, string> = {
      technical: 'Technical Issue', student_issue: 'Student Issue',
      request: 'Request', other: 'Other',
    }
    for (const admin of admins) {
      await Notice.create({
        title: `${catLabel[category] ?? category} from ${teacher?.name ?? 'Teacher'}`,
        description: message.slice(0, 200),
        type: 'notice',
        userId: String(admin._id),
      })
    }

    res.json({ ok: true })
  } catch (err: any) {
    console.error('[POST /contact/teacher]', err?.message)
    res.status(500).json({ message: err?.message ?? 'Failed to send' })
  }
})

// ── Teacher: report student issue ─────────────────────────────────────────
const studentIssueSchema = z.object({
  studentId: z.string().min(1, 'Please select a student'),
  issueType: z.enum(['not_attending', 'misbehavior', 'assignment_not_submitted', 'other']),
  description: z.string().min(5, 'Description must be at least 5 characters'),
})

router.post('/contact/student-issue', authenticateJWT, requireRole(['teacher']), async (req, res) => {
  try {
    console.log('[POST /contact/student-issue] body:', JSON.stringify(req.body))
    const parsed = studentIssueSchema.safeParse(req.body)
    if (!parsed.success) return res.status(400).json({ message: parsed.error.issues[0]?.message })

    const { studentId, issueType, description } = parsed.data

    const student = await User.findById(studentId).lean()
    if (!student) return res.status(404).json({ message: 'Student not found' })

    const teacher = await User.findById(req.auth!.userId).select('name email').lean()

    const issueLabel: Record<string, string> = {
      not_attending: 'Not Attending', misbehavior: 'Misbehavior',
      assignment_not_submitted: 'Assignment Not Submitted', other: 'Other',
    }

    await ContactMessage.create({
      userId: req.auth!.userId,
      name: teacher?.name ?? 'Teacher',
      email: teacher?.email ?? '',
      message: `[Student Issue — ${issueLabel[issueType]}] Student: ${student.name}\n\n${description}`,
      teacherId: req.auth!.userId,
      category: 'student_issue',
      senderRole: 'teacher',
    })

    const admins = await User.find({ role: 'admin' }).select('_id').lean()
    for (const admin of admins) {
      await Notice.create({
        title: `Student Issue: ${student.name} (${issueLabel[issueType]})`,
        description: `Reported by ${teacher?.name ?? 'Teacher'}: ${description.slice(0, 150)}`,
        type: 'notice',
        userId: String(admin._id),
      })
    }

    res.json({ ok: true })
  } catch (err: any) {
    console.error('[POST /contact/student-issue]', err?.message)
    res.status(500).json({ message: err?.message ?? 'Failed to report issue' })
  }
})

// ── Teacher: get own sent messages ────────────────────────────────────────
router.get('/contact/teacher-messages', authenticateJWT, requireRole(['teacher']), async (req, res) => {
  try {
    const messages = await ContactMessage.find({ userId: req.auth!.userId })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean()

    res.json({
      messages: messages.map((m) => ({
        id: String(m._id),
        message: m.message,
        category: m.category,
        createdAt: m.createdAt.toISOString().slice(0, 10),
      })),
    })
  } catch (err: any) {
    res.status(500).json({ message: err?.message ?? 'Failed' })
  }
})

// ── Student: send complaint or message ───────────────────────────────────
const sendSchema = z.object({
  teacherId: z.string().min(1, 'Please select a teacher'),
  message: z.string().min(5, 'Message must be at least 5 characters'),
  category: z.enum(['complaint', 'query', 'request'], {
    message: 'Category must be complaint, query, or request',
  }),
})

router.post('/contact', authenticateJWT, requireRole(['student']), async (req, res) => {
  try {
    const parsed = sendSchema.safeParse(req.body)
    if (!parsed.success) return res.status(400).json({ message: parsed.error.issues[0]?.message })

    const { teacherId, message, category } = parsed.data

    const teacher = await User.findById(teacherId).lean()
    if (!teacher || teacher.role !== 'teacher') return res.status(404).json({ message: 'Teacher not found' })

    const student = await User.findById(req.auth!.userId).select('name email').lean()

    await ContactMessage.create({
      userId: req.auth!.userId,
      name: student?.name ?? 'Student',
      email: student?.email ?? '',
      message,
      teacherId,
      category,
      senderRole: 'student',
    })

    const categoryLabel = category === 'complaint' ? 'Complaint' : category === 'query' ? 'Query' : 'Request/Notice'
    await Notice.create({
      title: `${categoryLabel} from ${student?.name ?? 'a student'}`,
      description: message.slice(0, 200),
      type: 'notice',
      userId: teacherId,
    })

    if (category === 'complaint') {
      const admins = await User.find({ role: 'admin' }).select('_id').lean()
      for (const admin of admins) {
        await Notice.create({
          title: `Complaint: ${student?.name ?? 'Student'} → ${teacher.name}`,
          description: message.slice(0, 200),
          type: 'notice',
          userId: String(admin._id),
        })
      }
    }

    res.json({ ok: true })
  } catch (err: any) {
    console.error('[POST /contact]', err?.message)
    res.status(500).json({ message: err?.message ?? 'Failed to send message' })
  }
})

// ── Student: get own messages ─────────────────────────────────────────────
router.get('/contact/my-messages', authenticateJWT, requireRole(['student']), async (req, res) => {
  try {
    const messages = await ContactMessage.find({ userId: req.auth!.userId })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean()

    const teacherIds = [...new Set(messages.map((m) => m.teacherId).filter(Boolean))] as string[]
    const teachers = await User.find({ _id: { $in: teacherIds } }).select('name').lean()
    const teacherMap = Object.fromEntries(teachers.map((t) => [String(t._id), t.name]))

    res.json({
      messages: messages.map((m) => ({
        id: String(m._id),
        teacherName: m.teacherId ? (teacherMap[m.teacherId] ?? '—') : '—',
        message: m.message,
        category: m.category,
        createdAt: m.createdAt.toISOString().slice(0, 10),
      })),
    })
  } catch (err: any) {
    res.status(500).json({ message: err?.message ?? 'Failed' })
  }
})

// ── Admin: view all messages (enhanced) ──────────────────────────────────
router.get('/contact/messages', authenticateJWT, requireRole(['admin']), async (_req, res) => {
  try {
    const messages = await ContactMessage.find()
      .sort({ createdAt: -1 })
      .limit(200)
      .lean()

    const userIds = [...new Set(messages.map((m) => m.userId).filter(Boolean))] as string[]
    const teacherIds = [...new Set(messages.map((m) => m.teacherId).filter(Boolean))] as string[]
    const allIds = [...new Set([...userIds, ...teacherIds])]

    const users = await User.find({ _id: { $in: allIds } }).select('name role').lean()
    const userMap = Object.fromEntries(users.map((u) => [String(u._id), u]))

    console.log('[GET /contact/messages] total:', messages.length)

    res.json({
      messages: messages.map((m) => ({
        id: String(m._id),
        senderName: m.name,
        senderRole: m.senderRole,
        teacherName: m.teacherId ? (userMap[m.teacherId]?.name ?? '—') : '—',
        message: m.message,
        category: m.category,
        status: m.status,
        adminReply: m.adminReply ?? null,
        createdAt: m.createdAt.toISOString().slice(0, 10),
      })),
    })
  } catch (err: any) {
    console.error('[GET /contact/messages]', err?.message)
    res.status(500).json({ message: err?.message ?? 'Failed' })
  }
})

// ── Admin: reply to a message ─────────────────────────────────────────────
router.post('/contact/messages/:id/reply', authenticateJWT, requireRole(['admin']), async (req, res) => {
  try {
    const id = req.params.id as string
    const { reply } = req.body
    if (!reply || !reply.trim()) return res.status(400).json({ message: 'Reply cannot be empty' })

    const msg = await ContactMessage.findById(id).lean()
    if (!msg) return res.status(404).json({ message: 'Message not found' })

    const updated = await ContactMessage.findByIdAndUpdate(
      id,
      { adminReply: reply.trim(), status: 'resolved' },
      { new: true },
    ).lean()

    if (msg.userId) {
      await Notice.create({
        title: 'Admin replied to your message',
        description: reply.trim().slice(0, 200),
        type: 'notice',
        userId: msg.userId,
      })
    }

    const doc = leanDoc(updated)!
    res.json({ ok: true, message: { id: doc.id, status: doc.status, adminReply: doc.adminReply } })
  } catch (err: any) {
    console.error('[POST /contact/messages/:id/reply]', err?.message)
    res.status(500).json({ message: err?.message ?? 'Failed to reply' })
  }
})

export default router
