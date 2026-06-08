import express from 'express'
import { Notice } from '../models/Notice'
import { NoticeRead } from '../models/NoticeRead'
import { authenticateJWT } from '../middleware/auth'

const router = express.Router()

// Get notifications for logged-in user (personal + broadcast)
router.get('/notifications', authenticateJWT, async (req, res) => {
  const userId = req.auth!.userId

  const notices = await Notice.find({ $or: [{ userId }, { userId: null }] })
    .sort({ date: -1 })
    .limit(50)
    .lean()

  const reads = await NoticeRead.find({ userId }).select('noticeId readAt').lean()
  const readMap = new Map(reads.map((r) => [r.noticeId, r.readAt]))

  res.json({
    notifications: notices.map((n) => ({
      id: n._id,
      title: n.title,
      description: n.description,
      type: n.type,
      date: n.date.toISOString().slice(0, 10),
      createdAt: n.date.toISOString(),
      readAt: readMap.get(n._id) ? new Date(readMap.get(n._id) as Date).toISOString() : undefined,
    })),
  })
})

// Unread count
router.get('/notifications/unread-count', authenticateJWT, async (req, res) => {
  const userId = req.auth!.userId

  const total = await Notice.countDocuments({ $or: [{ userId }, { userId: null }] })
  const read = await NoticeRead.countDocuments({ userId })

  res.json({ count: Math.max(0, total - read) })
})

// Mark all as read
router.post('/notifications/mark-read', authenticateJWT, async (req, res) => {
  const userId = req.auth!.userId

  const notices = await Notice.find({ $or: [{ userId }, { userId: null }] }).select('_id').lean()

  for (const n of notices) {
    await NoticeRead.findOneAndUpdate(
      { noticeId: n._id, userId },
      { $setOnInsert: { readAt: new Date() } },
      { upsert: true },
    )
  }

  res.json({ ok: true })
})

export default router
