import { atom } from 'nanostores'

export interface StudioSession {
  id: string
  name: string
  slug: string
  is_superadmin: boolean
}

export interface SessionStore {
  studio: StudioSession | null
  isLoading: boolean
}

export const $session = atom<SessionStore>({
  studio: null,
  isLoading: true,
})

export function setSession(studio: StudioSession | null) {
  $session.set({ studio, isLoading: false })
}

export function clearSession() {
  $session.set({ studio: null, isLoading: false })
}
