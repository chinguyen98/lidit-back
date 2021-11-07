//import "reflect-metadata";
import { MikroORM } from "@mikro-orm/core";
import { ApolloServer } from "apollo-server-express";
import connectRedis from "connect-redis";
import cors from "cors";
import express from "express";
import session from "express-session";
import redis from "redis";
import { buildSchema } from "type-graphql";
import { COOKIE_NAME, __prod__ } from "./constants";
import mikroOrmConfig from "./mikro-orm.config";
import { PostResolver } from "./resolvers/post.resolver";
import { UserResolver } from "./resolvers/user.resolver";
import { MyContext } from "./types";

/* Var to session */
declare module "express-session" {
  export interface SessionData {
    userId: number;
  }
}

const main = async () => {
  const orm = await MikroORM.init(mikroOrmConfig);
  await orm.getMigrator().up();

  const app = express();

  const redisStore = connectRedis(session);
  const redisClient = redis.createClient();

  app.use(
    cors({
      origin: "http://localhost:3000",
      credentials: true,
    })
  );

  app.use(
    session({
      name: COOKIE_NAME,
      store: new redisStore({
        client: redisClient,
        disableTouch: true,
      }),
      cookie: {
        maxAge: 1000 * 60 * 60 * 24 * 365 * 10,
        httpOnly: true,
        secure: __prod__,
        sameSite: "lax",
      },
      saveUninitialized: false,
      secret: "ecec",
      resave: false,
    })
  );

  const apolloServer = new ApolloServer({
    schema: await buildSchema({
      resolvers: [PostResolver, UserResolver],
      validate: false,
    }),
    context: ({ req, res }): MyContext => ({ em: orm.em, req, res }),
  });
  await apolloServer.start();
  apolloServer.applyMiddleware({
    app,
    cors: {
      origin: false,
    },
  });

  app.get("/", (_, res) => {
    res.send("Hello World!");
  });

  app.listen(4000, () => {
    console.log(`Server is running at port 4000!`);
  });
};

main().catch((err) => {
  console.error({ err });
});
