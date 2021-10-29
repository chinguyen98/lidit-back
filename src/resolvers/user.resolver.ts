import {
  Arg,
  Ctx,
  Field,
  InputType,
  Mutation,
  ObjectType,
  Query,
  Resolver,
} from "type-graphql";
import argon2 from "argon2";
import { MyContext } from "src/types";
import { User } from "../entities/User";
import { COOKIE_NAME } from "../constants";

@InputType()
class UsernamePasswordInput {
  @Field()
  username: string;

  @Field()
  password: string;
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
    @Arg("options", () => UsernamePasswordInput)
    { username, password }: UsernamePasswordInput,
    @Ctx() { em, req }: MyContext
  ): Promise<UserResponse> {
    const userRes = new UserResponse();
    const hashedPassword = await argon2.hash(password);
    const user = em.create(User, { username, password: hashedPassword });
    try {
      await em.persistAndFlush(user);
    } catch (err) {
      /* Duplicate username error! */
      if (err.code === "23505") {
        const err = new FieldError();
        err.field = "username";
        err.message = `username is already taken!`;

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
    @Arg("options", () => UsernamePasswordInput)
    { username, password }: UsernamePasswordInput,
    @Ctx() { em, req }: MyContext
  ): Promise<UserResponse> {
    const user = await em.findOne(User, { username });
    const userRes = new UserResponse();

    if (username.length <= 2) {
      const err = new FieldError();
      err.field = "username";
      err.message = `Length must be greater than 2!`;

      userRes.errors = [err];
      return userRes;
    }

    if (password.length <= 2) {
      const err = new FieldError();
      err.field = "password";
      err.message = `Length must be greater than 2!`;

      userRes.errors = [err];
      return userRes;
    }

    if (!user) {
      const err = new FieldError();
      err.field = "username";
      err.message = `Username ${username} does not exist!`;

      userRes.errors = [err];
      return userRes;
    }

    const isPasswordValid = await argon2.verify(user.password, password);
    if (!isPasswordValid) {
      const err = new FieldError();
      err.field = "password";
      err.message = `Inccorrect password!`;

      userRes.errors = [err];
      return userRes;
    }

    req.session.userId = user.id;

    userRes.user = user;
    return userRes;
  }

  @Query(() => UserResponse, { nullable: true })
  async profile(@Ctx() { req, em }: MyContext): Promise<UserResponse> {
    const userId = req.session.userId;
    const userRes = new UserResponse();

    if (userId) {
      const user = await em.findOne(User, { id: userId });
      if (!user) {
        const err = new FieldError();
        err.field = "id";
        err.message = `Invalid id!`;

        userRes.errors = [err];
      } else {
        userRes.user = user;
      }
    } else {
      const notAuthErr = new FieldError();
      notAuthErr.field = "user";
      notAuthErr.message = "User is not log in!";

      userRes.errors = [notAuthErr];
    }

    console.log({ userRes });
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
}
