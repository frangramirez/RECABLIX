import { atom } from 'nanostores'

export interface ImpersonatedStudio {
  id: string
  name: string
  slug: string
}

export const $impersonatedStudio = atom<ImpersonatedStudio | null>(null)

export function setImpersonatedStudio(studio: ImpersonatedStudio | null) {
  $impersonatedStudio.set(studio)
  // Persistir en sessionStorage para mantener entre navegaciones
  if (typeof window !== 'undefined') {
    if (studio) {
      sessionStorage.setItem('impersonated_studio', JSON.stringify(studio))
    } else {
      sessionStorage.removeItem('impersonated_studio')
    }
  }
}

export function loadImpersonatedStudio() {
  if (typeof window !== 'undefined') {
    const stored = sessionStorage.getItem('impersonated_studio')
    if (stored) {
      try {
        $impersonatedStudio.set(JSON.parse(stored))
      } catch {
        sessionStorage.removeItem('impersonated_studio')
      }
    }
  }
}

export function clearImpersonatedStudio() {
  $impersonatedStudio.set(null)
  if (typeof window !== 'undefined') {
    sessionStorage.removeItem('impersonated_studio')
  }
}
