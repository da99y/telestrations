import { useEffect } from 'react'

import type { AuthUser, ProxyProjectsPermission } from '../../types/auth'
import { useUser } from '../useUser'

interface BffErrorBody {
  statusCode?: number
  message?: string
}

export interface UseSessionOptions {
  onUnauthorized?: (loginUrl: string) => void
  onForbidden?: (redirectUrl: string) => void
  onError?: (error: unknown) => void
}

async function postJson<T>(url: string): Promise<T> {
  const res = await fetch(url, {
    method: 'POST',
    credentials: 'include',
  })

  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as BffErrorBody
    const err = new Error(`BFF ${res.status}`) as Error & {
      status: number
      body: BffErrorBody
    }
    err.status = res.status
    err.body = body
    throw err
  }

  return (await res.json()) as T
}

export const useSession = (apiHost: string, options?: UseSessionOptions): void => {
  const { addUser, removeUser } = useUser()

  useEffect(() => {
    const handleSessionRequest = async (): Promise<void> => {
      try {
        const [user, proxyProjects] = await Promise.all([
          postJson<AuthUser>(`${apiHost}/session`),
          postJson<ProxyProjectsPermission>(`${apiHost}/session/proxy`),
        ])

        if (user.error) {
          options?.onForbidden?.(user.error.redirectUrl)
        } else {
          addUser({ ...user, ...proxyProjects })
        }
      } catch (e) {
        const err = e as { status?: number; body?: BffErrorBody }

        if (err?.status === 403 && err.body?.message) {
          options?.onForbidden?.(err.body.message)
          return
        }

        removeUser()

        const currentUrl = window.location.href
        const loginUrl = `${apiHost}/auth/login?r=${encodeURIComponent(currentUrl)}`

        if (options?.onUnauthorized) {
          options.onUnauthorized(loginUrl)
        } else {
          options?.onError?.(e)
        }
      }
    }

    void handleSessionRequest()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
}
