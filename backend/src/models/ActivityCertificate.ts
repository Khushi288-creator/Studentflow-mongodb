import mongoose, { type InferSchemaType } from 'mongoose'
import { withStringId } from './common'

const activityCertificateSchema = withStringId(
  {
    studentId: { type: String, required: true, index: true },
    activityId: { type: String, required: true, index: true },
    issuedDate: { type: String, required: true },
  },
  { collection: 'activity_certificates', updatedAt: false },
)

export type ActivityCertificateDoc = InferSchemaType<typeof activityCertificateSchema> & {
  _id: string
  createdAt: Date
}

export const ActivityCertificate =
  mongoose.models.ActivityCertificate ?? mongoose.model('ActivityCertificate', activityCertificateSchema)
