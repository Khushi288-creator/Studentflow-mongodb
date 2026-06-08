import mongoose, { type InferSchemaType } from 'mongoose'
import { withStringId } from './common'

const resumeSchema = withStringId(
  {
    userId: { type: String, required: true, unique: true, index: true },
    headline: { type: String, required: true },
    summary: { type: String, required: true },
    skills: { type: String, required: true },
  },
  { collection: 'resumes', timestamps: false },
)

export type ResumeDoc = InferSchemaType<typeof resumeSchema> & { _id: string }

export const Resume = mongoose.models.Resume ?? mongoose.model('Resume', resumeSchema)
