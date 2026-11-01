// Seleção de imagem no APK (câmera nativa / galeria) via Capacitor Camera.
import { Camera, CameraDirection, CameraResultType, CameraSource } from '@capacitor/camera'

export async function nativePick({ source = 'prompt', front = false } = {}) {
  const photo = await Camera.getPhoto({
    quality: 85, width: 1400, correctOrientation: true, resultType: CameraResultType.Uri,
    source: source === 'camera' ? CameraSource.Camera : source === 'gallery' ? CameraSource.Photos : CameraSource.Prompt,
    direction: front ? CameraDirection.Front : CameraDirection.Rear,
    promptLabelHeader: 'Foto', promptLabelPhoto: 'Escolher da galeria', promptLabelPicture: 'Tirar foto', promptLabelCancel: 'Cancelar',
  })
  const res = await fetch(photo.webPath)
  return await res.blob()
}
