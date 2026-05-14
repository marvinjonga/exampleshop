import { Collection, Db, ReturnDocument } from 'mongodb'
import { InventoryAtts } from './inventory.schema.js'
import { publish, TOPICS } from '../../lib/kafka.js'

const COLLECTION = 'inventory'

function getCollection(db: Db): Collection<InventoryAtts> {
  return db.collection<InventoryAtts>(COLLECTION)
}

export async function createInventory(
  db: Db,
  data: InventoryAtts
): Promise<InventoryAtts> {
  const col = getCollection(db)

  const result = await col.insertOne(data)

  if (!result.acknowledged) {
    throw new Error('Could not save, db write not acknowledged.')
  }

  return data
}

export async function getInventoryByPid(
  db: Db,
  product_id: string,
  storeid: string
): Promise<InventoryAtts | null> {
  const col = getCollection(db)
  return col.findOne({ product_id, storeid }) as Promise<InventoryAtts | null>
}

export async function updateInventory(
  db: Db,
  product_id: string,
  updates: Partial<InventoryAtts>
): Promise<InventoryAtts | null> {
  const col = getCollection(db)

  const { product_id: _pid, ...safeUpdates } = updates

  const result = await col.findOneAndUpdate(
    { product_id },
    { $set: safeUpdates },
    { returnDocument: ReturnDocument.AFTER }
  )

  return result as InventoryAtts | null
}

//create kafka events when there is low stock and when we run out of stock
export async function decrementStock(
  db: Db,
  product_id: string,
  storeid: string,
  quantity: number
): Promise<InventoryAtts | null> {
  const col = getCollection(db)

  const result = await col.findOneAndUpdate(
    { product_id, storeid },
    { $inc: { quantity: -quantity } },
    { returnDocument: ReturnDocument.AFTER }
  )

  if (!result) return null

  if (result.quantity <= 0) {
    await publish(TOPICS.OUT_OF_STOCK, {
      product_id,
      storeid,
      quantity: result.quantity,
      timestamp: new Date().toISOString(),
    })
  } else if (result.quantity < 10) {
    await publish(TOPICS.LOW_STOCK, {
      product_id,
      storeid,
      quantity: result.quantity,
      timestamp: new Date().toISOString(),
    })
  }

  return result
}