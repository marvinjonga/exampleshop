import { Static, Type } from "typebox";

export const InventorySchema = Type.Object({
    product_id: Type.String(),
    quantity: Type.Number({
        minimum: 0
    }),
    location: Type.Array(
        Type.String()
    ),
    storeid: Type.Array(
    Type.String({ minLength: 1 }), 
    { maxItems: 20 }
  )
})

export type InventoryAtts = Static<typeof InventorySchema>

export const UpdateInvSchema = Type.Partial(
  Type.Omit(InventorySchema, ['product_id', 'quantity'])
)

export type UpdateInvBody = Static<typeof UpdateInvSchema>
