import { Context } from "https://deno.land/x/oak@v17.1.4/mod.ts";
import { create, getNumericDate } from "https://deno.land/x/djwt@v3.0.2/mod.ts";
import { UserSchema } from "../models/User.ts";
import { importKeyFromEnv } from "../utils/key.ts";
import { SignInBody, SignUpBody } from "../types/index.d.ts";
import { ObjectId } from "https://deno.land/x/mongo@v0.34.0/mod.ts";
import { deps } from "../deps.ts";

/**
 * JWT secret key from the env file
 * @author Sriram Sundar
 *
 *
 * @type {CryptoKey}
 */
const JWT_KEY: CryptoKey = await importKeyFromEnv();

/**
 * Handles user registration.
 * Manually hashes the password and inserts the user into MongoDB.
 * Returns a JWT in an httpOnly cookie.
 * @author Sriram Sundar
 *
 * @async
 * @param {Context} ctx - Oak context.
 * @returns {Promise<void>}
 */
const signUp = async (ctx: Context): Promise<void> => {
  try {
    if (!ctx.request.hasBody) {
      ctx.response.status = 400;
      ctx.response.body = { error: "No body provided" };
      return;
    }

    const data: SignUpBody = await ctx.request.body.json();
    const { email, firstName, lastName, password } = data;

    if (!email || !password) {
      ctx.response.status = 400;
      ctx.response.body = { error: "Email and password required" };
      return;
    }

    const existingUser: UserSchema | undefined = await deps.findUserByEmail(
      email
    );
    if (existingUser) {
      ctx.response.status = 400;
      ctx.response.body = { error: "Email already in use" };
      return;
    }

    if (!firstName || !lastName) {
      ctx.response.status = 400;
      ctx.response.body = { error: "First name and last name required" };
      return;
    }

    const insertId: ObjectId = await deps.insertUser({
      email,
      password,
      firstName,
      lastName,
      avatar: "",
      theme: 0,
      configuredProfile: false,
    });

    const token: string = await create(
      { alg: "HS512", typ: "JWT" },
      { id: insertId.toString(), exp: getNumericDate(60 * 60 * 24) },
      JWT_KEY
    );

    await ctx.cookies.set("jwt", token, { httpOnly: true, ignoreInsecure: true, secure: true, sameSite: "none"  }); //, secure: true, sameSite: "none"

    ctx.response.status = 201;
    ctx.response.body = {
      user: {
        id: insertId.toString(),
        email,
        firstName,
        lastName,
        avatar: "",
        theme: 0,
        configuredProfile: false,
      },
    };
  } catch (error) {
    console.error("Error in signUp:", error);
    ctx.response.status = 500;
    ctx.response.body = { error: "Internal Server Error" };
  }
};

/**
 * Handles user login.
 * Verifies credentials and sets a JWT cookie.
 * @author Sriram Sundar
 *
 * @async
 * @param {Context} ctx - Oak context.
 * @returns {Promise<void>}
 */
const signIn = async (ctx: Context): Promise<void> => {
  try {
    if (!ctx.request.hasBody) {
      ctx.response.status = 400;
      ctx.response.body = { error: "No body provided" };
      return;
    }

    const data: SignInBody = await ctx.request.body.json();
    const { email, password } = data;

    if (!email || !password) {
      ctx.response.status = 400;
      ctx.response.body = { error: "Email and password required" };
      return;
    }

    const user: UserSchema | undefined = await deps.findUserByEmail(email);
    if (!user) {
      ctx.response.status = 400;
      ctx.response.body = { error: "Email not found" };
      return;
    }

    const validPassword: boolean = await deps.compare(password, user.password);
    if (!validPassword) {
      ctx.response.status = 400;
      ctx.response.body = { error: "Incorrect password" };
      return;
    }

    const token: string = await create(
      { alg: "HS512", typ: "JWT" },
      { id: user._id.toString(), exp: getNumericDate(60 * 60 * 24) },
      JWT_KEY
    );

    await ctx.cookies.set("jwt", token, { httpOnly: true, ignoreInsecure: true, secure: true, sameSite: "none" }); //, secure: true, sameSite: "none"

    ctx.response.status = 200;
    ctx.response.body = {
      user: {
        id: user._id.toString(),
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        avatar: user.avatar,
        theme: user.theme,
        configuredProfile: user.configuredProfile,
      },
    };
  } catch (error) {
    console.error("Error during signIn:", error);
    ctx.response.status = 500;
    ctx.response.body = { error: "Internal Server Error" };
  }
};

/**
 * Retrieves authenticated user information.
 * Assumes a JWT middleware has set ctx.state.userId.
 * @author Sriram Sundar
 *
 * @async
 * @param {Context} ctx - Oak context.
 * @returns {Promise<void>}
 */
const fetchUserInfo = async (ctx: Context): Promise<void> => {
  try {
    const userId: string = ctx.state.userId;
    if (!userId) {
      ctx.response.status = 401;
      ctx.response.body = { error: "User not authenticated" };
      return;
    }

    const user: UserSchema | undefined = await deps.findUserById(userId);
    if (!user) {
      ctx.response.status = 404;
      ctx.response.body = { error: "User not found" };
      return;
    }

    ctx.response.status = 200;
    ctx.response.body = {
      user: {
        id: user._id.toString(),
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        avatar: user.avatar,
        theme: user.theme,
        configuredProfile: user.configuredProfile,
      },
    };
  } catch (error) {
    console.error("Error fetching user info:", error);
    ctx.response.status = 500;
    ctx.response.body = { error: "Internal Server Error" };
  }
};

/**
 * Handles user sign out by clearing the JWT cookie.
 * @author Sriram Sundar
 *
 * @async
 * @param {Context} ctx - Oak context.
 * @returns {Promise<void>}
 */
const signOut = async (ctx: Context): Promise<void> => {
  try {
    await ctx.cookies.delete("jwt");
    ctx.response.status = 200;
    ctx.response.body = { message: "Sign out successful" };
  } catch (error) {
    console.error("Error during signOut:", error);
    ctx.response.status = 500;
    ctx.response.body = { error: "Internal Server Error" };
  }
};

export { signUp, signIn, fetchUserInfo, signOut };
