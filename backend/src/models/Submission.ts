import mongoose, { type InferSchemaType } from 'mongoose'
import { withStringId } from './common'

const submissionSchema = withStringId(
  {
    assignmentId: { type: String, required: true, index: true },
    studentId: { type: String, required: true, index: true },
    fileUrl: { type: String, required: true },
    marks: { type: Number, default: null },
  },
  { collection: 'submissions', updatedAt: false },
)

export type SubmissionDoc = InferSchemaType<typeof submissionSchema> & { _id: string; createdAt: Date }

export const Submission = mongoose.models.Submission ?? mongoose.model('Submission', submissionSchema)
