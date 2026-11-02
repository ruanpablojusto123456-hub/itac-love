import { Download, X } from 'lucide-react'

// Aviso de nova versão do APK (verificado ao abrir o app)
export default function UpdateBanner({ info, onClose }) {
  return (
    <div className="fixed inset-x-0 top-safe z-50 p-3">
      <div className="max-w-xl mx-auto bg-primary text-white rounded-2xl shadow-xl p-4 flex items-center gap-3">
        <Download className="w-6 h-6 shrink-0" />
        <div className="flex-1 text-[14px]"><b>Nova versão {info.latest_app_version} disponível.</b> Baixe para ter as últimas melhorias e correções.</div>
        {info.apk_download_url && <a href={info.apk_download_url} target="_blank" rel="noreferrer" className="bg-card text-primary font-bold rounded-full px-4 py-2 text-[14px]">Baixar</a>}
        <button onClick={onClose} aria-label="Fechar"><X className="w-5 h-5" /></button>
      </div>
    </div>
  )
}
