"use client";

import { useEffect, useMemo, useState, use } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import type { Editor } from 'grapesjs';
import StudioEditor, { CreateEditorOptions } from "@grapesjs/studio-sdk/react";
import { rteTinyMce, dataSourceHandlebars, layoutSidebarButtons } from "@grapesjs/studio-sdk-plugins";
import "@grapesjs/studio-sdk/style";

export default function EditorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: templateId } = use(params);
  const [ready, setReady] = useState(false);
  const [editor, setEditor] = useState<Editor>();
  const [previewData, setPreviewData] = useState<any>(null);
  const [to, setTo] = useState("");
  const [varsJson, setVarsJson] = useState<string>("");
  const [subject, setSubject] = useState<string>("");
  const [isSavingPreview, setIsSavingPreview] = useState(false);
  const [isSendingTest, setIsSendingTest] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);

  const onReady = (editor: Editor) => {
    console.log('Editor loaded', editor);
    setEditor(editor);
  };

  const layoutConfig: CreateEditorOptions['layout'] = {
    default: {
      type: 'row',
      style: { height: '100%' },
      children: [
        {
          type: 'canvasSidebarTop',
          sidebarTop: {
            leftContainer: {
              buttons: ({ items }) => [
                ...items,
                {
                  id: 'toggle-datasources-preview',
                  title: 'Toggle Data Sources',
                  icon: 'databaseOutlineOn',
                  onClick: ({ editor }) => {
                    editor.runCommand('studio:toggleDataSourcesPreview');
                  },
                  editorEvents: {
                    ['studio:toggleDataSourcesPreview']: ({ fromEvent, setState }) => {
                      setState({ active: fromEvent.showPlaceholder });
                    },
                    ['studio:layoutToggle']: ({ fromEvent, setState }) => {
                      setState({ active: fromEvent.showPlaceholder });
                    }
                  }
                },
                {
                  id: 'layout-toogle',
                  title: 'Toggle Layers',
                  icon: 'layers',
                  onClick: ({ editor }) => {
                    editor.runCommand('studio:layoutRemove', { id: 'layoutId2' });
                    editor.runCommand('studio:layoutToggle', {
                      id: 'layoutId1',
                      layout: { type: 'panelPagesLayers' },
                      header: { label: 'Layers' },
                      placer: { type: 'absolute', position: 'left' }
                    });
                  },
                  editorEvents: {
                    ['studio:toggleDataSourcesPreview']: ({ fromEvent, setState }) => {
                      setState({ active: fromEvent.showPlaceholder });
                    },
                    ['studio:layoutToggle']: ({ fromEvent, setState }) => {
                      setState({ active: fromEvent.showPlaceholder });
                    }
                  }
                }
              ]
            }
          }
        },
        { type: 'sidebarRight' }
      ]
    },
    responsive: {
      // Studio will switch the layout when the editor container width is below 1000px.
      1000: {
        type: 'row',
        style: { height: '100%' },
        children: [{ type: 'sidebarLeft' }, { type: 'canvas' }]
      },
      600: {
        type: 'column',
        style: { height: '100%' },
        children: [{ type: 'canvas' }, { type: 'row', children: 'Text' }]
      }
    }
  }

  // Carga preview_data y subject (para mostrar variables en el editor)
  useEffect(() => {
    (async () => {
      const res = await fetch(`/api/studio/templates/${templateId}`);
      const json = await res.json();
      const p = json.item?.preview_data ?? {
        Name: "Ricardo",
        ReservationId: "R-12345",
        Date: "2025-09-20",
        Time: "19:00",
        Guests: 3,
        Amount: "$49.90",
        ManageUrl: "https://tusitio/mi-reserva/R-12345"
      };
      setPreviewData(p);
      setVarsJson(JSON.stringify(p, null, 2));
      setSubject(json.item?.subject || "");
      setReady(true);
    })();
  }, [templateId]);

  const editorOptions = useMemo(() => {
    if (!ready) return null;
    return {
      onReady,
      licenseKey: process.env.NEXT_PUBLIC_GJS_STUDIO_LICENSE!,
      layout: layoutConfig,
      project: { 
        type: "email",
        id: templateId,
        default: {
          pages: [
          { component: `
            <mjml>
              <mj-head>
                <mj-title>{{ globalData.Name.data }} - Confirmación de Reserva</mj-title>
                <mj-preview>Tu reserva {{ globalData.ReservationId.data }} ha sido confirmada</mj-preview>
                <mj-attributes>
                  <mj-all font-family="Arial, sans-serif" />
                  <mj-text font-size="16px" color="#333" line-height="1.6" />
                  <mj-button background-color="#007bff" color="white" border-radius="4px" />
                </mj-attributes>
              </mj-head>
              <mj-body background-color="#f5f5f5">
                <mj-section background-color="white" border-radius="8px" padding="40px">
                  <mj-column>
                    <mj-text font-size="24px" font-weight="bold" color="#333">
                      ¡Hola {{ globalData.Name.data }}!
                    </mj-text>
                    <mj-text>
                      Tu reserva ha sido confirmada exitosamente.
                    </mj-text>
                    <mj-divider border-color="#e0e0e0" />
                    <mj-text font-weight="bold">Detalles de tu reserva:</mj-text>
                    <mj-text>
                      <strong>ID de Reserva:</strong> {{ globalData.ReservationId.data }}<br/>
                      <strong>Fecha:</strong> {{ globalData.Date.data }}<br/>
                      <strong>Hora:</strong> {{ globalData.Time.data }}<br/>
                      <strong>Huéspedes:</strong> {{ globalData.Guests.data }}<br/>
                      <strong>Total:</strong> {{ globalData.Amount.data }}
                    </mj-text>
                    <mj-text font-size="14px" color="#666">
                      Si tienes alguna pregunta, no dudes en contactarnos.
                    </mj-text>
                  </mj-column>
                </mj-section>
              </mj-body>
            </mjml>`,
          style: {
            '.container': { margin: '0 auto' },
            '.card': { 'box-shadow': '0 1px 3px rgba(0,0,0,.08)' }
          },
          assets: []
          }]
        }
      },
      identity: { id: "admin-user-1" },
      assets: { storageType: "cloud" },
      storage: {
        type: "self",
        autosaveChanges: 50,
        autosaveIntervalMs: 10000,
        onSave: async ({ project }: any) => {
          await fetch(`/api/studio/projects/${templateId}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ project })
          });
        },
        onLoad: async () => {
          const res = await fetch(`/api/studio/projects/${templateId}`, { cache: "no-store" });
          const data = await res.json();
          // Si no hay proyecto guardado, usar el template por defecto
          return { project: data?.project ?? null };
        }
      },
      dataSources: {
        blocks: true,
        globalData: previewData,
      },
      plugins: [
        rteTinyMce.init({}),
        dataSourceHandlebars.init({}),
      ],
    } as any;
  }, [ready, templateId, previewData]);

  const publish = async () => {
    if (!editor) return alert("Editor aún no está listo");
    if (isPublishing) return;

    setIsPublishing(true);
    try {
      // 1) Forzar placeholders en el preview/exports
      // Nota: el comando correcto es *toggleDataSourcesPreview*
      editor.runCommand('studio:toggleDataSourcesPreview', { showPlaceholder: true });

      // 2) Exportar MJML tal cual con variables (sin IDs auto)
      // getHtml soporta { cleanId: true } en GrapesJS
      let mjml = editor.getHtml({ cleanId: true }) as string;

      // (Si algo te agrega IDs raros, deja también tu fallback)
      // mjml = mjml.replace(/\s+id="[^"]*"/g, '');

      // 3) Publicar (guarda MJML o compílalo a HTML, según tu flujo)
      const res = await fetch(`/api/studio/templates/${templateId}/publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mjml }) // <-- manda MJML, no HTML resuelto
      });
      if (!res.ok) throw new Error(await res.text());
      alert("Publicado ✅");
    } catch (e: any) {
      console.error(e);
      alert("Error al publicar");
    } finally {
      // (Opcional) volver al modo de vista que quieras
      // ed.runCommand('studio:toggleDataSourcesPreview', { showPlaceholder: false });
    }
  };

  const savePreview = async () => {
    if (isSavingPreview) return;
    
    setIsSavingPreview(true);
    try {
      const parsed = JSON.parse(varsJson || "{}");
      const res = await fetch(`/api/studio/templates/${templateId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ preview_data: parsed, subject: subject.trim() })
      });
      if (!res.ok) throw new Error("No se pudo guardar preview");
      setPreviewData(parsed);
      alert("Preview y subject guardados ✅ (vuelve a recargar para refrescar el editor)");
    } catch (e: any) {
      alert(`JSON inválido: ${e.message}`);
    } finally {
      setIsSavingPreview(false);
    }
  };

  const sendTest = async () => {
    if (!to.trim()) return alert("Pon un email de destino");
    if (isSendingTest) return;
    
    setIsSendingTest(true);
    try {
      // Convertir variables planas a formato globalData que espera Handlebars
      let variables = {};
      try {
        const parsedVars = JSON.parse(varsJson || "{}");
        variables = {
          globalData: Object.keys(parsedVars).reduce((acc, key) => {
            acc[key] = { data: parsedVars[key] };
            return acc;
          }, {} as any)
        };
      } catch (e) {
        return alert("JSON de variables inválido");
      }
      
      const res = await fetch(`/api/studio/templates/${templateId}/send-test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to, vars: variables })
      });
      const ok = res.ok;
      const msg = ok ? "Email de prueba enviado ✅" : `Error: ${await res.text()}`;
      alert(msg);
    } catch (error) {
      alert("Error al enviar email de prueba");
    } finally {
      setIsSendingTest(false);
    }
  };

  if (!editorOptions) return <div className="p-6">Cargando editor…</div>;

  return (
    <div className="grid grid-cols-1 xl:grid-cols-4 h-screen">
      <div className="xl:col-span-3 h-full">
        <StudioEditor
          className="!h-full w-full"
          options={editorOptions}
        />
      </div>

      <aside className="xl:col-span-1 border-l p-4 space-y-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold">Prueba & Variables</h2>
          <Link 
            href="/admin" 
            className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Volver
          </Link>
        </div>

        <label className="block text-sm text-gray-600">Asunto del email</label>
        <input className="border rounded w-full px-3 py-2"
               placeholder="Confirmación de reserva"
               value={subject} onChange={e => setSubject(e.target.value)} />

        <label className="block text-sm text-gray-600 mt-4">Enviar prueba a</label>
        <input className="border rounded w-full px-3 py-2"
               placeholder="cecheverria@gmail.com"
               value={to} onChange={e => setTo(e.target.value)} />

        <label className="block text-sm text-gray-600 mt-2">Variables (JSON)</label>
        <textarea className="border rounded w-full h-48 px-3 py-2 font-mono text-sm"
                  value={varsJson} onChange={e => setVarsJson(e.target.value)} />

        <div className="flex gap-2">
          <button 
            className="bg-black text-white px-3 py-2 rounded disabled:opacity-50 disabled:cursor-not-allowed" 
            onClick={savePreview}
            disabled={isSavingPreview || isSendingTest || isPublishing}
          >
            {isSavingPreview ? 'Cargando...' : 'Guardar asunto y variables'}
          </button>
          <button 
            className="bg-emerald-600 text-white px-3 py-2 rounded disabled:opacity-50 disabled:cursor-not-allowed" 
            onClick={sendTest}
            disabled={isSavingPreview || isSendingTest || isPublishing}
          >
            {isSendingTest ? 'Cargando...' : 'Enviar prueba'}
          </button>
        </div>

        <div className="pt-4 border-t">
          <button 
            className="bg-indigo-600 text-white px-3 py-2 rounded w-full disabled:opacity-50 disabled:cursor-not-allowed" 
            onClick={publish}
            disabled={isSavingPreview || isSendingTest || isPublishing}
          >
            {isPublishing ? 'Cargando...' : 'Guardar plantilla'}
          </button>
          <p className="text-xs text-gray-500 mt-2">
            * "Guardar plantilla" guarda el HTML con {`{{variables}}`} en la BD.<br />  
            * "Enviar prueba" renderiza ese HTML con Handlebars y lo manda por Resend a la cuenta de correo que especifiques.
          </p>
        </div>
      </aside>
    </div>
  );
}