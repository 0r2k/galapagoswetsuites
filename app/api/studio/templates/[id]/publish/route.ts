import { NextRequest } from "next/server";
import { publishHtml } from "@/lib/templates";
import { createClient } from "@supabase/supabase-js";

export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // no la expongas al frontend
);

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { html } = await req.json();
  if (!html) return new Response("Missing html", { status: 400 });
  
  const resolvedParams = await params;
  const { data, error } = await supabaseAdmin
    .from('email_templates')
    .update({ html_published: html })
    .eq('id', resolvedParams.id)
    .select()
    .single();
  if (error) throw error;
  

  return Response.json({ ok: true });
}
