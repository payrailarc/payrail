import { NextRequest, NextResponse } from "next/server";
import { IRIS_API_BASE } from "@/lib/cctp";

export const dynamic = "force-dynamic";

const ALLOWED = [/^v2\/messages\/\d+$/, /^v2\/burn\/USDC\/fees\/\d+\/\d+$/];

/** Same-origin relay for Circle's Iris API, so wallets' in-app browsers never hit it cross-origin. */
export async function GET(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  const joined = path.join("/");
  if (!ALLOWED.some((pattern) => pattern.test(joined))) {
    return NextResponse.json({ error: "unsupported Iris path" }, { status: 404 });
  }
  const upstream = new URL(`${IRIS_API_BASE}/${joined}`);
  const txHash = request.nextUrl.searchParams.get("transactionHash");
  if (txHash) upstream.searchParams.set("transactionHash", txHash);

  const res = await fetch(upstream, {
    headers: { accept: "application/json" },
    cache: "no-store",
  });
  return relay(res);
}

const ALLOWED_POST = [/^v2\/reattest\/0x[0-9a-fA-F]{64}$/];

export async function POST(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  const joined = path.join("/");
  if (!ALLOWED_POST.some((pattern) => pattern.test(joined))) {
    return NextResponse.json({ error: "unsupported Iris path" }, { status: 404 });
  }
  const res = await fetch(`${IRIS_API_BASE}/${joined}`, {
    method: "POST",
    headers: { accept: "application/json" },
    cache: "no-store",
  });
  return relay(res);
}

async function relay(res: Response) {
  const body = await res.text();
  return new NextResponse(body, {
    status: res.status,
    headers: {
      "content-type": res.headers.get("content-type") ?? "application/json",
      "cache-control": "no-store",
    },
  });
}
