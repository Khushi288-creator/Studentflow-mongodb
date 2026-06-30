import { Schema } from 'mongoose'
import { createId } from '../utils/id'

export const stringId = {
  type: String,
  default: createId,
}

export function withStringId(schemaDef: Record<string, unknown>, options?: Record<string, unknown>) {
  return new Schema(
    {
      _id: stringId,
      ...schemaDef,
    },
    {
      timestamps: true,
      ...options,
    },
  )
}
