import { existsSync } from "node:fs";
import { join } from "node:path";
import { menuData } from "../data/menu.ts";
import { buildMenu } from "./menu-core.ts";

export { buildMenu, slugify } from "./menu-core.ts";

/** The validated menu for the site. Runs at build time, so a broken menu fails the build. */
export const getMenu = () =>
  buildMenu(menuData, { imageExists: (path) => existsSync(join(process.cwd(), "public", path)) });
