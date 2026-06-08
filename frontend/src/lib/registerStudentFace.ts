import { http } from '../api/http'
import { computeDescriptorFromFile, computeFaceDescriptor, descriptorToArray } from './faceApi'

export async function registerStudentFace(opts: {
  studentId: string
  studentName: string
  classId?: string | null
  photoFile?: File | null
  photoUrl?: string | null
}) {
  const { studentId, studentName, classId, photoFile, photoUrl } = opts

  let descriptor: Float32Array
  let resolvedPhotoUrl = photoUrl ?? ''

  if (photoFile) {
    descriptor = await computeDescriptorFromFile(photoFile)
    const reader = new FileReader()
    resolvedPhotoUrl = await new Promise<string>((resolve, reject) => {
      reader.onload = () => resolve(String(reader.result))
      reader.onerror = () => reject(new Error('Failed to read photo'))
      reader.readAsDataURL(photoFile)
    })
  } else if (photoUrl) {
    descriptor = await computeFaceDescriptor(photoUrl.startsWith('http') ? photoUrl : `${window.location.origin}${photoUrl}`)
    resolvedPhotoUrl = photoUrl
  } else {
    throw new Error('Photo is required to register face for attendance.')
  }

  await http.post('/faces/register', {
    studentId,
    studentName,
    classId: classId ?? null,
    faceDescriptor: descriptorToArray(descriptor),
    photoUrl: resolvedPhotoUrl,
  })
}
