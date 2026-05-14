import { FastifyInstance } from 'fastify'
import { InventorySchema, InventoryAtts, UpdateInvSchema, UpdateInvBody } from './inventory.schema.js';
import { createInventory, getInventoryByPid, updateInventory, decrementStock } from './inventory.model.js'

async function inventoryRoutes (fastify: FastifyInstance) {

  //get inventory using product id and our shard key storeid
  fastify.get<{ Params: { id: string }; Querystring: { storeid: string } }>(
    '/:id',
    {
      schema: {
        response: {
          200: InventorySchema,
          404: { type: 'object', properties: { error: { type: 'string' } } },
        },
      },
    },
    async (request, reply) => {
      const db = fastify.mongo.db!
      const inventory = await getInventoryByPid(db, request.params.id, request.query.storeid)

      if (!inventory) {
        return reply.status(404).send({ error: 'Inventory not found' })
      }

      return inventory
    }
  )
 
  //create / add new inventory
  fastify.post<{ Body: InventoryAtts }>(
    '/add',
    {
      schema: {
        body: InventorySchema, //validate body before handler runs using our schema
        response: { 200: InventorySchema },
      },
    },
    async (request, reply) => {
      const db = fastify.mongo.db!
      const inventory = await createInventory(db, request.body)
      return inventory
    }
  )

  //update 
  fastify.patch<{
      Params: { id: string }
      Body: UpdateInvBody
    }>(
      '/:id',
      {
        schema: {
          body: UpdateInvSchema,
          response: {
            200: InventorySchema,
            404: { type: 'object', properties: { error: { type: 'string' } } },
          },
          tags: ['Inventory Service'],
          summary: 'Updates inventory',
          description: 'Updates inventory fields',
        },
      },
      async (request, reply) => {
        const db = fastify.mongo.db!
        const updated = await updateInventory(
          db,
          request.params.id,
          request.body
        )
  
        if (!updated) {
          return reply.status(404).send({ error: 'Product not found' })
        }
  
        return updated
      }
    );

  //decrement stock — called when an order is placed or stock is consumed.
  fastify.patch<{
    Params: { id: string }
    Querystring: { storeid: string }
    Body: { quantity: number }
  }>(
    '/:id/decrement',
    {
      schema: {
        body: {
          type: 'object',
          required: ['quantity'],
          properties: {
            quantity: { type: 'number', minimum: 1 },
          },
        },
        response: {
          200: InventorySchema,
          404: { type: 'object', properties: { error: { type: 'string' } } },
        },
      },
    },
    async (request, reply) => {
      const db = fastify.mongo.db!
      const updated = await decrementStock(
        db,
        request.params.id,
        request.query.storeid,
        request.body.quantity
      )

      if (!updated) {
        return reply.status(404).send({ error: 'Inventory not found' })
      }

      return updated
    }
  )

}

export default inventoryRoutes;