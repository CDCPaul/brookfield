import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';

import * as schema from './schema';

type Database = ReturnType<typeof drizzle<typeof schema>>;

let instance: Database | null = null;

function connect(): Database {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      'DATABASE_URL is not set. Copy the Neon connection string into .env.local.',
    );
  }
  return drizzle(neon(connectionString), { schema });
}

/**
 * The database client, connected on first use.
 *
 * Building evaluates every route module to read its configuration, so throwing
 * at module load would fail the build on any environment that does not expose
 * the connection string to the build step — even though nothing had tried to
 * run a query. Deferring means a missing variable surfaces at the point it
 * actually matters, with the same message.
 */
export const db = new Proxy({} as Database, {
  get(_target, property) {
    instance ??= connect();
    const value = Reflect.get(instance, property) as unknown;
    return typeof value === 'function' ? value.bind(instance) : value;
  },
});

export * from './schema';
