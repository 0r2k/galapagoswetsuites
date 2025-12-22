import { NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const { design, html } = await req.json();
  if (!html) return new Response("Missing html", { status: 400 });

  const { error } = await supabaseAdmin
    .from('email_templates')
    .update({ html: html, design: { ...(design ?? {}), _draftHtml: html ?? null } })
    .eq('id', params.id);
  if (error) throw error;
  

  return Response.json({ ok: true });
}
