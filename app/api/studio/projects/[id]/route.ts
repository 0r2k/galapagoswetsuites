import { getTemplate, upsertProject } from "@/lib/templates";
import { NextRequest } from "next/server";

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const { id } = await params;
  const row = await getTemplate(id);
  // Studio SDK espera { project: ... } o { project: null }
  return Response.json({ project: row.project ?? null });
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const { id } = await params;
  const { project } = await req.json();
  const row = await upsertProject(id, project);
  return Response.json({ ok: true, project: row.project });
}
