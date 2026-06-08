import 'dotenv/config'
import connectDB from '../src/config/db'
import { StudentFace } from '../src/models/StudentFace'
import { FaceAttendance } from '../src/models/FaceAttendance'

async function main() {
  await connectDB()
  const faces = await StudentFace.countDocuments()
  const attendance = await FaceAttendance.countDocuments()
  console.log(JSON.stringify({ ok: true, faces, attendance }))
  process.exit(0)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
