import { cache } from "react";
import { connection } from "next/server";
import { getMenuData } from "./content-store.ts";
import { buildMenu } from "./menu-core.ts";

export { buildMenu, publicMenu, slugify } from "./menu-core.ts";

/** Read the current published menu once per render, without caching it between requests. */
export const getMenu = cache(async () => {
  await connection();
  return buildMenu(await getMenuData());
});
