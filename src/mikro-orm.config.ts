import { __prod__ } from "./constants";
import { Post } from "./entities/Post";
import { MikroORM } from '@mikro-orm/core';
import path from 'path';

const mikroOrmConfig = {
  entities: [Post],
  type: 'postgresql',
  dbName: 'lidit',
  user: 'postgres',
  password: 'root',
  debug: !__prod__,
  migrations: {
    path: path.join(__dirname, './migrations'), // path to the folder with migrations
    pattern: /^[\w-]+\d+\.[tj]s$/, // regex pattern for the migration files
  },
} as Parameters<typeof MikroORM.init>[0];

export default mikroOrmConfig;