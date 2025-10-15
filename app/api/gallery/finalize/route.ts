import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

function assertIsAdmin() { return true; }

export async function POST(req: Request) {
  if (!assertIsAdmin()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { path, url, width, height, bytes, mime, alt = "", title = "" } = await req.json();
  if (!path || !url || !width || !height || !bytes || !mime) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  // Opcional: fija cache-control en el objeto para pagar menos egress
  // (Requiere supabase-js >= 2.43: uploadToSignedUrl acepta cacheControl;
  // si no lo pasaste en la subida, puedes hacer un HEAD/metadata update cuando esté disponible)

  const { data, error } = await supabaseAdmin
    .from("gallery")
    .insert({ path, url, width, height, bytes, mime, alt, title })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, image: data });
}
