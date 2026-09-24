import { NextResponse } from "next/server";
import { getAnalysisMode } from "@/lib/server-config";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ mode: getAnalysisMode() }, { headers: { "Cache-Control": "no-store" } });
}
