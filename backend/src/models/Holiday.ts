import mongoose, { type InferSchemaType } from 'mongoose'
import { withStringId } from './common'

const holidaySchema = withStringId(
  {
    name: { type: String, required: true },
    date: { type: String, required: true, index: true },
  },
  { collection: 'holidays', updatedAt: false },
)

export type HolidayDoc = InferSchemaType<typeof holidaySchema> & { _id: string; createdAt: Date }

export const Holiday = mongoose.models.Holiday ?? mongoose.model('Holiday', holidaySchema)
