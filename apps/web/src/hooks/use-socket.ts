'use client'

import { useEffect, useState, useRef } from 'react'
import { io, type Socket } from 'socket.io-client'
import { useAuth } from '@clerk/nextjs'
import { useWorkspace } from './use-workspace'

let sharedSocket: Socket | null = null

export function useSocket() {
  const { getToken } = useAuth()
  const { workspaceId } = useWorkspace()
  const [socket, setSocket] = useState<Socket | null>(null)

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

      setSocket(sharedSocket)
    }

    connect()
  }, [workspaceId, getToken])

  return socket
}

export function useSocketEvent<T>(event: string, handler: (data: T) => void) {
  const socket = useSocket()
  const handlerRef = useRef(handler)
  handlerRef.current = handler

  useEffect(() => {
    if (!socket) return
    const cb = (data: T) => handlerRef.current(data)
    socket.on(event, cb)
    return () => { socket.off(event, cb) }
  }, [socket, event])
}
