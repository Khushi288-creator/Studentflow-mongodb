import express from 'express'
import PDFDocument from 'pdfkit'
import jwt from 'jsonwebtoken'
import { Result } from '../models/Result'
import { Course } from '../models/Course'
import { Resume } from '../models/Resume'
import { StudentEnrollment } from '../models/StudentEnrollment'
import { Assignment } from '../models/Assignment'
import { Submission } from '../models/Submission'

const router = express.Router()

router.get('/reports/results.pdf', async (_req, res) => {
  const doc = new PDFDocument({ margin: 40 })
  res.setHeader('Content-Type', 'application/pdf')
  res.setHeader('Content-Disposition', 'inline; filename="results.pdf"')
  doc.pipe(res)

  doc.fontSize(20).text('StudentFlow - Results', { align: 'left' })
  doc.moveDown()

  const results = await Result.find().sort({ createdAt: -1 }).limit(100).lean()
  const courseIds = [...new Set(results.map((r) => r.courseId))]
  const courses = await Course.find({ _id: { $in: courseIds } }).select('name').lean()
  const courseNameById = new Map(courses.map((c) => [c._id, c.name]))

  if (!results.length) {
    doc.fontSize(12).text('No stored results found yet.')
    doc.end()
    return
  }

  for (const r of results) {
    const courseName = courseNameById.get(r.courseId) ?? 'Unknown'
    doc.fontSize(12).text(`Course: ${courseName} | Marks: ${r.marks} | Grade: ${r.grade}`)
  }

  doc.moveDown()
  doc.fontSize(10).text(`Generated at: ${new Date().toISOString()}`)
  doc.end()
})

router.get('/reports/resume.pdf', async (_req, res) => {
  const doc = new PDFDocument({ margin: 40 })
  res.setHeader('Content-Type', 'application/pdf')
  res.setHeader('Content-Disposition', 'inline; filename="resume.pdf"')
  doc.pipe(res)

  doc.fontSize(20).text('StudentFlow - Resume', { align: 'left' })
  doc.moveDown()

  const resume = await Resume.findOne().sort({ _id: -1 }).lean()
  if (!resume) {
    doc.fontSize(12).text('No resume found yet.')
    doc.end()
    return
  }

  doc.fontSize(14).text(resume.headline || 'Resume')
  doc.moveDown(0.5)
  doc.fontSize(12).text(resume.summary || '')
  doc.moveDown(0.5)
  doc.fontSize(12).text(`Skills: ${resume.skills || ''}`)

  doc.moveDown()
  doc.fontSize(10).text(`Generated at: ${new Date().toISOString()}`)
  doc.end()
})

function optionalAuthRole(req: express.Request): { userId: string; role: string } | null {
  const header = req.headers.authorization
  const token = header?.startsWith('Bearer ') ? header.slice('Bearer '.length) : null
  if (!token) return null
  const secret = process.env.JWT_ACCESS_SECRET
  if (!secret) return null
  try {
    const payload = jwt.verify(token, secret) as any
    return payload?.sub && payload?.role ? { userId: payload.sub, role: payload.role } : null
  } catch {
    return null
  }
}

router.get('/assistant/recommendations', async (req, res) => {
  const auth = optionalAuthRole(req)
  if (!auth || auth.role !== 'student') {
    return res.json({ recommendations: ['Log in as student to get personalized recommendations.'] })
  }

  const enrollments = await StudentEnrollment.find({ userId: auth.userId })
    .select('_id courseId')
    .lean()
  const studentIds = enrollments.map((e) => e._id)
  const courseIds = enrollments.map((e) => e.courseId)

  const now = new Date()
  const assignments = await Assignment.find({
    courseId: { $in: courseIds },
    dueDate: { $gte: now },
  })
    .select('_id courseId')
    .lean()

  let pending = 0
  for (const a of assignments) {
    const hasSubmission = await Submission.findOne({
      assignmentId: a._id,
      studentId: { $in: studentIds },
    })
      .select('_id')
      .lean()
    if (!hasSubmission) pending += 1
  }

  return res.json({
    recommendations: [
      pending ? `You have ${pending} pending assignments. Submit them to improve your results.` : 'Nice! No pending assignments right now.',
      'Check your Attendance page to keep your attendance high.',
      'Visit Events for registrations and updates.',
    ],
  })
})

export default router
