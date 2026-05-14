import { Static, Type } from 'typebox'

//added validation for storeid and price only for demo purposes 
export const ProductsSchema = Type.Object({
  product_id: Type.String(),
  sku: Type.String(),
  name: Type.String(),
  description: Type.String(),
  stock: Type.Number(),
  price: Type.Number({ 
    minimum: 0,
    maximum:1000000,
    description: 'Must be in smallest unit pence/cents £10.50 = 1050',
  }),
  storeid: Type.Array(
    Type.String({ minLength: 1 }), 
    { maxItems: 20 }
  )
})

export type ProductAtts = Static<typeof ProductsSchema>



export const UpdateProdSchema = Type.Partial(
  Type.Omit(ProductsSchema, ['product_id', 'storeid'])
)
export type UpdateProdBody = Static<typeof UpdateProdSchema>