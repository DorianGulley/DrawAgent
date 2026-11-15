import { anyApi } from "convex/server";
import type { api as generatedApi } from "../convex/_generated/api";

export const api = anyApi as unknown as typeof generatedApi;
