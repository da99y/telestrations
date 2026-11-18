export const getLogoutUrl = ({ bffHost }: { bffHost: string }): string => {
  return `${bffHost}/auth/logout?r=${encodeURIComponent(window.location.href)}`
}
