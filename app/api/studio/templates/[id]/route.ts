import { getTemplate, updatePreviewData, deleteTemplate } from "@/lib/templates";
import { NextRequest } from "next/server";

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const { id } = await params;
  const item = await getTemplate(id);
  return Response.json({ item });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  // Permite actualizar sólo el preview_data si quieres
  const { id } = await params;
  const { preview_data } = await req.json();
  const item = await updatePreviewData(id, preview_data ?? null);
  return Response.json({ item });
}

export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { id } = await params;
    await deleteTemplate(id);
    return Response.json({ success: true });
  } catch (error) {
    return Response.json({ error: 'Failed to delete template' }, { status: 500 });
  }
}
