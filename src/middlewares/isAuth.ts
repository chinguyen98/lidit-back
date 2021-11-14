import { MyContext } from 'src/types';
import { MiddlewareFn } from 'type-graphql';

export const isAuth: MiddlewareFn<MyContext> = ({ context: { req } }, next) => {
  if (!req.session.userId) {
    throw Error('Not authenticated!');
  }

  return next();
};
