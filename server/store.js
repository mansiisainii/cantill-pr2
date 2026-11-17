import crypto from 'node:crypto';

const withoutMongoId = (d) => {
  if (!d) return d;
  const { _id, ...rest } = d;
  return rest;
};

export function memoryStore() {
  const tables = new Map();
  const table = (name) => {
    if (!tables.has(name)) tables.set(name, []);
    return tables.get(name);
  };
  return {
    kind: 'memory',
    async all(name) {
      return structuredClone(table(name));
    },
    async get(name, id) {
      return structuredClone(table(name).find((d) => d.id === id) || null);
    },
    async replace(name, docs) {
      tables.set(name, structuredClone(docs));
    },
    async insert(name, doc) {
      const d = { id: crypto.randomUUID(), ...structuredClone(doc) };
      table(name).push(d);
      return structuredClone(d);
    },
    async update(name, id, patch) {
      const d = table(name).find((x) => x.id === id);
      if (d) Object.assign(d, structuredClone(patch));
      return structuredClone(d || null);
    },
    async count(name) {
      return table(name).length;
    },
  };
}

export async function mongoStore(uri) {
  const { default: mongoose } = await import('mongoose');
  await mongoose.connect(uri);
  const col = (name) => mongoose.connection.collection(name);
  return {
    kind: 'mongodb',
    async all(name) {
      return (await col(name).find({}).toArray()).map(withoutMongoId);
    },
    async get(name, id) {
      return withoutMongoId(await col(name).findOne({ id }));
    },
    async replace(name, docs) {
      await col(name).deleteMany({});
      if (docs.length) await col(name).insertMany(docs.map((d) => ({ ...d })));
    },
    async insert(name, doc) {
      const d = { id: crypto.randomUUID(), ...doc };
      await col(name).insertOne({ ...d });
      return d;
    },
    async update(name, id, patch) {
      await col(name).updateOne({ id }, { $set: patch });
      return withoutMongoId(await col(name).findOne({ id }));
    },
    async count(name) {
      return col(name).countDocuments();
    },
  };
}