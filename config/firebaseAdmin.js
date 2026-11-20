import admin from "firebase-admin";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";

dotenv.config();

let dbInstance = null;
let isRealFirestore = false;

// Initialize Firebase Admin if configuration is provided
try {
  let credential = null;

  if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
    credential = admin.credential.cert(serviceAccount);
  } else if (process.env.FIREBASE_SERVICE_ACCOUNT_PATH && fs.existsSync(process.env.FIREBASE_SERVICE_ACCOUNT_PATH)) {
    const serviceAccount = JSON.parse(fs.readFileSync(process.env.FIREBASE_SERVICE_ACCOUNT_PATH, "utf8"));
    credential = admin.credential.cert(serviceAccount);
  } else if (process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
    credential = admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
    });
  } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS && fs.existsSync(process.env.GOOGLE_APPLICATION_CREDENTIALS)) {
    credential = admin.credential.applicationDefault();
  }

  if (credential && !admin.apps.length) {
    admin.initializeApp({
      credential,
      projectId: process.env.FIREBASE_PROJECT_ID,
    });
    dbInstance = admin.firestore();
    isRealFirestore = true;
    console.log(" Connected to Firebase Cloud Firestore successfully.");
  }
} catch (err) {
  console.warn("⚠️ Firebase Admin initialization failed or credentials not set. Falling back to local Firestore-compatible store:", err.message);
}

