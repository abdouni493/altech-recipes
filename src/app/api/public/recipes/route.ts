import { NextResponse } from "next/server";
import { getPublicRecipe, getPublicRecipes } from "@/lib/public-queries";

export const dynamic = "force-dynamic";

/** Public catalog API — only image, name and description of visible recipes. */
export async function GET(req: Request) {
  const id = new URL(req.url).searchParams.get("id");
  if (id) {
    const recipe = await getPublicRecipe(id);
    return recipe ? NextResponse.json(recipe) : NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  return NextResponse.json(await getPublicRecipes());
}
