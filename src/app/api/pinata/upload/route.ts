import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST() {
  return NextResponse.json(
    {
      error: "Deprecated endpoint. Use POST /api/storage/upload.",
    },
    { status: 410 }
  );
}
