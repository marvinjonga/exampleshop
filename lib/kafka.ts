import { Kafka, Producer, Consumer, logLevel } from 'kafkajs'

export const TOPICS = {
  LOW_STOCK: 'inventory.low-stock',
  OUT_OF_STOCK: 'inventory.out-of-stock',
} as const

const kafka = new Kafka({
  clientId: process.env.KAFKA_CLIENT_ID ?? 'shop-api',
  brokers: (process.env.KAFKA_BROKERS ?? 'kafka:9092').split(','),
  logLevel: process.env.NODE_ENV === 'production' ? logLevel.WARN : logLevel.INFO,
})

// ─── PRODUCER ─────────────────────────────────────────────────────────────────

let producer: Producer | null = null

export async function connectProducer(): Promise<void> {
  producer = kafka.producer()
  await producer.connect()
  console.log('Kafka producer connected')
}

export async function disconnectProducer(): Promise<void> {
  await producer?.disconnect()
}

export async function publish(topic: string, message: object): Promise<void> {
  if (!producer) throw new Error('Kafka producer not connected')

  await producer.send({
    topic,
    messages: [
      {
        key: (message as any).storeid ?? null,
        value: JSON.stringify(message),
        timestamp: Date.now().toString(),
      },
    ],
  })
}

// ─── CONSUMER ─────────────────────────────────────────────────────────────────

// createConsumer returns a new consumer instance.
// Each service that needs to consume passes its own groupId.
// Consumer group ID determines which group shares the message load —
// all pods of the products service use the same groupId so each
// message is processed by exactly one pod, not all three.
export function createConsumer(groupId: string): Consumer {
  return kafka.consumer({ groupId })
}