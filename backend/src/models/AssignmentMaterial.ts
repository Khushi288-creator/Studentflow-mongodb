import mongoose, { type InferSchemaType } from 'mongoose'
import { withStringId } from './common'

const assignmentMaterialSchema = withStringId(
  {
    assignmentId: { type: String, required: true, index: true },
    fileUrl: { type: String, required: true },
  },
  { collection: 'assignment_materials', updatedAt: false },
)

export type AssignmentMaterialDoc = InferSchemaType<typeof assignmentMaterialSchema> & {
  _id: string
  createdAt: Date
}

export const AssignmentMaterial =
  mongoose.models.AssignmentMaterial ?? mongoose.model('AssignmentMaterial', assignmentMaterialSchema)
