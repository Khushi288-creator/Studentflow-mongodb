import express from 'express'
import { z } from 'zod'
import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import crypto from 'crypto'

import { authenticateJWT } from '../middleware/auth'
import { type Role } from '../types/enums'
import { User } from '../models/User'
import { Teacher } from '../models/Teacher'
import { PasswordResetToken } from '../models/PasswordResetToken'
import { leanDoc, pickUserFields } from '../utils/mongoHelpers'

const router = express.Router()

const registerSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(6),
})

const loginSchema = z.object({
  loginId: z.string().min(1),
  password: z.string().min(6),
})

const selectRoleSchema = z.object({
  role: z.enum(['student', 'teacher', 'admin']),
})

router.post('/auth/register', async (req, res) => {
  try {
    const parsed = registerSchema.safeParse(req.body)
    if (!parsed.success) return res.status(400).json({ message: parsed.error.issues[0]?.message })

    const { name, email, password } = parsed.data
    const existing = await User.findOne({ email }).lean()
    if (existing) return res.status(409).json({ message: 'Email already in use' })

    const passwordHash = await bcrypt.hash(password, 12)
    const user = await User.create({ name, email, password: passwordHash, role: 'student' })
    const accessToken = signAccessToken(user.id, user.role as Role)
    res.status(201).json({ accessToken, user: pickUserFields(user.toObject()) })
  } catch (err: any) {
    console.error('[POST /auth/register]', err?.message)
    res.status(500).json({ message: err?.message ?? 'Registration failed' })
  }
})

router.post('/auth/login', async (req, res) => {
  try {
    const parsed = loginSchema.safeParse(req.body)
    if (!parsed.success) return res.status(400).json({ message: parsed.error.issues[0]?.message })

    const { loginId, password } = parsed.data
    const foundUser =
      (await User.findOne({ email: loginId }).lean()) ??
      (await User.findOne({ email: `${loginId.toUpperCase()}@school.local` }).lean())

    if (!foundUser) return res.status(401).json({ message: 'Invalid ID or password' })

    const ok = await bcrypt.compare(password, foundUser.password)
    if (!ok) return res.status(401).json({ message: 'Invalid ID or password' })

    const accessToken = signAccessToken(foundUser._id, foundUser.role as Role)
    res.json({
      accessToken,
      user: pickUserFields(foundUser),
    })
  } catch (err: any) {
    console.error('[POST /auth/login]', err?.message)
    res.status(500).json({ message: err?.message ?? 'Login failed' })
  }
})

router.post('/auth/select-role', authenticateJWT, async (req, res) => {
  try {
    const parsed = selectRoleSchema.safeParse(req.body)
    if (!parsed.success) return res.status(400).json({ message: parsed.error.issues[0]?.message })

    const { role } = parsed.data
    const userId = req.auth!.userId

    const updated = await User.findByIdAndUpdate(
      userId,
      { role },
      { new: true },
    ).lean()
    if (!updated) return res.status(404).json({ message: 'User not found' })

    if (role === 'teacher') {
      await Teacher.findOneAndUpdate(
        { userId },
        { subject: 'General' },
        { upsert: true, new: true, setDefaultsOnInsert: true },
      )
    }

    const accessToken = signAccessToken(updated._id, updated.role as Role)
    res.json({ accessToken, user: pickUserFields(updated) })
  } catch (err: any) {
    console.error('[POST /auth/select-role]', err?.message)
    res.status(500).json({ message: err?.message ?? 'Failed to select role' })
  }
})

router.post('/auth/forgot-password', async (req, res) => {
  try {
    const schema = z.object({ email: z.string().email() })
    const parsed = schema.safeParse(req.body)
    if (!parsed.success) return res.status(400).json({ message: 'Invalid request' })

    const { email } = parsed.data
    const user = await User.findOne({ email }).lean()
    if (!user) return res.json({ resetToken: 'NA' })

    const token = crypto.randomBytes(32).toString('hex')
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000)
    await PasswordResetToken.create({ userId: user._id, token, expiresAt })
    res.json({ resetToken: token })
  } catch (err: any) {
    console.error('[POST /auth/forgot-password]', err?.message)
    res.status(500).json({ message: err?.message ?? 'Failed' })
  }
})

router.post('/auth/reset-password', async (req, res) => {
  try {
    const schema = z.object({ token: z.string().min(20), newPassword: z.string().min(6) })
    const parsed = schema.safeParse(req.body)
    if (!parsed.success) return res.status(400).json({ message: parsed.error.issues[0]?.message })

    const { token, newPassword } = parsed.data
    const resetToken = await PasswordResetToken.findOne({ token }).lean()
    if (!resetToken) return res.status(400).json({ message: 'Invalid reset token' })
    if (resetToken.usedAt) return res.status(400).json({ message: 'Reset token already used' })
    if (resetToken.expiresAt < new Date()) return res.status(400).json({ message: 'Reset token expired' })

    const passwordHash = await bcrypt.hash(newPassword, 12)
    await User.findByIdAndUpdate(resetToken.userId, { password: passwordHash })
    await PasswordResetToken.findByIdAndUpdate(resetToken._id, { usedAt: new Date() })
    res.json({ ok: true })
  } catch (err: any) {
    console.error('[POST /auth/reset-password]', err?.message)
    res.status(500).json({ message: err?.message ?? 'Failed to reset password' })
  }
})

router.get('/me', authenticateJWT, async (req, res) => {
  const user = await User.findById(req.auth!.userId).lean()
  if (!user) return res.status(404).json({ message: 'User not found' })
  res.json({ user: pickUserFields(user) })
})

function signAccessToken(userId: string, role: Role) {
  const secret = process.env.JWT_ACCESS_SECRET
  if (!secret) throw new Error('JWT_ACCESS_SECRET missing')
  const exp = process.env.JWT_ACCESS_EXPIRES ?? '7d'
  return jwt.sign({ sub: userId, role }, secret, { expiresIn: exp } as any)
}

export default router
