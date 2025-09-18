export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest } from "next/server";
import { getTemplate } from "@/lib/templates";
import Handlebars from "handlebars";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY!);
const FROM = process.env.RESEND_FROM!;

// Registrar helpers personalizados de Handlebars
Handlebars.registerHelper('strContains', function(str: string, substring: string) {
  return str && str.toString().includes(substring);
});

Handlebars.registerHelper('eq', function(a: any, b: any) {
  return a === b;
});

Handlebars.registerHelper('ne', function(a: any, b: any) {
  return a !== b;
});

Handlebars.registerHelper('gt', function(a: any, b: any) {
  return a > b;
});

Handlebars.registerHelper('lt', function(a: any, b: any) {
  return a < b;
});

const toGlobalData = (vars: Record<string, any>) => ({
  globalData: Object.fromEntries(
    Object.entries(vars).map(([k, v]) => [k, { data: v }])
  ),
});

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { to, subject, vars } = await req.json();
    const { id } = await params;

    if (!to) return new Response("Missing 'to'", { status: 400 });

    const { default: mjml2html } = await import('mjml');

    const tpl = await getTemplate(id);
    if (!tpl.html_published) {
      return new Response("Plantilla no publicada aún", { status: 400 });
    }

    let variables: any = {};
    try { variables = typeof vars === "string" ? JSON.parse(vars) : (vars ?? {}); }
    catch { return new Response("Invalid JSON in 'vars'", { status: 400 }); }

    // Compilar MJML a HTML primero
    let mjmlTemplate = tpl.html_published;
    
    // Si el contenido parece ser MJML, compilarlo a HTML
    if (mjmlTemplate.trim().startsWith('<mjml>')) {
      const { html: compiled, errors } = mjml2html(mjmlTemplate, {
        minify: false,
        validationLevel: 'soft',
      });
      if (errors?.length) {
        const msg = errors.map((e: any) => e.message || e.formattedMessage).join('\n');
        return new Response(`MJML errors:\n${msg}`, { status: 400 });
      }
      mjmlTemplate = compiled;
    }
    
    // Ahora procesar con Handlebars
    // const html = Handlebars.compile(mjmlTemplate)(variables);
    // const finalHtml = Handlebars.compile(mjmlTemplate)(toGlobalData(variables));
    const finalHtml = Handlebars.compile(mjmlTemplate)(variables);

    const s = subject || `Prueba: ${tpl.name}`;
    const { error } = await resend.emails.send({
      from: FROM,
      to,
      subject: s,
      html: finalHtml,
    });

    if (error) return new Response(`Resend error: ${error?.message ?? error}`, { status: 500 });
    return Response.json({ ok: true });
  } catch (generalError: any) {
    console.error('Send test error:', generalError);
    return new Response(`Server error: ${generalError.message}`, { status: 500 });
  }
}
