import "reflect-metadata";
import { ApolloServer } from 'apollo-server-express';
import connectRedis from 'connect-redis';
import cors from 'cors';
import express from 'express';
import session from 'express-session';
import redis from 'ioredis';
import { buildSchema } from 'type-graphql';
import { createConnection } from 'typeorm';
import { COOKIE_NAME, __prod__ } from './constants';
import { Post } from './entities/Post';
import { User } from './entities/User';
import { PostResolver } from './resolvers/post.resolver';
import { UserResolver } from './resolvers/user.resolver';
import { MyContext } from './types';

/* Var to session */
declare module 'express-session' {
  export interface SessionData {
    userId: number;
  }
}

const main = async () => {
  createConnection({
    type: 'postgres',
    database: 'lidit2',
    username: 'postgres',
    password: 'root',
    synchronize: true,
    logging: true,
    entities: [Post, User],
  });

  const app = express();

  const redisStore = connectRedis(session);
  const redisClient = new redis();

  app.use(
    cors({
      origin: 'http://localhost:3000',
      credentials: true,
    })
  );

  app.use(
    session({
      name: COOKIE_NAME,
      store: new redisStore({
        client: redisClient as any,
        disableTouch: true,
      }),
      cookie: {
        maxAge: 1000 * 60 * 60 * 24 * 365 * 10,
        httpOnly: true,
        secure: __prod__,
        sameSite: 'lax',
      },
      saveUninitialized: false,
      secret: 'ecec',
      resave: false,
    })
  );

  const apolloServer = new ApolloServer({
    schema: await buildSchema({
      resolvers: [PostResolver, UserResolver],
      validate: false,
    }),
    context: ({ req, res }): MyContext => ({
      req,
      res,
      redisClient,
    }),
  });
  await apolloServer.start();
  apolloServer.applyMiddleware({
    app,
    cors: {
      origin: false,
    },
  });

  app.get('/', (_, res) => {
    res.send('Hello World!');
  });

  app.listen(4000, () => {
    console.log(`Server is running at port 4000!`);
  });
};

main().catch((err) => {
  console.error({ err });
});
