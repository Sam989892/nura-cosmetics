import { NextRequest, NextResponse } from "next/server";
import { products } from "@/data/products";

// GET /api/products
// Optional query params: ?category=lips|nails|face|eyes  ?tryOn=lipstick|blush|...
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const category = searchParams.get("category");
  const tryOn    = searchParams.get("tryOn");

  let filtered = products;
  if (category) filtered = filtered.filter(p => p.category === category);
  if (tryOn)    filtered = filtered.filter(p => p.tryOn    === tryOn);

  return NextResponse.json(
    { products: filtered, total: filtered.length },
    {
      headers: {
        "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
        "Content-Type":  "application/json",
      },
    }
  );
}
