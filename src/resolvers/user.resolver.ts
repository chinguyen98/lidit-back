import argon2 from 'argon2';
import { MyContext } from 'src/types';
import { sendEmail } from '../utils/sendEmail';
import { Arg, Ctx, Field, InputType, Mutation, ObjectType, Query, Resolver } from 'type-graphql';
import { v4 as uuid } from 'uuid';
import { COOKIE_NAME, FORGET_PASSWORD_PREFIX } from '../constants';
import { User } from '../entities/User';
import { getConnection } from 'typeorm';

@InputType()
class UsernamePasswordInput {
  @Field()
  username: string;

  @Field()
  password: string;

  @Field()
  email: string;
}

@ObjectType()
class FieldError {
  @Field()
  field: string;

  @Field()
  message: string;
}

@ObjectType()
class UserResponse {
  @Field(() => [FieldError], { nullable: true })
  errors?: FieldError[];

  @Field(() => User, { nullable: true })
  user?: User;
}

@Resolver()
export class UserResolver {
  @Mutation(() => UserResponse)
  async register(
    @Arg('options', () => UsernamePasswordInput)
    { username, password, email }: UsernamePasswordInput,
    @Ctx() { req }: MyContext
  ): Promise<UserResponse> {
    const userRes = new UserResponse();
    const hashedPassword = await argon2.hash(password);
    let user;
    try {
      const result = await getConnection()
        .createQueryBuilder()
        .insert()
        .into(User)
        .values([{ email, username, password: hashedPassword }])
        .returning('*')
        .execute();
      user = result.raw[0];
    } catch (error) {
      if (error.code === '23505') {
        const err = new FieldError();
        err.field = 'usernameoremail';
        err.message = `Username or email already exist!`;

        userRes.errors = [err];
        return userRes;
      }
    }

    userRes.user = user;
    req.session.userId = user.id;

    return userRes;
  }

  @Mutation(() => UserResponse)
  async login(
    @Arg('usernameOrEmail', () => String) usernameOrEmail: string,
    @Arg('password', () => String) password: string,
    @Ctx() { req }: MyContext
  ): Promise<UserResponse> {
    const user = await User.findOne({
      where: usernameOrEmail.includes('@')
        ? { email: usernameOrEmail }
        : { username: usernameOrEmail },
    });
    const userRes = new UserResponse();

    if (usernameOrEmail.length <= 2) {
      const err = new FieldError();
      err.field = 'usernameOrEmail';
      err.message = `Length must be greater than 2!`;

      userRes.errors = [err];
      return userRes;
    }

    if (password.length <= 2) {
      const err = new FieldError();
      err.field = 'password';
      err.message = `Length must be greater than 2!`;

      userRes.errors = [err];
      return userRes;
    }

    if (!user) {
      const err = new FieldError();
      err.field = 'username';
      err.message = `This username or email does not exist!`;

      userRes.errors = [err];
      return userRes;
    }

    const isPasswordValid = await argon2.verify(user.password, password);
    if (!isPasswordValid) {
      const err = new FieldError();
      err.field = 'password';
      err.message = `Inccorrect password!`;

      userRes.errors = [err];
      return userRes;
    }

    req.session.userId = user.id;

    userRes.user = user;
    return userRes;
  }

  @Query(() => UserResponse, { nullable: true })
  async profile(@Ctx() { req }: MyContext): Promise<UserResponse> {
    const userId = req.session.userId;
    const userRes = new UserResponse();

    if (userId) {
      const user = await User.findOne(userId);
      if (!user) {
        const err = new FieldError();
        err.field = 'id';
        err.message = `Invalid id!`;

        userRes.errors = [err];
      } else {
        userRes.user = user;
      }
    } else {
      const notAuthErr = new FieldError();
      notAuthErr.field = 'user';
      notAuthErr.message = 'User is not log in!';

      userRes.errors = [notAuthErr];
    }

    console.log({ user: userRes.user });
    return userRes;
  }

  @Mutation(() => Boolean)
  async logout(@Ctx() { req, res }: MyContext) {
    return new Promise((resolve) =>
      req.session.destroy((err) => {
        res.clearCookie(COOKIE_NAME);
        if (err) {
          resolve(false);
          return;
        }
        resolve(true);
      })
    );
  }

  @Mutation(() => UserResponse)
  async changePassword(
    @Arg('newPassword', () => String) newPassword: string,
    @Arg('token', () => String) token: string,
    @Ctx() { redisClient, req }: MyContext
  ): Promise<UserResponse> {
    const redisKey = `${FORGET_PASSWORD_PREFIX}${token}`;
    const userId = await redisClient.get(redisKey);

    if (!userId) {
      return {
        errors: [{ field: 'token', message: 'Invalid token!' }],
      };
    }

    const userIdNum = parseInt(userId);
    const user = await User.findOne(userIdNum);
    if (!user) {
      return {
        errors: [{ field: 'token', message: 'User is not exists!' }],
      };
    }

    User.update({ id: userIdNum }, { password: await argon2.hash(newPassword) });

    await redisClient.del(redisKey);

    /* Login user after change password! */
    req.session.userId = user.id;

    return { user };
  }

  @Mutation(() => Boolean)
  async forgotPassword(
    @Arg('email', () => String) email: string,
    @Ctx() { redisClient }: MyContext
  ): Promise<Boolean> {
    const user = await User.findOne({ where: { email } });
    if (user) {
      const token = uuid();
      await redisClient.set(
        `${FORGET_PASSWORD_PREFIX}${token}`,
        user.id,
        'ex',
        1000 * 60 * 60 * 24 * 3
      );

      const link = `<a href="http://localhost:3000/change-password/${token}">Reset password!</a>`;

      await sendEmail(email, link);
    }
    return true;
  }
}
