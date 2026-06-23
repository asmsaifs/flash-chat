import { useAuth } from '@clerk/nextjs'

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  token?: string,
  workspaceId?: string
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }
  if (token) headers['Authorization'] = `Bearer ${token}`
  if (workspaceId) headers['X-Workspace-ID'] = workspaceId

  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  })

  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: res.statusText }))
    throw new Error(error.message ?? 'Request failed')
  }

  if (res.status === 204) return undefined as T
  return res.json()
}

// Token-less version used outside of React hooks (e.g. server components)
export const api = {
  get: <T>(path: string, opts?: { token?: string; workspaceId?: string }) =>
    request<T>('GET', path, undefined, opts?.token, opts?.workspaceId),
  post: <T>(path: string, body?: unknown, opts?: { token?: string; workspaceId?: string }) =>
    request<T>('POST', path, body, opts?.token, opts?.workspaceId),
  put: <T>(path: string, body?: unknown, opts?: { token?: string; workspaceId?: string }) =>
    request<T>('PUT', path, body, opts?.token, opts?.workspaceId),
  patch: <T>(path: string, body?: unknown, opts?: { token?: string; workspaceId?: string }) =>
    request<T>('PATCH', path, body, opts?.token, opts?.workspaceId),
  delete: <T>(path: string, opts?: { token?: string; workspaceId?: string }) =>
    request<T>('DELETE', path, undefined, opts?.token, opts?.workspaceId),
}

// Hook-based version with automatic token injection
export function useApi() {
  const { getToken } = useAuth()

  const getHeaders = async (workspaceId?: string) => {
    const token = await getToken()
    return { token: token ?? undefined, workspaceId }
  }

  return {
    get: async <T>(path: string, workspaceId?: string) => {
      const opts = await getHeaders(workspaceId)
      return request<T>('GET', path, undefined, opts.token, opts.workspaceId)
    },
    post: async <T>(path: string, body?: unknown, workspaceId?: string) => {
      const opts = await getHeaders(workspaceId)
      return request<T>('POST', path, body, opts.token, opts.workspaceId)
    },
    put: async <T>(path: string, body?: unknown, workspaceId?: string) => {
      const opts = await getHeaders(workspaceId)
      return request<T>('PUT', path, body, opts.token, opts.workspaceId)
    },
    patch: async <T>(path: string, body?: unknown, workspaceId?: string) => {
      const opts = await getHeaders(workspaceId)
      return request<T>('PATCH', path, body, opts.token, opts.workspaceId)
    },
    delete: async <T>(path: string, workspaceId?: string) => {
      const opts = await getHeaders(workspaceId)
      return request<T>('DELETE', path, undefined, opts.token, opts.workspaceId)
    },
  }
}
