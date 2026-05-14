import { FastifyInstance } from 'fastify'
import fastifySwagger from '@fastify/swagger'
import fastifySwaggerUi from '@fastify/swagger-ui'

//this is called once per server at startup but never in Production 
export async function registerSwagger(
  server: FastifyInstance,
  options: {
    title: string
    description: string
    version: string
    prefix: string 
  }
): Promise<void> {

  //in production nothing below this line runs for performance
  if (process.env.NODE_ENV === 'production') return

  await server.register(fastifySwagger, {
    openapi: {
      openapi: '3.0.0',
      info: {
        title: options.title,
        description: options.description,
        version: options.version,
      },
      tags: [
        { name: options.title, description: `${options.title} endpoints` },
      ],
       servers: [
        {
          url: `http://localhost:${process.env.PORT}`,
          description: 'Local development',
        },
      ],
      components: {
        securitySchemes: {
          bearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT',
          },
        },
      },
    },
  })

  await server.register(fastifySwaggerUi, {
    routePrefix: `/docs`,
    uiConfig: {
      docExpansion: 'list',
      deepLinking: true,
    },
    staticCSP: true,
  })

  server.log.info(`Swagger UI available at http://localhost:${process.env.PORT}/docs`)
}