// If no real Firestore instance, use a robust, persistent Firestore-compatible store
if (!dbInstance) {
  const DATA_DIR = path.resolve(process.cwd(), ".data");
  const DB_FILE = path.join(DATA_DIR, "firestore_db.json");

  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  const loadData = () => {
    try {
      if (fs.existsSync(DB_FILE)) {
        return JSON.parse(fs.readFileSync(DB_FILE, "utf8"));
      }
    } catch {
      // fallback
    }
    return { users: {}, monitors: {}, checks: {}, incidents: {} };
  };

  const saveData = (data) => {
    try {
      fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), "utf8");
    } catch (err) {
      console.error("Error persisting firestore_db.json:", err.message);
    }
  };

  class LocalQuery {
    constructor(collectionName, filters = [], orderByClause = null, limitCount = null) {
      this.collectionName = collectionName;
      this.filters = filters;
      this.orderByClause = orderByClause;
      this.limitCount = limitCount;
    }

    where(field, op, value) {
      return new LocalQuery(
        this.collectionName,
        [...this.filters, { field, op, value }],
        this.orderByClause,
        this.limitCount
      );
    }

    orderBy(field, direction = "asc") {
      return new LocalQuery(
        this.collectionName,
        this.filters,
        { field, direction },
        this.limitCount
      );
    }

    limit(n) {
      return new LocalQuery(
        this.collectionName,
        this.filters,
        this.orderByClause,
        n
      );
    }

    async get() {
      const db = loadData();
      const col = db[this.collectionName] || {};
      let items = Object.entries(col).map(([id, data]) => ({ id, ...data }));

      // Apply where filters
      for (const filter of this.filters) {
        items = items.filter((item) => {
          const val = item[filter.field];
          if (filter.op === "==") return val === filter.value;
          if (filter.op === "!=") return val !== filter.value;
          if (filter.op === "<=") return val !== null && val !== undefined && new Date(val).getTime() <= new Date(filter.value).getTime();
          if (filter.op === ">=") return val !== null && val !== undefined && new Date(val).getTime() >= new Date(filter.value).getTime();
          if (filter.op === "<") return val !== null && val !== undefined && new Date(val).getTime() < new Date(filter.value).getTime();
          if (filter.op === ">") return val !== null && val !== undefined && new Date(val).getTime() > new Date(filter.value).getTime();
          if (filter.op === "in") return Array.isArray(filter.value) && filter.value.includes(val);
          return true;
        });
      }

      // Apply orderBy
      if (this.orderByClause) {
        const { field, direction } = this.orderByClause;
        items.sort((a, b) => {
          let valA = a[field];
          let valB = b[field];
          if (valA instanceof Date || (typeof valA === "string" && !isNaN(Date.parse(valA)))) {
            valA = new Date(valA).getTime();
          }
          if (valB instanceof Date || (typeof valB === "string" && !isNaN(Date.parse(valB)))) {
            valB = new Date(valB).getTime();
          }
          if (valA === undefined || valA === null) return 1;
          if (valB === undefined || valB === null) return -1;
          if (valA < valB) return direction === "asc" ? -1 : 1;
          if (valA > valB) return direction === "asc" ? 1 : -1;
          return 0;
        });
      }

      // Apply limit
      if (typeof this.limitCount === "number" && this.limitCount > 0) {
        items = items.slice(0, this.limitCount);
      }

      const docs = items.map((item) => ({
        id: item.id,
        exists: true,
        data: () => ({ ...item }),
      }));

      return {
        empty: docs.length === 0,
        size: docs.length,
        docs,
        forEach: (fn) => docs.forEach(fn),
      };
    }
  }

  class LocalDocumentReference {
    constructor(collectionName, docId) {
      this.collectionName = collectionName;
      this.id = docId;
    }

    async get() {
      const db = loadData();
      const col = db[this.collectionName] || {};
      const data = col[this.id];
      return {
        id: this.id,
        exists: !!data,
        data: () => (data ? { id: this.id, ...data } : undefined),
      };
    }

    async set(data, options = {}) {
      const db = loadData();
      if (!db[this.collectionName]) db[this.collectionName] = {};

      const existing = options.merge ? db[this.collectionName][this.id] || {} : {};
      db[this.collectionName][this.id] = {
        ...existing,
        ...data,
        id: this.id,
        updatedAt: new Date().toISOString(),
      };
      saveData(db);
      return { id: this.id };
    }

    async update(updates) {
      const db = loadData();
      if (!db[this.collectionName] || !db[this.collectionName][this.id]) {
        throw new Error(`Document ${this.id} not found in ${this.collectionName}`);
      }
      db[this.collectionName][this.id] = {
        ...db[this.collectionName][this.id],
        ...updates,
        updatedAt: new Date().toISOString(),
      };
      saveData(db);
      return { id: this.id };
    }

    async delete() {
      const db = loadData();
      if (db[this.collectionName] && db[this.collectionName][this.id]) {
        delete db[this.collectionName][this.id];
        saveData(db);
      }
      return { id: this.id };
    }
  }

  class LocalCollectionReference extends LocalQuery {
    constructor(collectionName) {
      super(collectionName);
    }

    doc(id) {
      const docId = id || Math.random().toString(36).substring(2, 12);
      return new LocalDocumentReference(this.collectionName, docId);
    }

    async add(data) {
      const docId = Math.random().toString(36).substring(2, 12);
      const docRef = this.doc(docId);
      await docRef.set(data);
      return docRef;
    }
  }

  class LocalWriteBatch {
    constructor() {
      this.operations = [];
    }

    set(docRef, data, options = {}) {
      this.operations.push({ type: "set", docRef, data, options });
      return this;
    }

    update(docRef, updates) {
      this.operations.push({ type: "update", docRef, updates });
      return this;
    }

    delete(docRef) {
      this.operations.push({ type: "delete", docRef });
      return this;
    }

    async commit() {
      const db = loadData();
      for (const op of this.operations) {
        const col = op.docRef.collectionName;
        const id = op.docRef.id;
        if (!db[col]) db[col] = {};

        if (op.type === "set") {
          const existing = op.options?.merge ? db[col][id] || {} : {};
          db[col][id] = {
            ...existing,
            ...op.data,
            id,
            updatedAt: new Date().toISOString(),
          };
        } else if (op.type === "update") {
          if (db[col][id]) {
            db[col][id] = {
              ...db[col][id],
              ...op.updates,
              updatedAt: new Date().toISOString(),
            };
          }
        } else if (op.type === "delete") {
          if (db[col] && db[col][id]) {
            delete db[col][id];
          }
        }
      }
      saveData(db);
    }
  }

  dbInstance = {
    collection: (name) => new LocalCollectionReference(name),
    batch: () => new LocalWriteBatch(),
  };
  console.log(" Initialized Local Firestore adapter (data stored in .data/firestore_db.json).");
}

export const db = dbInstance;
export const isUsingRealFirestore = () => isRealFirestore;
export const getAdminAuth = () => {
  if (admin.apps && admin.apps.length > 0) {
    return admin.auth();
  }
  return null;
};
export default db;
