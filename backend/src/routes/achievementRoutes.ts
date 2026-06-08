import express from 'express'
import { z } from 'zod'
import { authenticateJWT, requireRole } from '../middleware/auth'
import { Achievement } from '../models/Achievement'
import { User } from '../models/User'
import { StudentProfile } from '../models/StudentProfile'
import { Notice } from '../models/Notice'
import { leanDoc } from '../utils/mongoHelpers'
const router = express.Router()

type AchievementLean = {
  id: string
  studentId: string
  title: string
  type: string
  rank: string | null
  date: string | null
  createdAt: Date
}

type AchievementRow = AchievementLean & {
  student: {
    id: string
    name: string
    studentProfile: { className: string | null } | null
  }
}

function toAchievementLean(doc: Record<string, unknown>): AchievementLean {
  const lean = leanDoc(doc)!
  return {
    id: lean.id,
    studentId: String(lean.studentId),
    title: String(lean.title),
    type: String(lean.type),
    rank: lean.rank != null ? String(lean.rank) : null,
    date: lean.date != null ? String(lean.date) : null,
    createdAt: lean.createdAt as Date,
  }
}

async function enrichAchievements(rows: AchievementLean[]): Promise<AchievementRow[]> {
  if (!rows.length) return []

  const studentIds = [...new Set(rows.map((r) => r.studentId))]
  const [users, profiles] = await Promise.all([
    User.find({ _id: { $in: studentIds } }).lean(),
    StudentProfile.find({ userId: { $in: studentIds } }).lean(),
  ])
  const userMap = new Map(users.map((u) => [String(u._id), u]))
  const profileMap = new Map(profiles.map((p) => [p.userId, p]))

  return rows.map((a) => {
    const user = userMap.get(a.studentId)
    const profile = profileMap.get(a.studentId)
    return {
      ...a,
      student: {
        id: a.studentId,
        name: user?.name ?? 'Unknown',
        studentProfile: profile ? { className: profile.className ?? null } : null,
      },
    }
  })
}

async function loadAchievements(studentId?: string): Promise<AchievementRow[]> {
  const filter = studentId ? { studentId } : {}
  const rows = await Achievement.find(filter).sort({ createdAt: -1 }).lean()
  return enrichAchievements(rows.map((r) => toAchievementLean(r as Record<string, unknown>)))
}

function fmt(a: AchievementRow) {
  return {
    id: a.id,
    title: a.title,
    type: a.type,
    rank: a.rank ?? null,
    date: a.date ?? null,
    studentId: a.studentId,
    studentName: a.student.name,
    className: a.student.studentProfile?.className ?? null,
    createdAt: a.createdAt.toISOString().slice(0, 10),
  }
}

// ── GET — role-based ──────────────────────────────────────────────────────
router.get('/achievements', authenticateJWT, async (req, res) => {
  const { role, userId } = req.auth!

  if (role === 'student') {
    const rows = await loadAchievements(userId)
    return res.json({ achievements: rows.map(fmt) })
  }

  const rows = await loadAchievements()
  res.json({ achievements: rows.map(fmt) })
})

// ── Admin: CREATE ─────────────────────────────────────────────────────────
const createSchema = z.object({
  studentId: z.string().min(1, 'studentId is required'),
  title: z.string().min(2, 'Title must be at least 2 characters'),
  type: z.enum(['achievement', 'activity'], { message: 'Type must be achievement or activity' }),
  rank: z.enum(['1st', '2nd', '3rd']).optional().nullable(),
  date: z.string().optional().nullable(),
})

router.post('/achievements', authenticateJWT, requireRole(['admin']), async (req, res) => {
  try {
    console.log('[POST /achievements] body:', JSON.stringify(req.body))

    const parsed = createSchema.safeParse(req.body)
    if (!parsed.success) {
      const msg = parsed.error.issues[0]?.message ?? 'Validation failed'
      console.error('[POST /achievements] validation error:', msg)
      return res.status(400).json({ message: msg })
    }

    const { studentId, title, type, rank, date } = parsed.data

    const student = await User.findById(studentId).lean()
    if (!student) return res.status(404).json({ message: 'Student not found' })
    if (student.role !== 'student') return res.status(400).json({ message: 'Selected user is not a student' })

    const created = await Achievement.create({
      studentId,
      title,
      type,
      rank: rank || null,
      date: date && date.trim() ? date.trim() : null,
    })

    const [row] = await enrichAchievements([toAchievementLean(created.toObject() as Record<string, unknown>)])

    const emoji = type === 'achievement' ? '🏆' : '📘'
    await Notice.create({
      title: `${emoji} New ${type === 'achievement' ? 'Achievement' : 'Activity'} Added`,
      description: `"${title}"${rank ? ` — ${rank} place` : ''} has been added to your profile.`,
      type: 'notice',
      userId: studentId,
    })

    res.status(201).json({ achievement: fmt(row) })
  } catch (err: any) {
    console.error('[POST /achievements] error:', err?.message, err?.stack)
    res.status(500).json({ message: err?.message ?? 'Failed to create achievement' })
  }
})

// ── Admin: UPDATE ─────────────────────────────────────────────────────────
const updateSchema = z.object({
  title: z.string().min(2).optional(),
  type: z.enum(['achievement', 'activity']).optional(),
  rank: z.enum(['1st', '2nd', '3rd']).optional().nullable(),
  date: z.string().optional().nullable(),
})

router.put('/achievements/:id', authenticateJWT, requireRole(['admin']), async (req, res) => {
  try {
    const id = req.params.id as string
    const parsed = updateSchema.safeParse(req.body)
    if (!parsed.success) return res.status(400).json({ message: parsed.error.issues[0]?.message })

    const existing = await Achievement.findById(id).lean()
    if (!existing) return res.status(404).json({ message: 'Not found' })

    const update: Record<string, unknown> = {}
    if (parsed.data.title) update.title = parsed.data.title
    if (parsed.data.type) update.type = parsed.data.type
    if (parsed.data.rank !== undefined) update.rank = parsed.data.rank || null
    if (parsed.data.date !== undefined) {
      update.date = parsed.data.date && parsed.data.date.trim() ? parsed.data.date.trim() : null
    }

    const updated = await Achievement.findByIdAndUpdate(id, update, { new: true }).lean()
    const [row] = await enrichAchievements([toAchievementLean(updated as Record<string, unknown>)])

    res.json({ achievement: fmt(row) })
  } catch (err: any) {
    console.error('[PUT /achievements/:id] error:', err?.message, err?.stack)
    res.status(500).json({ message: err?.message ?? 'Failed to update achievement' })
  }
})

// ── Admin: DELETE ─────────────────────────────────────────────────────────
router.delete('/achievements/:id', authenticateJWT, requireRole(['admin']), async (req, res) => {
  try {
    const id = req.params.id as string
    const existing = await Achievement.findById(id).lean()
    if (!existing) return res.status(404).json({ message: 'Not found' })
    await Achievement.findByIdAndDelete(id)
    res.json({ ok: true })
  } catch (err: any) {
    console.error('[DELETE /achievements/:id] error:', err?.message, err?.stack)
    res.status(500).json({ message: err?.message ?? 'Failed to delete achievement' })
  }
})

export default router
