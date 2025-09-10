import { NextRequest } from "next/server";
import { publishHtml } from "@/lib/templates";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const { html } = await req.json();
  if (!html) return new Response("Missing html", { status: 400 });
  await publishHtml(params.id, html);
  return Response.json({ ok: true });
}
