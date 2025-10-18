import { NextRequest } from "next/server";
import { getTemplate } from "@/lib/templates";
import * as cheerio from "cheerio";
import Handlebars from "handlebars";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY!);
const FROM = process.env.RESEND_FROM!;

const norm = (s: any) =>
  (s ?? "")
    .toString()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();

Handlebars.registerHelper('strContains', (str: any, substr: any) =>
  norm(str).includes(norm(substr))
);

Handlebars.registerHelper('and', function (...args: any[]) {
  return args.slice(0, -1).every(Boolean);
});

Handlebars.registerHelper('or', function (...args: any[]) {
  return args.slice(0, -1).some(Boolean);
});

Handlebars.registerHelper('eq', (a: any, b: any) => a === b);
Handlebars.registerHelper('ne', (a: any, b: any) => a !== b);
Handlebars.registerHelper('gt', (a: any, b: any) => Number(a) > Number(b));
Handlebars.registerHelper('lt', (a: any, b: any) => Number(a) < Number(b));

// const toGlobalData = (vars: Record<string, any>) => ({
//   globalData: Object.fromEntries(
//     Object.entries(vars).map(([k, v]) => [k, { data: v }])
//   ),
// });

function stripConditionalSections(html: string, vars: any) {
  const $ = cheerio.load(html);

  const pickup = (vars.pickup || "").toLowerCase();
  const returnIsland = (vars.returnIsland || "").toLowerCase();

  // 🔹 1. Si no hay returnIsland o no contiene "San Cri" → elimina la sección de devolución
  if (!returnIsland.includes("san cri")) {
    $('p:contains("Instrucciones de devolución en San Cristobal")')
      .closest(".u-row-container")
      .remove();
    
    $('p:contains("Return Instructions in San Cristobal")')
      .closest(".u-row-container")
      .remove();
  }

  // 🔹 2. Si pickup contiene "hotel" y returnIsland contiene "san cri" → elimina sección de recogida
  if (pickup.includes("hotel") && returnIsland.includes("san cri")) {
    $('div:contains("en la oficina de la agencia")')
      .closest(".u-row-container")
      .remove();
    
    $('div:contains("at the Grupo Galapagos travel agency office")')
      .closest(".u-row-container")
      .remove();
  }

  return $.html();
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { to, subject, vars } = await req.json();
    const { id } = params;

    if (!to) return new Response("Missing 'to'", { status: 400 });
    // const { default: mjml2html } = await import('mjml');

    const tpl = await getTemplate(id);
    if (!tpl.html) {
      return new Response("Plantilla no publicada aún", { status: 400 });
    }

    let variables: any = {};
    try { variables = typeof vars === "string" ? JSON.parse(vars) : (vars ?? {}); }
    catch { return new Response("Invalid JSON in 'vars'", { status: 400 }); }

    let template = tpl.html;
    
    // Si el contenido parece ser MJML, compilarlo a HTML
    // if (mjmlTemplate.trim().startsWith('<mjml>')) {
    //   const { html: compiled, errors } = mjml2html(mjmlTemplate, {
    //     minify: false,
    //     validationLevel: 'soft',
    //   });
    //   if (errors?.length) {
    //     const msg = errors.map((e: any) => e.message || e.formattedMessage).join('\n');
    //     return new Response(`MJML errors:\n${msg}`, { status: 400 });
    //   }
    //   mjmlTemplate = compiled;
    // }
    
    // Ahora procesar con Handlebars
    // const html = Handlebars.compile(mjmlTemplate)(variables);
    let finalHtml = Handlebars.compile(template)(variables);
    finalHtml = stripConditionalSections(finalHtml, variables);

    const s = subject || `Prueba: ${tpl.name}`;
    const { error } = await resend.emails.send({
      from: FROM,
      to: Array.isArray(to) ? to : [to], // opcional
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
