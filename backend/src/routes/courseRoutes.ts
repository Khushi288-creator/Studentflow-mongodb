import express from 'express'
import { Course } from '../models/Course'
import { Teacher } from '../models/Teacher'
import { User } from '../models/User'
import { authenticateJWT, requireRole } from '../middleware/auth'

const router = express.Router()

async function coursesWithTeacherNames() {
  const courses = await Course.find().lean()
  const teacherIds = [...new Set(courses.map((c) => c.teacherId))]
  const teachers = await Teacher.find({ _id: { $in: teacherIds } }).select('_id userId').lean()
  const userIds = [...new Set(teachers.map((t) => t.userId))]
  const users = await User.find({ _id: { $in: userIds } }).select('_id name').lean()
  const userNameById = new Map(users.map((u) => [u._id, u.name]))
  const teacherUserById = new Map(teachers.map((t) => [t._id, t.userId]))

  return courses.map((c) => ({
    id: c._id,
    name: c.name,
    teacherName: userNameById.get(teacherUserById.get(c.teacherId) ?? '') ?? '',
  }))
}

router.get('/courses', authenticateJWT, async (req, res) => {
  const role = req.auth!.role
  const scope = (req.query.scope as string | undefined) ?? ''

  if (role === 'admin' && scope === 'teacher') {
    // Admin can query all courses with scope as an extra option.
  }

  // Teacher: either scope=teacher or by role.
  if (role === 'teacher' || scope === 'teacher') {
    const teacher = await Teacher.findOne({ userId: req.auth!.userId }).select('_id').lean()
    if (!teacher) return res.json({ courses: [] })
    const courses = await Course.find({ teacherId: teacher._id }).lean()
    return res.json({
      courses: courses.map((c) => ({ id: c._id, name: c.name })),
    })
  }

  if (role === 'student') {
    return res.json({ courses: await coursesWithTeacherNames() })
  }

  // Admin: show all courses.
  return res.json({ courses: await coursesWithTeacherNames() })
})

// Teacher: ensure a subject exists by name (create if not found)
router.post('/courses/ensure', authenticateJWT, requireRole(['teacher']), async (req, res) => {
  const { name } = req.body
  if (!name) return res.status(400).json({ message: 'name required' })

  const teacher = await Teacher.findOne({ userId: req.auth!.userId }).select('_id').lean()
  if (!teacher) return res.status(403).json({ message: 'Teacher profile missing' })

  let course = await Course.findOne({ name, teacherId: teacher._id }).lean()

  if (!course) {
    const created = await Course.create({ name, teacherId: teacher._id })
    course = created.toObject()
  }

  res.json({ course: { id: course._id, name: course.name } })
})

export default router
