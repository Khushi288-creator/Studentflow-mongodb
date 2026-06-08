import 'dotenv/config'
import bcrypt from 'bcrypt'
import connectDB from './config/db'
import { User } from './models/User'

async function main() {
  await connectDB()

  const email = 'admin@school.com'
  const password = 'admin123'
  const name = 'Admin'

  const existing = await User.findOne({ email }).lean()
  if (existing) {
    console.log(`Admin already exists: ${email}`)
    return
  }

  const hash = await bcrypt.hash(password, 12)
  await User.create({ name, email, password: hash, role: 'admin' })

  console.log('✅ Admin created successfully')
  console.log(`   Email   : ${email}`)
  console.log(`   Password: ${password}`)
}

main()
  .catch(console.error)
  .finally(() => process.exit(0))
