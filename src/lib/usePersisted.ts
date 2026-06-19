import { useEffect, useState } from 'react'

/** useState that persists to localStorage (safe if storage is unavailable). */
export function usePersisted<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key)
      return raw != null ? (JSON.parse(raw) as T) : initial
    } catch {
      return initial
    }
  })

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value))
    } catch {
      /* storage blocked — ignore */
    }
  }, [key, value])

  return [value, setValue] as const
}
