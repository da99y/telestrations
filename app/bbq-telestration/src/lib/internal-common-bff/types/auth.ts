export interface AuthUser<R = string> {
  accessedAt: string
  adMobile: string
  cn: string
  createdAt: string
  displayUsername: string
  dnCode: string
  email: string
  empNo: string
  expiresAt: string
  grCode: string
  organization: string
  permissionGroupList: AuthUserPermissionGroup<R>[]
  position: string
  remoteIp: string
  sessionId: string
  username: string
  wst: string

  error?: {
    errorCode: string
    reason: string
    projectId: string
    redirectUrl: string
  }
}

export interface AuthUserPermissionGroup<R> {
  permissionGroupId: number
  permissionGroupName: R
  permissionGroupDescription: string
  policyList: AuthUserPolicy[]
  attributes: Attribute[]
}

export interface AuthUserPolicy {
  policyId: string
  policyName: string
  projectId: string
  httpMethod: string
  requestUrl: string
  actionType: string
  menu: string
  isIncludesPersonalInfo: boolean
}

interface Attribute {
  key: string
  value: string
}

export interface ProxyProjectsPermission {
  proxyProjects: {
    id: number
    hostPath: string
    targetHost: string
    targetPath: string
    permissionGroupList: AuthUserPermissionGroup<string>[]
  }[]
}

export type AuthUserWithProxyProjects<R = string> = AuthUser<R> &
  ProxyProjectsPermission

export type Nullable<T> = T | null
