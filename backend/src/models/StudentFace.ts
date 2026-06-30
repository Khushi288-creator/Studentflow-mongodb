import mongoose, { Schema, type InferSchemaType } from 'mongoose'

const studentFaceSchema = new Schema(
  {
    studentId: { type: String, required: true, unique: true, index: true },
    studentName: { type: String, required: true },
    classId: { type: String, default: null },
    faceDescriptor: { type: [Number], required: true },
    photoUrl: { type: String, required: true },
  },
  { timestamps: true, collection: 'student_faces' },
)

export type StudentFaceDoc = InferSchemaType<typeof studentFaceSchema> & {
  _id: mongoose.Types.ObjectId
  createdAt: Date
  updatedAt: Date
}

export const StudentFace =
  mongoose.models.StudentFace ?? mongoose.model('StudentFace', studentFaceSchema)
