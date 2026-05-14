import fastify from 'fastify'
import fastifyHelmet from '@fastify/helmet'
import fastifyMongo from '@fastify/mongodb'
import productRoutes from './product.routes.js'
import { connectProducer, disconnectProducer } from '../../lib/kafka.js'
import { startProductConsumer, stopProductConsumer } from './product.consumer.js'
import { registerSwagger } from '../../plugins/swagger.js'

export async function buildProductsServer() {
  const server = fastify({
    logger: true 
  })

  await registerSwagger(server, {
    title: 'Products Service',
    description: 'Product catalogue management across Examplestore stores',
    version: '1.0.0',
    prefix: '/api/v1/products',
  })
  
  await server.register(fastifyHelmet)

  await server.register(fastifyMongo, {
    forceClose: true,
    url: process.env.MONGO_URI ?? 'mongodb://mongo:27017',
    database: process.env.MONGO_DB ?? 'exampleshop',
  })

  await server.register(productRoutes, { prefix: '/api/v1/products' })

  server.get('/ping', async () => 'pong\n')

  await connectProducer()

  //start kafka consumer after MongoDB is registered
  try {
    await startProductConsumer(server.mongo.db!)
  } catch (err) {
    server.log.error({ err }, 'Kafka consumer failed to start')
  }

  server.addHook('onClose', async () => {
    await disconnectProducer()
    await stopProductConsumer()
  })

  return server
}

const isEntryPoint = process.argv[1]?.endsWith('products/server.js')
  || process.argv[1]?.endsWith('products/server.ts')

if (isEntryPoint) {
  const server = await buildProductsServer()

  try {
    const port = Number(process.env.PORT ?? 8081)
    const address = await server.listen({ port, host: '0.0.0.0' })
    server.log.info(`Products service listening at ${address}`)
  } catch (err) {
    server.log.error(err)
    process.exit(1)
  }
}