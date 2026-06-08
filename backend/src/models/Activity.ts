import mongoose, { type InferSchemaType } from 'mongoose'
import { withStringId } from './common'

const activitySchema = withStringId(
  {
    name: { type: String, required: true },
    description: { type: String, required: true },
    duration: { type: String, required: true },
    fees: { type: Number, required: true },
    scheduleDays: { type: String, required: true },
    scheduleTime: { type: String, default: null },
    targetClass: { type: String, default: 'All Classes' },
    capacity: { type: Number, default: null },
    level: { type: String, default: 'Beginner' },
    batch: { type: String, default: 'Morning' },
    icon: { type: String, default: '🎯' },
  },
  { collection: 'activities', updatedAt: false },
)

export type ActivityDoc = InferSchemaType<typeof activitySchema> & { _id: string; createdAt: Date }

export const Activity = mongoose.models.Activity ?? mongoose.model('Activity', activitySchema)
