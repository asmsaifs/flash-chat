'use client'

import { useParams } from 'next/navigation'
import { FlowBuilder } from '@/components/flow/flow-builder'

export default function FlowEditorPage() {
  const { flowId } = useParams<{ flowId: string }>()
  return <FlowBuilder flowId={flowId} />
}
