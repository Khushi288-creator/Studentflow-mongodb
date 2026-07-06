import 'dotenv/config'
import bcrypt from 'bcrypt'
import connectDB from './config/db'
import { User } from './models/User'
import { StudentProfile } from './models/StudentProfile'
import { Teacher } from './models/Teacher'
import { ParentProfile } from './models/ParentProfile'

async function hashPwd(pwd: string) {
  return bcrypt.hash(pwd, 12)
}

async function main() {
  await connectDB()
  console.log('🌱 Starting seed...')

  // ── Admin ──────────────────────────────────────────
  const adminEmail = 'admin@school.com'
  const existingAdmin = await User.findOne({ email: adminEmail }).lean()
  if (!existingAdmin) {
    await User.create({
      name: 'Admin',
      email: adminEmail,
      password: await hashPwd('admin123'),
      role: 'admin',
    })
    console.log('✅ Admin created | Email: admin@school.com | Password: admin123')
  } else {
    console.log('ℹ️  Admin already exists')
  }

  // ── Teachers ───────────────────────────────────────
  const teachers = [
    { name: 'Priya Sharma', uniqueId: 'TCH001', subject: 'Mathematics', phone: '9876543210' },
    { name: 'Rahul Patel', uniqueId: 'TCH002', subject: 'English', phone: '9876543211' },
    { name: 'Meena Joshi', uniqueId: 'TCH003', subject: 'Science', phone: '9876543212' },
    { name: 'Suresh Mehta', uniqueId: 'TCH004', subject: 'Hindi', phone: '9876543213' },
    { name: 'Anita Desai', uniqueId: 'TCH005', subject: 'Computer', phone: '9876543214' },
  ]

  const teacherUserIds: string[] = []

  for (const t of teachers) {
    const email = `${t.uniqueId}@school.local`
    const existing = await User.findOne({ email }).lean()
    if (!existing) {
      const user = await User.create({
        name: t.name,
        email,
        password: await hashPwd('teacher123'),
        role: 'teacher',
        uniqueId: t.uniqueId,
      })
      await Teacher.create({
        userId: user._id,
        subject: t.subject,
        phone: t.phone,
      })
      teacherUserIds.push(String(user._id))
      console.log(`✅ Teacher: ${t.name} | ID: ${t.uniqueId} | Password: teacher123`)
    } else {
      teacherUserIds.push(String(existing._id))
      console.log(`ℹ️  Teacher already exists: ${t.uniqueId}`)
    }
  }

  // ── Students ───────────────────────────────────────
  const students = [
    { name: 'Aarav Shah', uniqueId: 'STU001', className: '5', gender: 'Male', dob: '2015-03-15', fatherName: 'Amit Shah', motherName: 'Priti Shah' },
    { name: 'Diya Patel', uniqueId: 'STU002', className: '5', gender: 'Female', dob: '2015-07-22', fatherName: 'Ravi Patel', motherName: 'Sonal Patel' },
    { name: 'Arjun Mehta', uniqueId: 'STU003', className: '6', gender: 'Male', dob: '2014-11-08', fatherName: 'Vijay Mehta', motherName: 'Kavita Mehta' },
    { name: 'Ishita Joshi', uniqueId: 'STU004', className: '6', gender: 'Female', dob: '2014-05-19', fatherName: 'Nilesh Joshi', motherName: 'Rekha Joshi' },
    { name: 'Karan Trivedi', uniqueId: 'STU005', className: '7', gender: 'Male', dob: '2013-09-30', fatherName: 'Dinesh Trivedi', motherName: 'Hansa Trivedi' },
  ]

  const studentUserIds: string[] = []

  for (const s of students) {
    const email = `${s.uniqueId}@school.local`
    const existing = await User.findOne({ email }).lean()
    if (!existing) {
      const user = await User.create({
        name: s.name,
        email,
        password: await hashPwd('student123'),
        role: 'student',
        uniqueId: s.uniqueId,
      })
      await StudentProfile.create({
        userId: String(user._id),
        className: s.className,
        gender: s.gender,
        dob: s.dob,
        fatherName: s.fatherName,
        motherName: s.motherName,
      })
      studentUserIds.push(String(user._id))
      console.log(`✅ Student: ${s.name} | ID: ${s.uniqueId} | Password: student123`)
    } else {
      studentUserIds.push(String(existing._id))
      console.log(`ℹ️  Student already exists: ${s.uniqueId}`)
    }
  }

  // ── Parents ────────────────────────────────────────
  const parents = [
    { name: 'Amit Shah', uniqueId: 'PAR001', studentIndex: 0 },
    { name: 'Ravi Patel', uniqueId: 'PAR002', studentIndex: 1 },
    { name: 'Vijay Mehta', uniqueId: 'PAR003', studentIndex: 2 },
    { name: 'Nilesh Joshi', uniqueId: 'PAR004', studentIndex: 3 },
    { name: 'Dinesh Trivedi', uniqueId: 'PAR005', studentIndex: 4 },
  ]

  for (const p of parents) {
    const email = `${p.uniqueId}@school.local`
    const existing = await User.findOne({ email }).lean()
    if (!existing) {
      const user = await User.create({
        name: p.name,
        email,
        password: await hashPwd('parent123'),
        role: 'parent',
        uniqueId: p.uniqueId,
      })
      await ParentProfile.create({
        userId: String(user._id),
        studentId: studentUserIds[p.studentIndex],
      })
      console.log(`✅ Parent: ${p.name} | ID: ${p.uniqueId} | Password: parent123`)
    } else {
      console.log(`ℹ️  Parent already exists: ${p.uniqueId}`)
    }
  }

  console.log('\n🎉 Seed complete!')
  console.log('\n📋 Login Credentials:')
  console.log('Admin    → admin@school.com   | admin123')
  console.log('Teachers → TCH001-TCH005@school.local | teacher123')
  console.log('Students → STU001-STU005@school.local | student123')
  console.log('Parents  → PAR001-PAR005@school.local | parent123')
}

main()
  .catch(console.error)
  .finally(() => process.exit(0))