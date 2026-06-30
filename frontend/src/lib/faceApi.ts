import * as faceapi from 'face-api.js'

const MODEL_URL = 'https://cdn.jsdelivr.net/gh/justadudewhohacks/face-api.js@0.22.2/weights'

let modelsLoaded = false
let modelsLoading: Promise<void> | null = null

export const FACE_MATCH_THRESHOLD = 0.55

export async function loadFaceModels(): Promise<void> {
  if (modelsLoaded) return
  if (modelsLoading) return modelsLoading

  modelsLoading = (async () => {
    await Promise.all([
      faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
      faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
      faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
    ])
    modelsLoaded = true
  })()

  return modelsLoading
}

export function descriptorToArray(descriptor: Float32Array): number[] {
  return Array.from(descriptor)
}

export function arrayToDescriptor(values: number[]): Float32Array {
  return new Float32Array(values)
}

async function imageFromSource(source: HTMLImageElement | HTMLCanvasElement | string): Promise<HTMLImageElement> {
  if (source instanceof HTMLImageElement) return source
  if (source instanceof HTMLCanvasElement) {
    const img = new Image()
    img.src = source.toDataURL('image/jpeg', 0.92)
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve()
      img.onerror = () => reject(new Error('Failed to read image from canvas'))
    })
    return img
  }

  const img = new Image()
  img.crossOrigin = 'anonymous'
  img.src = source
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve()
    img.onerror = () => reject(new Error('Failed to load image'))
  })
  return img
}

export async function computeFaceDescriptor(
  source: HTMLImageElement | HTMLCanvasElement | string,
): Promise<Float32Array> {
  await loadFaceModels()
  const img = await imageFromSource(source)
  const detection = await faceapi
    .detectSingleFace(img, new faceapi.TinyFaceDetectorOptions({ inputSize: 416, scoreThreshold: 0.5 }))
    .withFaceLandmarks()
    .withFaceDescriptor()

  if (!detection) {
    throw new Error('No face detected. Use a clear front-facing photo with good lighting.')
  }

  return detection.descriptor
}

export async function computeDescriptorFromFile(file: File): Promise<Float32Array> {
  const url = URL.createObjectURL(file)
  try {
    return await computeFaceDescriptor(url)
  } finally {
    URL.revokeObjectURL(url)
  }
}

export type RegisteredFace = {
  studentId: string
  studentName: string
  classId: string | null
  faceDescriptor: number[]
  photoUrl?: string
}

export function findBestFaceMatch(
  probe: Float32Array,
  registered: RegisteredFace[],
): { face: RegisteredFace; distance: number } | null {
  let best: { face: RegisteredFace; distance: number } | null = null

  for (const face of registered) {
    if (!face.faceDescriptor?.length) continue
    const ref = arrayToDescriptor(face.faceDescriptor)
    const distance = faceapi.euclideanDistance(probe, ref)
    if (!best || distance < best.distance) {
      best = { face, distance }
    }
  }

  if (!best || best.distance > FACE_MATCH_THRESHOLD) return null
  return best
}

export async function detectFaceFromVideo(
  video: HTMLVideoElement,
): Promise<Float32Array | null> {
  await loadFaceModels()
  const detection = await faceapi
    .detectSingleFace(video, new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.5 }))
    .withFaceLandmarks()
    .withFaceDescriptor()
  return detection?.descriptor ?? null
}
