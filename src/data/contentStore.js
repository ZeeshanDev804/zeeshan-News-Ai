const collections = {
  articles: new Map(),
  topics: new Map(),
  trends: new Map(),
  opportunities: new Map(),
  videos: new Map(),
  social: new Map(),
  notifications: new Map(),
  analytics: new Map(),
  approvals: new Map(),
  audits: new Map()
};

function validateItem(item) {
  if (!item || typeof item !== "object") {
    throw new Error("Data item is required.");
  }

  if (!item.id) {
    throw new Error("Data item ID is required.");
  }

  return item;
}

function getCollection(name) {
  if (!collections[name]) {
    throw new Error(`Unknown collection: ${name}`);
  }

  return collections[name];
}

export function createItem(collectionName, item) {
  const collection = getCollection(collectionName);
  const validItem = validateItem(item);

  if (collection.has(validItem.id)) {
    throw new Error(
      `Item already exists: ${validItem.id}`
    );
  }

  collection.set(validItem.id, {
    ...validItem,
    storedAt: new Date().toISOString()
  });

  return collection.get(validItem.id);
}

export function getItem(collectionName, id) {
  const collection = getCollection(collectionName);

  return collection.get(id) || null;
}

export function updateItem(
  collectionName,
  id,
  updates = {}
) {
  const collection = getCollection(collectionName);

  const existing = collection.get(id);

  if (!existing) {
    throw new Error(`Item not found: ${id}`);
  }

  const updated = {
    ...existing,
    ...updates,
    id,
    updatedAt: new Date().toISOString()
  };

  collection.set(id, updated);

  return updated;
}

export function deleteItem(collectionName, id) {
  const collection = getCollection(collectionName);

  if (!collection.has(id)) {
    throw new Error(`Item not found: ${id}`);
  }

  collection.delete(id);

  return {
    success: true,
    id
  };
}

export function listItems(
  collectionName,
  {
    limit = 50,
    status = null
  } = {}
) {
  const collection = getCollection(collectionName);

  let items = Array.from(collection.values());

  if (status) {
    items = items.filter(
      (item) => item.status === status
    );
  }

  return items.slice(0, limit);
}

export function countItems(collectionName) {
  const collection = getCollection(collectionName);

  return collection.size;
}

export function getCollectionNames() {
  return Object.keys(collections);
}

export function clearCollection(collectionName) {
  const collection = getCollection(collectionName);

  collection.clear();

  return {
    success: true,
    collection: collectionName
  };
}
