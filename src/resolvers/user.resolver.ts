import { Arg, Ctx, Field, InputType, Mutation, ObjectType, Resolver } from "type-graphql";
import argon2 from 'argon2';
import { MyContext } from "src/types";
import { User } from "../entities/User";

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
    @Arg('options', () => UsernamePasswordInput) { username, password }: UsernamePasswordInput,
    @Ctx() { em }: MyContext,
  ): Promise<UserResponse> {
    const userRes = new UserResponse();
    const hashedPassword = await argon2.hash(password);
    const user = em.create(User, { username, password: hashedPassword });
    try {
      await em.persistAndFlush(user);
    } catch (err) {
      /* Duplicate username error! */
      if (err.code === '23505') {
        const err = new FieldError();
        err.field = 'username';
        err.message = `username is already taken!`;

        userRes.errors = [err];
        return userRes;
      }
    }
    userRes.user = user;
    return userRes;
  }

  @Mutation(() => UserResponse)
  async login(
    @Arg('options', () => UsernamePasswordInput) { username, password }: UsernamePasswordInput,
    @Ctx() { em }: MyContext,
  ): Promise<UserResponse> {
    const user = await em.findOne(User, { username });
    const userRes = new UserResponse();

    if (username.length <= 2) {
      const err = new FieldError();
      err.field = 'username';
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
      err.message = `Username ${username} does not exist!`;

      userRes.errors = [err];
      return userRes;
    }

    const isPasswordValid = await argon2.verify(user.password, password);
    if (!isPasswordValid) {
      const err = new FieldError();
      err.field = 'password';
      err.message = `Password does not match!`;

      userRes.errors = [err];
      return userRes;
    }

    userRes.user = user;
    return userRes;
  }
}