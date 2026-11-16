/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as agent from "../agent.js";
import type * as assets from "../assets.js";
import type * as clay from "../clay.js";
import type * as designs from "../designs.js";
import type * as feedback from "../feedback.js";
import type * as lib from "../lib.js";
import type * as memory from "../memory.js";
import type * as models from "../models.js";
import type * as projects from "../projects.js";
import type * as style from "../style.js";
import type * as suggestions from "../suggestions.js";
import type * as workspaces from "../workspaces.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  agent: typeof agent;
  assets: typeof assets;
  clay: typeof clay;
  designs: typeof designs;
  feedback: typeof feedback;
  lib: typeof lib;
  memory: typeof memory;
  models: typeof models;
  projects: typeof projects;
  style: typeof style;
  suggestions: typeof suggestions;
  workspaces: typeof workspaces;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
