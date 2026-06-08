import mongoose, { type InferSchemaType } from 'mongoose'
import { withStringId } from './common'

const timetableSchema = withStringId(
  {
    type: { type: String, default: 'regular' },
    class: { type: String, required: true, index: true },
    subject: { type: String, required: true },
    date: { type: String, default: null },
    time: { type: String, required: true },
    teacherId: { type: String, default: null, index: true },
  },
  { collection: 'timetables', updatedAt: false },
)

export type TimetableDoc = InferSchemaType<typeof timetableSchema> & { _id: string; createdAt: Date }

export const Timetable = mongoose.models.Timetable ?? mongoose.model('Timetable', timetableSchema)
