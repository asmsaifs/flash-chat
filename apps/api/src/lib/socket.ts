import type { Server } from 'socket.io'

let io: Server | null = null

export function setSocketIo(server: Server) {
  io = server
}

export function emitToWorkspace(workspaceId: string, event: string, data: unknown) {
  io?.to(`workspace:${workspaceId}`).emit(event, data)
}

export function emitToConversation(conversationId: string, event: string, data: unknown) {
  io?.to(`conversation:${conversationId}`).emit(event, data)
}
