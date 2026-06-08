import mongoose, { type InferSchemaType } from 'mongoose'
import { withStringId } from './common'

const parentMeetingSchema = withStringId(
  {
    parentId: { type: String, required: true, index: true },
    teacherId: { type: String, required: true, index: true },
    studentId: { type: String, required: true, index: true },
    date: { type: String, required: true },
    time: { type: String, required: true },
    status: { type: String, default: 'pending' },
    note: { type: String, default: null },
  },
  { collection: 'parent_meetings', updatedAt: false },
)

export type ParentMeetingDoc = InferSchemaType<typeof parentMeetingSchema> & {
  _id: string
  createdAt: Date
}

export const ParentMeeting =
  mongoose.models.ParentMeeting ?? mongoose.model('ParentMeeting', parentMeetingSchema)
