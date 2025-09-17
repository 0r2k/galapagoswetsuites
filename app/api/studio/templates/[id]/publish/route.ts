import { NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { mjml } = await req.json();
  if (!mjml) return new Response("Missing mjml", { status: 400 });
  
  const resolvedParams = await params;
  const { data, error } = await supabaseAdmin
    .from('email_templates')
    .update({ html_published: mjml })
    .eq('id', resolvedParams.id)
    .select()
    .single();
  if (error) throw error;
  

  return Response.json({ ok: true });
}
