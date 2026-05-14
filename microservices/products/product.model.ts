import { Collection, Db, ReturnDocument } from 'mongodb'
import { ProductAtts } from './product.schema.js'

const COLLECTION = 'products'

//helper for validation using our central schema for all data storage and retrieval
function getCollection(db: Db): Collection<ProductAtts> {
  return db.collection<ProductAtts>(COLLECTION)
}

//insert
export async function createProduct(
  db: Db,
  data: ProductAtts
): Promise<ProductAtts> {
  const col = getCollection(db)

  const result = await col.insertOne(data)

  if (!result.acknowledged) {
    throw new Error('Could not save, db write not acknowledged.')
  }

  return data
}

//fetch all products, storeid(shard key) is optional but helps with faster fetches by
//targeting the right shard when querying for a specific shop
export async function getProducts(
  db: Db,
  storeid?: string  //caller can filter by a single store
): Promise<ProductAtts[]> {
  const col = getCollection(db)

  const filter = storeid ? { storeid } : {}

  return col.find(filter).toArray() as Promise<ProductAtts[]>
}

//fetch single product
export async function getProductById(
  db: Db,
  product_id: string,
  storeid: string 
): Promise<ProductAtts | null> {
  const col = getCollection(db)
  //storeid is used to locate the relevant shard first
  return col.findOne({ product_id, storeid }) as Promise<ProductAtts | null>
}

//update
export async function updateProduct(
  db: Db,
  product_id: string,
  storeid: string,             
  updates: Partial<ProductAtts>
): Promise<ProductAtts | null> {
  const col = getCollection(db)

  //API caller is not allowed to overwrite product_id or storeid
  const { product_id: _pid, storeid: _sid, ...safeUpdates } = updates

  const result = await col.findOneAndUpdate(
    { product_id, storeid },
    { $set: safeUpdates },
    { returnDocument: ReturnDocument.AFTER }
  )
  return result as ProductAtts | null
}

export async function setOutOfStock(
  db: Db,
  product_id: string,
  storeid: string
): Promise<void> {
  const col = getCollection(db)

  await col.updateOne(
    { product_id, storeid },
    { $set: { stock: 0 } }
  )
}