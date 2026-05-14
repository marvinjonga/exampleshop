import fastify from 'fastify'
import fastifyHelmet from '@fastify/helmet'
import fastifyMongo from '@fastify/mongodb'
import inventoryRoutes from './inventory.routes.js'
import { connectProducer, disconnectProducer } from '../../lib/kafka.js'
import { registerSwagger } from '../../plugins/swagger.js'

export async function buildInventoryServer() {
  
   const server = fastify({
      logger: true 
    })

  await server.register(fastifyHelmet)

  await server.register(fastifyMongo, {
    forceClose: true,
    url: process.env.MONGO_URI ?? 'mongodb://localhost:27017',
    database: process.env.MONGO_DB ?? 'exampleshop',
  })

  await registerSwagger(server, {
    title: 'Inventory Service',
    description: 'Inventory management: stock levels, locations, and low-stock events via Kafka',
    version: '1.0.0',
    prefix: '/api/v1/inventory',
  })

  await server.register(inventoryRoutes, { prefix: '/api/v1/inventory' })

  server.get('/ping', async () => 'pong\n')

  await connectProducer()

  server.addHook('onClose', async () => {
    await disconnectProducer()
  })

  return server
}

const isEntryPoint = process.argv[1]?.endsWith('inventory/server.js')
  || process.argv[1]?.endsWith('inventory/server.ts')

if (isEntryPoint) {
  const server = await buildInventoryServer()

  try {
    const port = Number(process.env.PORT ?? 8082)
    const address = await server.listen({ port, host: '0.0.0.0' })
    server.log.info(`Inventory service listening at ${address}`)
  } catch (err) {
    server.log.error(err)
    process.exit(1)
  }
}