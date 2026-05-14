import { FastifyInstance } from 'fastify'
import { ProductsSchema, ProductAtts, UpdateProdSchema, UpdateProdBody } from './product.schema.js';
import { createProduct, getProducts, getProductById, updateProduct } from './product.model.js'


async function productRoutes (fastify: FastifyInstance) {

    //get all products
    fastify.get<{ Querystring: { storeid?: string } }>( 
    '/',
    {
      schema: {
        response: { 200: { type: 'array', items: ProductsSchema } },
      },
    },
    async (request, reply) => {
      const db = fastify.mongo.db!

      const { storeid } = request.query
      const products = await getProducts(db, storeid)
      return products
    }
  );

  //get single product using id
  fastify.get<{ Params: { id: string }; Querystring: { storeid: string }}>(
    '/:id',
    {
      schema: {
        response: {
          200: ProductsSchema,
          404: { type: 'object', properties: { error: { type: 'string' } } },
        },
      },
    },
    async (request, reply) => {
      const db = fastify.mongo.db!
      const product = await getProductById(db, request.params.id, request.query.storeid)

      if (!product) {
        return reply.status(404).send({ error: 'Product not found' })
      }

      return product
    }
  );
 
  //create / add new product
  fastify.post<{ Body: ProductAtts }>(
    '/add',
    {
      schema: {
        body: ProductsSchema, //validate body before handler runs using our schema
        response: { 200: ProductsSchema },
      },
    },
    async (request, reply) => {
      const db = fastify.mongo.db!
      const product = await createProduct(db, request.body)
      return product
    }
  );


  //updates using patch route
  fastify.patch<{
    Params: { id: string }
    Querystring: { storeid: string }
    Body: UpdateProdBody
  }>(
    '/:id',
    {
      schema: {
        body: UpdateProdSchema,
        response: {
          200: ProductsSchema,
          404: { type: 'object', properties: { error: { type: 'string' } } },
        },
      },
    },
    async (request, reply) => {
      const db = fastify.mongo.db!
      const updated = await updateProduct(
        db,
        request.params.id,
        request.query.storeid,
        request.body
      )
      if (!updated) {
        return reply.status(404).send({ error: 'Product not found' })
      }
      return updated
    }
  );


}

export default productRoutes;