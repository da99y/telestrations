import { useUser } from '../useUser'

interface UseLogoutReturns {
  logoutUrl: string
  handleUserRemove: () => void
}

export const useLogout = (apiHost: string): UseLogoutReturns => {
  const { removeUser } = useUser()
  const logoutUrl = `${apiHost}/auth/logout?r=${encodeURIComponent(window.location.origin)}`

  const handleUserRemove = (): void => {
    removeUser()
  }

  return { logoutUrl, handleUserRemove }
}
