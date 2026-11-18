import { useCallback, useEffect, useState } from 'react'
import type { AuthUserWithProxyProjects, Nullable } from '../../types/auth'

interface UseUserReturns {
  user: Nullable<AuthUserWithProxyProjects>
  removeUser: () => void
  addUser: (data: AuthUserWithProxyProjects) => void
}

const SESSION_KEY = 'session'
const SESSION_CHANGE_EVENT = 'internal-common-bff:session-change'

function readStorage(): Nullable<AuthUserWithProxyProjects> {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(SESSION_KEY)
    return raw ? (JSON.parse(raw) as AuthUserWithProxyProjects) : null
  } catch {
    return null
  }
}

function writeStorage(data: Nullable<AuthUserWithProxyProjects>): void {
  if (typeof window === 'undefined') return
  try {
    if (data === null) {
      window.localStorage.removeItem(SESSION_KEY)
    } else {
      window.localStorage.setItem(SESSION_KEY, JSON.stringify(data))
    }
    window.dispatchEvent(new Event(SESSION_CHANGE_EVENT))
  } catch {
    void 0
  }
}

export const useUser = (): UseUserReturns => {
  const [user, setUser] = useState<Nullable<AuthUserWithProxyProjects>>(() => readStorage())

  useEffect(() => {
    const sync = (): void => setUser(readStorage())
    const handleStorage = (e: StorageEvent): void => {
      if (e.key !== SESSION_KEY) return
      sync()
    }
    window.addEventListener('storage', handleStorage)
    window.addEventListener(SESSION_CHANGE_EVENT, sync)
    return () => {
      window.removeEventListener('storage', handleStorage)
      window.removeEventListener(SESSION_CHANGE_EVENT, sync)
    }
  }, [])

  const removeUser = useCallback((): void => {
    writeStorage(null)
    setUser(null)
  }, [])

  const addUser = useCallback((data: AuthUserWithProxyProjects): void => {
    writeStorage(data)
    setUser(data)
  }, [])

  return { user, removeUser, addUser }
}
