import { NextRequest } from "next/server";
import { createTemplate, listTemplates } from "@/lib/templates";

export async function GET() {
  const data = await listTemplates();
  return Response.json({ items: data });
}

export async function POST(req: NextRequest) {
  const { name, preview_data, template_type, recipient_emails } = await req.json();
  if (!name) return new Response("Missing name", { status: 400 });
  const row = await createTemplate(
    name, 
    preview_data ?? null, 
    template_type ?? null, 
    recipient_emails ?? null
  );
  return Response.json({ item: row });
}
