import { Consumer } from 'kafkajs'
import { Db } from 'mongodb'
import { createConsumer, TOPICS } from '../../lib/kafka.js'
import { setOutOfStock } from './product.model.js'

let consumer: Consumer | null = null

export async function startProductConsumer(db: Db): Promise<void> {
  consumer = createConsumer('products-service')

  await consumer.connect()

  //subscribe to the out-of-stock topic only
  await consumer.subscribe({
    topic: TOPICS.OUT_OF_STOCK,
    fromBeginning: false,
  })

  await consumer.run({
    eachMessage: async ({ message }) => {
      if (!message.value) return

      try {
        const event = JSON.parse(message.value.toString())

        const { product_id, storeid } = event

        if (!product_id || !storeid) {
          console.warn('Out-of-stock event missing fields', event)
          return
        }

        await setOutOfStock(db, product_id, storeid)

        console.log(`Product ${product_id} marked out of stock for store ${storeid}`)
      } catch (err) {
        console.error('Failed to process out-of-stock event', err)
      }
    },
  })

  console.log('Products Kafka consumer started')
}

export async function stopProductConsumer(): Promise<void> {
  await consumer?.disconnect()
}