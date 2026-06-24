import type { Server, Namespace } from 'socket.io'

let io: Server | null = null
let widgetNs: Namespace | null = null

export function setSocketIo(server: Server) {
  io = server
}

export function setWidgetNamespace(ns: Namespace) {
  widgetNs = ns
}

export function emitToWorkspace(workspaceId: string, event: string, data: unknown) {
  io?.to(`workspace:${workspaceId}`).emit(event, data)
}

export function emitToWidgetConversation(conversationId: string, event: string, data: unknown) {
  widgetNs?.to(`conversation:${conversationId}`).emit(event, data)
}
