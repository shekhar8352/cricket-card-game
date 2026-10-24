import { create } from 'zustand'

interface UIState {
  theme: 'light' | 'dark'
  speed: 1 | 2
  starter: import('../types/engine').PlayerCard[] | null
  toggleTheme: () => void
  setSpeed: (s: 1 | 2) => void
  setStarter: (c: import('../types/engine').PlayerCard[] | null) => void
}

export const useUI = create<UIState>((set) => ({
  theme: (localStorage.getItem('ccg_theme') as 'light' | 'dark') || 'light',
  speed: 1,
  starter: null,
  toggleTheme: () =>
    set((s) => {
      const theme = s.theme === 'light' ? 'dark' : 'light'
      localStorage.setItem('ccg_theme', theme)
      document.documentElement.classList.toggle('dark', theme === 'dark')
      return { theme }
    }),
  setSpeed: (speed) => set({ speed }),
  setStarter: (starter) => set({ starter }),
}))
