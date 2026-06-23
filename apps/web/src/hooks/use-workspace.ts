'use client'

import { useWorkspaceStore } from '@/store/workspace.store'

export function useWorkspace() {
  const { workspaceId, setWorkspaceId } = useWorkspaceStore()
  return { workspaceId: workspaceId ?? '', setWorkspaceId }
}
