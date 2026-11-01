// Redimensiona e comprime imagens antes do upload (economiza dados e armazenamento)
export async function toJpeg(fileOrBlob, max = 1080, quality = 0.82) {
  const url = URL.createObjectURL(fileOrBlob)
  try {
    const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url })
    const scale = Math.min(1, max / Math.max(img.width, img.height))
    const c = document.createElement('canvas')
    c.width = Math.round(img.width * scale); c.height = Math.round(img.height * scale)
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height)
    return await new Promise(res => c.toBlob(res, 'image/jpeg', quality))
  } finally { URL.revokeObjectURL(url) }
}

export const blobToDataURL = (blob) => new Promise((res, rej) => {
  const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(blob)
})

// Gera fotos ilustrativas para os perfis de exemplo do modo demonstração
export function demoAvatar(name, hue, variant = 0, w = 480) {
  const c = document.createElement('canvas'); c.width = 480; c.height = 600
  const g = c.getContext('2d')
  const grad = g.createLinearGradient(0, 0, 480, 600)
  grad.addColorStop(0, `hsl(${hue},70%,${62 - variant * 6}%)`); grad.addColorStop(1, `hsl(${(hue + 40) % 360},75%,${42 - variant * 4}%)`)
  g.fillStyle = grad; g.fillRect(0, 0, 480, 600)
  g.fillStyle = 'rgba(255,255,255,.9)'
  g.beginPath(); g.arc(240, 250, 95, 0, Math.PI * 2); g.fill()
  g.beginPath(); g.ellipse(240, 560, 170, 150, 0, Math.PI, 0); g.fill()
  g.fillStyle = `hsl(${hue},60%,35%)`; g.font = 'bold 90px Outfit, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'
  g.fillText(name[0].toUpperCase(), 240, 255)
  g.fillStyle = 'rgba(255,255,255,.85)'; g.font = '600 26px "Plus Jakarta Sans", sans-serif'
  g.fillText(`Foto ${variant + 1} · exemplo`, 240, 40)
  if (w === 480) return c.toDataURL('image/jpeg', 0.7)
  const d = document.createElement('canvas'); d.width = w; d.height = Math.round(w * 1.25)
  d.getContext('2d').drawImage(c, 0, 0, d.width, d.height)
  return d.toDataURL('image/jpeg', 0.68)
}

export function demoSelfie(name, hue) {
  const c = document.createElement('canvas'); c.width = 640; c.height = 480
  const g = c.getContext('2d')
  g.fillStyle = '#e7ecf5'; g.fillRect(0, 0, 640, 480)
  g.fillStyle = `hsl(${hue},45%,70%)`
  g.beginPath(); g.arc(250, 200, 90, 0, Math.PI * 2); g.fill()
  g.beginPath(); g.ellipse(250, 480, 170, 150, 0, Math.PI, 0); g.fill()
  g.fillStyle = '#fff'; g.strokeStyle = '#2b6cb0'; g.lineWidth = 3
  g.fillRect(380, 210, 200, 130); g.strokeRect(380, 210, 200, 130)
  g.fillStyle = `hsl(${hue},45%,70%)`; g.fillRect(395, 230, 50, 65)
  g.fillStyle = '#2b6cb0'; g.font = 'bold 15px sans-serif'; g.fillText('REPÚBLICA FEDERATIVA', 452, 240)
  g.fillStyle = '#333'; g.font = '13px sans-serif'; g.fillText('NOME: ' + name.toUpperCase(), 452, 268); g.fillText('RG: MG-00.000.000', 452, 290)
  g.fillText('DOCUMENTO DE EXEMPLO', 452, 312)
  g.fillStyle = '#555'; g.font = '600 18px sans-serif'; g.fillText('Selfie com documento (exemplo do modo demonstração)', 20, 30)
  return c.toDataURL('image/jpeg', 0.7)
}
