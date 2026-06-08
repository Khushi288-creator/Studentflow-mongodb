import dotenv from 'dotenv'
import path from 'path'

// ⚠️ dotenv MUST be loaded before any other imports that use process.env
dotenv.config({ path: path.join(__dirname, '..', '.env') })

import connectDB from './config/db'
import { app } from './app'

const port = process.env.PORT ? Number(process.env.PORT) : 4000

async function start() {
  if (!process.env.MONGO_URI) {
    console.error('[server] MONGO_URI is required')
    process.exit(1)
  }
  await connectDB()

  app.listen(port, () => {
    console.log(`[server] running on http://localhost:${port}`)
  })
}

start().catch((err) => {
  console.error('[server] failed to start:', err)
  process.exit(1)
})
