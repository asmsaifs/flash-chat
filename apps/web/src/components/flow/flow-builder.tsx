'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  ReactFlow,
  addEdge,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  type Connection,
  type Node,
  type Edge,
  Panel,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useApi } from '@/lib/api'
import { useWorkspace } from '@/hooks/use-workspace'
import { TriggerNode } from './nodes/trigger-node'
import { MessageNode } from './nodes/message-node'
import { ConditionNode } from './nodes/condition-node'
import { ActionNode } from './nodes/action-node'
import { AiReplyNode } from './nodes/ai-reply-node'
import { NodePanel } from './node-panel'
import { Save, Sparkles, ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import type { Flow } from '@flashchat/shared'

const nodeTypes = {
  trigger: TriggerNode,
  message: MessageNode,
  condition: ConditionNode,
  action: ActionNode,
  ai_reply: AiReplyNode,
}

const defaultNodes: Node[] = [
  {
    id: 'trigger-1',
    type: 'trigger',
    position: { x: 250, y: 50 },
    data: { triggerType: 'keyword', keyword: 'start' },
  },
]

interface Props { flowId: string }

export function FlowBuilder({ flowId }: Props) {
  const { workspaceId } = useWorkspace()
  const api = useApi()
  const qc = useQueryClient()

  const [nodes, setNodes, onNodesChange] = useNodesState(defaultNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([])
  const [selectedNode, setSelectedNode] = useState<Node | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [flowName, setFlowName] = useState('Untitled Flow')

  const { data: flowData } = useQuery({
    queryKey: ['flow', flowId],
    queryFn: () => api.get<{ data: Flow }>(`/workspaces/${workspaceId}/flows/${flowId}`, workspaceId),
    enabled: !!workspaceId && !!flowId,
  })

  useEffect(() => {
    if (!flowData?.data) return
    const flow = flowData.data
    setFlowName(flow.name)
    if (flow.nodes && (flow.nodes as Node[]).length > 0) setNodes(flow.nodes as Node[])
    if (flow.edges && (flow.edges as Edge[]).length > 0) setEdges(flow.edges as Edge[])
  }, [flowData, setNodes, setEdges])

  const onConnect = useCallback(
    (connection: Connection) => setEdges((eds) => addEdge(connection, eds)),
    [setEdges]
  )

  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    setSelectedNode(node)
  }, [])

  const updateNodeData = useCallback((nodeId: string, data: Record<string, unknown>) => {
    setNodes((nds) => nds.map((n) => (n.id === nodeId ? { ...n, data: { ...n.data, ...data } } : n)))
  }, [setNodes])

  const addNode = useCallback((type: string) => {
    const id = `${type}-${Date.now()}`
    const newNode: Node = {
      id,
      type,
      position: { x: 250 + Math.random() * 100, y: 200 + nodes.length * 100 },
      data: {},
    }
    setNodes((nds) => [...nds, newNode])
  }, [nodes.length, setNodes])

  const save = async () => {
    setIsSaving(true)
    try {
      await api.put(
        `/workspaces/${workspaceId}/flows/${flowId}`,
        { name: flowName, nodes, edges },
        workspaceId
      )
      qc.invalidateQueries({ queryKey: ['flows', workspaceId] })
    } finally {
      setIsSaving(false)
    }
  }

  const suggestNode = async () => {
    const lastNode = nodes.at(-1)
    const result = await api.post<{ data: { nodeType: string; content: Record<string, unknown>; reasoning: string } }>(
      `/workspaces/${workspaceId}/flows/ai-suggest`,
      { existingNodes: nodes, currentNode: lastNode, userGoal: flowName },
      workspaceId
    )
    if (result?.data?.nodeType) {
      addNode(result.data.nodeType)
    }
  }

  return (
    <div className="flex h-screen">
      {/* Toolbar */}
      <div className="absolute top-0 left-0 right-0 z-10 h-14 border-b bg-card flex items-center px-4 gap-4">
        <Link href="/dashboard/flows" className="flex items-center text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back
        </Link>
        <input
          value={flowName}
          onChange={(e) => setFlowName(e.target.value)}
          className="flex-1 max-w-xs font-semibold bg-transparent border-none outline-none text-foreground"
        />
        <div className="ml-auto flex gap-2">
          <button
            onClick={suggestNode}
            className="flex items-center gap-2 text-sm border px-3 py-1.5 rounded-md hover:bg-accent transition-colors"
          >
            <Sparkles className="h-4 w-4 text-purple-500" />
            AI Suggest
          </button>
          <button
            onClick={save}
            disabled={isSaving}
            className="flex items-center gap-2 text-sm bg-primary text-primary-foreground px-4 py-1.5 rounded-md hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            <Save className="h-4 w-4" />
            {isSaving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>

      {/* Canvas */}
      <div className="flex-1 pt-14">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeClick={onNodeClick}
          nodeTypes={nodeTypes}
          fitView
          className="bg-background"
        >
          <Background color="hsl(var(--border))" />
          <Controls className="bg-card border border-border shadow-sm" />
          <MiniMap className="bg-card border border-border" />

          {/* Node palette */}
          <Panel position="top-left" className="mt-14">
            <div className="bg-card border border-border rounded-xl p-3 space-y-1 shadow-sm">
              <p className="text-xs font-medium text-muted-foreground mb-2">Add Node</p>
              {['message', 'condition', 'user_input', 'action', 'ai_reply', 'delay', 'webhook', 'live_chat'].map((type) => (
                <button
                  key={type}
                  onClick={() => addNode(type)}
                  className="block w-full text-left text-xs px-2 py-1.5 rounded hover:bg-accent transition-colors capitalize"
                >
                  {type.replace('_', ' ')}
                </button>
              ))}
            </div>
          </Panel>
        </ReactFlow>
      </div>

      {/* Node editor panel */}
      {selectedNode && (
        <NodePanel
          node={selectedNode}
          onUpdate={(data) => updateNodeData(selectedNode.id, data)}
          onClose={() => setSelectedNode(null)}
        />
      )}
    </div>
  )
}
