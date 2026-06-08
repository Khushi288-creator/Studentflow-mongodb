declare module 'face-api.js' {
  export const nets: {
    tinyFaceDetector: { loadFromUri: (url: string) => Promise<void> }
    faceLandmark68Net: { loadFromUri: (url: string) => Promise<void> }
    faceRecognitionNet: { loadFromUri: (url: string) => Promise<void> }
  }
  export class TinyFaceDetectorOptions {
    constructor(options?: { inputSize?: number; scoreThreshold?: number })
  }
  export function detectSingleFace(
    input: HTMLVideoElement | HTMLImageElement | HTMLCanvasElement,
    options?: TinyFaceDetectorOptions,
  ): {
    withFaceLandmarks(): {
      withFaceDescriptor(): Promise<{
        descriptor: Float32Array
      } | undefined>
    }
  }
  export function euclideanDistance(a: Float32Array, b: Float32Array): number
}
