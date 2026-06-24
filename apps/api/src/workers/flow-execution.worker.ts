import { Worker } from 'bullmq'
import { redis } from '../lib/redis.js'
import { processNode } from '../services/flow-engine.service.js'

export function startFlowExecutionWorker() {
  const worker = new Worker(
    'flow-execution-delay',
    async (job) => {
      const { executionId, conversationId, nodeId } = job.data as {
        executionId: string
        conversationId: string
        nodeId: string
      }
      await processNode(executionId, conversationId, nodeId)
    },
    { connection: redis as never }
  )

  worker.on('failed', (job, err) => {
    console.error(`[FlowExecutionWorker] Job ${job?.id} failed:`, err.message)
  })

  console.log('[FlowExecutionWorker] started')
}
