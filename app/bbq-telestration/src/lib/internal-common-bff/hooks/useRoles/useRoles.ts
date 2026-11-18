import { useMemo } from 'react'

import { useUser } from '../useUser'

interface UseRolesReturns<T> {
  roles: T[] | string[]
}

type RoleField = 'menu' | 'permissionGroupName'

export const useRoles = <T>(
  roleField: RoleField = 'menu',
): UseRolesReturns<T> => {
  const { user } = useUser()
  const roles = useMemo(() => {
    let flatMap: string[] = []
    switch (roleField) {
      case 'menu': {
        const originProjectPolicies =
          user?.permissionGroupList.flatMap(({ policyList }) =>
            policyList.flatMap((policy) => policy[roleField]),
          ) ?? []
        const proxyProjectsPolicies =
          user?.proxyProjects
            ?.map(({ permissionGroupList, hostPath }) => ({
              policyList: permissionGroupList.flatMap((v) => v.policyList),
              hostPath,
            }))
            .flatMap(({ policyList, hostPath }) =>
              policyList.flatMap(
                (policy) => `${hostPath}/${policy[roleField]}`,
              ),
            ) ?? []
        flatMap = [...originProjectPolicies, ...proxyProjectsPolicies]
        break
      }
      case 'permissionGroupName': {
        const originProjectPermissionGroupNames =
          user?.permissionGroupList.flatMap(
            (permissionGroup) => permissionGroup[roleField],
          ) ?? []
        const proxyProjectsPermissionGroupNames =
          user?.proxyProjects?.flatMap(
            ({ permissionGroupList, hostPath }) =>
              permissionGroupList.flatMap(
                (v) => `${hostPath}/${v[roleField]}`,
              ),
          ) ?? []
        flatMap = [
          ...originProjectPermissionGroupNames,
          ...proxyProjectsPermissionGroupNames,
        ]
        break
      }
    }
    return [...new Set(flatMap)]
  }, [roleField, user])

  return { roles }
}
