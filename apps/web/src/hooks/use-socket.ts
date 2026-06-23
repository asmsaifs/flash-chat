'use client'

import { useEffect, useRef } from 'react'
import { io, type Socket } from 'socket.io-client'
import { useAuth } from '@clerk/nextjs'
import { useWorkspace } from './use-workspace'

let sharedSocket: Socket | null = null

export function useSocket() {
  const { getToken } = useAuth()
  const { workspaceId } = useWorkspace()
  const socketRef = useRef<Socket | null>(null)

  useEffect(() => {
    if (!workspaceId) return

    const connect = async () => {
      const token = await getToken()
      if (!token) return

      if (!sharedSocket || !sharedSocket.connected) {
        sharedSocket = io(process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000', {
          auth: { token, workspaceId },
          transports: ['websocket'],
        })
      }

      socketRef.current = sharedSocket
    }

    connect()

    return () => {
      // Don't disconnect — reused across components
    }
  }, [workspaceId, getToken])

  return socketRef.current
}

export function useSocketEvent<T>(event: string, handler: (data: T) => void) {
  const socket = useSocket()

  useEffect(() => {
    if (!socket) return
    socket.on(event, handler)
    return () => { socket.off(event, handler) }
  }, [socket, event, handler])
}
