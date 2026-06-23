import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface WorkspaceStore {
  workspaceId: string | null
  setWorkspaceId: (id: string) => void
}

export const useWorkspaceStore = create<WorkspaceStore>()(
  persist(
    (set) => ({
      workspaceId: null,
      setWorkspaceId: (id) => set({ workspaceId: id }),
    }),
    { name: 'flashchat-workspace' }
  )
)
