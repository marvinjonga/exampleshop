import { buildProductsServer } from './microservices/products/server.js'
import { buildInventoryServer } from './microservices/inventory/server.js'

const products = await buildProductsServer()
const inventory = await buildInventoryServer()

try {
  await products.listen({ port: 8081, host: '0.0.0.0' })
  await inventory.listen({ port: 8082, host: '0.0.0.0' })

  console.log('Products service: http://localhost:8081')
  console.log('Inventory service: http://localhost:8082')
} catch (err) {
  console.error(err)
  process.exit(1)
}