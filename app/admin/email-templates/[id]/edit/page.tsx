"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState, use } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";

// Unlayer no soporta SSR: import dinámico
const EmailEditor = dynamic(() => import("react-email-editor"), { ssr: false });


export default function EditorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: templateId } = use(params);
  const editorRef = useRef<any>(null);

  // estado UI
  const [design, setDesign] = useState<any>(null);     // JSON del editor (Unlayer design)
  const [subject, setSubject] = useState<string>("");
  const [to, setTo] = useState("");
  const [varsJson, setVarsJson] = useState<string>("");

  const [isSavingPreview, setIsSavingPreview] = useState(false);
  const [isSendingTest, setIsSendingTest] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [isAutoSaving, setIsAutoSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);

  // Función de autosave con debounce
  const autoSave = useRef<NodeJS.Timeout | null>(null);
  
  const performAutoSave = async () => {
    if (!editorRef.current) return;
    
    setIsAutoSaving(true);
    try {
      editorRef.current.editor.exportHtml(async ({ design, html }: any) => {
        const res = await fetch(`/api/studio/templates/${templateId}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ design, html, subject })
        });
        if (res.ok) {
          setLastSaved(new Date());
        }
      });
    } catch (error) {
      console.error('Error en autosave:', error);
    } finally {
      setIsAutoSaving(false);
    }
  };

  const scheduleAutoSave = () => {
    if (autoSave.current) {
      clearTimeout(autoSave.current);
    }
    
    autoSave.current = setTimeout(performAutoSave, 2000);
  };

  useEffect(() => {
    return () => {
      if (autoSave.current) {
        clearTimeout(autoSave.current);
      }
    };
  }, []);

  useEffect(() => {
    (async () => {
      const res = await fetch(`/api/studio/templates/${templateId}`);
      const json = await res.json();
      const item = json.item ?? {};
      setSubject(item?.subject || "");
      setVarsJson(JSON.stringify(item?.preview_data ?? {
        Name: "Ricardo",
        ReservationId: "R-12345",
        Date: "2025-09-20",
        Time: "19:00",
        Guests: 3,
        Amount: "$49.90",
        ManageUrl: "https://tusitio/mi-reserva/R-12345"
      }, null, 2));
      // si ya guardaste un diseño antes, cárgalo
      setDesign(item?.design ?? null); // ← asumo que en tu API guardarás design
    })();
  }, [templateId]);

  // useEffect separado para manejar la carga del diseño cuando esté disponible
  useEffect(() => {
    if (design && editorRef.current?.editor) {
      console.log('Design y editor disponibles, intentando cargar diseño...');
      // Pequeño delay adicional para asegurar que el editor esté completamente inicializado
      const timer = setTimeout(() => {
        loadDesignWithRetry(design);
      }, 200);
      
      return () => clearTimeout(timer);
    }
  }, [design]); // Se ejecuta cuando design cambia (se carga desde la API)

  // Función para cargar el diseño con reintentos
  const loadDesignWithRetry = (designData: any, retries = 3, delay = 500) => {
    const attemptLoad = (attempt: number) => {
      try {
        if (editorRef.current?.editor && typeof editorRef.current.editor.loadDesign === 'function') {
          console.log(`Intentando cargar diseño - intento ${attempt + 1}`);
          editorRef.current.editor.loadDesign(designData);
          console.log('Diseño cargado exitosamente');
          return true;
        } else {
          throw new Error('Editor no está listo');
        }
      } catch (error) {
        console.warn(`Error al cargar diseño (intento ${attempt + 1}):`, error);
        
        if (attempt < retries - 1) {
          setTimeout(() => attemptLoad(attempt + 1), delay);
        } else {
          console.error('No se pudo cargar el diseño después de todos los intentos');
          toast.error('Error al cargar el diseño del email');
        }
        return false;
      }
    };
    
    attemptLoad(0);
  };

  // Cuando el editor está listo, carga el diseño si existe
  const onLoad = () => {
    console.log('Editor onLoad ejecutado');
    
    // Configurar merge tags primero
    try {
      editorRef.current?.editor.setMergeTags({
        customerName: {
          name: 'Nombre cliente',
          value: '{{customerName}}',
          sample: 'Christian Echavarria',
        },
        customerEmail: {
          name: 'Email cliente',
          value: '{{customerEmail}}',
          sample: 'christian@example.com',
        },
        customerPhone: {
          name: 'Teléfono cliente',
          value: '{{customerPhone}}',
          sample: '+593 99 123 4567',
        },
        customerNationality: {
          name: 'Nacionalidad cliente',
          value: '{{customerNationality}}',
          sample: 'Ecuador',
        },
        orderNumber: {
          name: 'Número pedido',
          value: '{{orderNumber}}',
          sample: '140',
        },
        orderDate: {
          name: 'Fecha pedido',
          value: '{{orderDate}}',
          sample: '15/01/2025',
        },
        products: {
          name: 'Products',
          rules: {
            repeat: {
              name: 'Repeat for Each Product',
              before: '{{#each products}}',
              after: '{{/each}}',
            },
          },
          mergeTags: {
            name: {
              name: 'Producto',
              value: '{{name}}',
              sample: 'Traje de buceo largo - Talla M',
            },
            name_en: {
              name: 'Producto en inglés',
              value: '{{name_en}}',
              sample: 'Wetsuit - Size M',
            },
            quantity: {
              name: 'Cantidad',
              value: '{{quantity}}',
              sample: '2',
            },
            days: {
              name: 'Días',
              value: '{{days}}',
              sample: '5',
            },
            subtotal: {
              name: 'Subtotal',
              value: '{{subtotal}}',
              sample: '45',
            },
            unitPrice: {
              name: 'Precio unitario',
              value: '{{unitPrice}}',
              sample: '5',
            }
          },
        },
        rentalDays: {
          name: 'Días de alquiler',
          value: '{{rentalDays}}',
          sample: '5',
        },
        pickup: {
          name: 'Lugar de recogida',
          value: '{{pickup}}',
          sample: 'Santa Cruz',
        },
        returnIsland: {
          name: 'Isla de retorno',
          value: '{{returnIsland}}',
          sample: 'San Cristobal',
        },
        subtotal: {
          name: 'Subtotal',
          value: '{{subtotal}}',
          sample: '90',
        },
        taxAmount: {
          name: 'Impuestos',
          value: '{{taxAmount}}',
          sample: '10',
        },
        totalAmount: {
          name: 'Total',
          value: '{{totalAmount}}',
          sample: '100',
        },
        initialPayment: {
          name: 'Pago inicial',
          value: '{{initialPayment}}',
          sample: '50',
        },
        supplierTotalAmount: {
          name: 'Total proveedor',
          value: '{{supplierTotalAmount}}',
          sample: '100',
        },
        returnFee: {
          name: 'Cargo por devolución',
          value: '{{returnFee}}',
          sample: '10',
        },
        sizesSelectionID: {
          name: 'Link tallas',
          value: '{{sizesSelectionID}}',
          sample: 'https://galapagos.viajes/sizes?orderId=352b5e17-1192-4e9c-a307-ec66c676fb77',
        },
        startDate: {
          name: 'Fecha recogida',
          value: '{{startDate}}',
          sample: '20/01/2025',
        },
        startTime: {
          name: 'Hora recogida',
          value: '{{startTime}}',
          sample: '14:00',
        },
        endDate: {
          name: 'Fecha entrega',
          value: '{{endDate}}',
          sample: '22/01/2025',
        },
        endTime: {
          name: 'Hora entrega',
          value: '{{endTime}}',
          sample: '19:00',
        }
      });

      // Configurar Display Conditions con delay para asegurar que el editor esté listo
      // NOTA: Display Conditions es una funcionalidad de pago de Unlayer
      setTimeout(() => {
        try {
          console.log('Configurando Display Conditions...');
          if (editorRef.current?.editor && typeof editorRef.current.editor.setDisplayConditions === 'function') {
            editorRef.current.editor.setDisplayConditions([
              {
                type: 'Isla',
                label: 'Isla de devolución',
                description: 'Muestra este contenido si la isla de retorno es San Cristobal',
                before: '{{#if (strContains returnIsland "San Cri")}}',
                after: '{{/if}}',
              }
            ]);
            console.log('Display Conditions configuradas exitosamente');
          } else {
            console.warn('setDisplayConditions no está disponible - Esta es una funcionalidad de pago de Unlayer');
            console.warn('Para usar Display Conditions necesitas una suscripción de pago de Unlayer');
          }
        } catch (error) {
          console.error('Error al configurar Display Conditions:', error);
        }
      }, 300);

      console.log('Merge tags configurados');
    } catch (error) {
      console.warn('Error al configurar merge tags:', error);
    }

    // Agregar event listener para auto-save
    try {
      editorRef.current?.editor.addEventListener('design:updated', () => {
        scheduleAutoSave();
      });
      console.log('Event listener agregado');
    } catch (error) {
      console.warn('Error al agregar event listener:', error);
    }

    // Cargar diseño con delay para asegurar que el editor esté completamente listo
     // Nota: El diseño también se carga en el useEffect separado cuando está disponible
     if (design) {
       console.log('onLoad: Design disponible, programando carga...');
       setTimeout(() => {
         loadDesignWithRetry(design);
       }, 100);
     } else {
       console.log('onLoad: No hay diseño para cargar');
     }
  };

  // Guardar diseño + HTML (borrador)
  const saveDraft = async () => {
    if (!editorRef.current) return;
    editorRef.current.editor.exportHtml(async ({ design, html }: any) => {
      // Guardamos ambos: design (JSON) y html (borrador)
      const res = await fetch(`/api/studio/templates/${templateId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ design, html, subject })
      });
      if (!res.ok) return toast.error("No se pudo guardar");
      toast.success("Borrador guardado");
    });
  };

  // Publicar: guarda tanto el design como el HTML final listo para enviar
  const publish = async () => {
    if (isPublishing) return;
    setIsPublishing(true);
    try {
      editorRef.current.editor.exportHtml(async ({ design, html }: any) => {
        const res = await fetch(`/api/studio/templates/${templateId}/publish`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ design, html }) // ← design y html con {{variables}} intactas
        });
        if (!res.ok) throw new Error(await res.text());
        toast.success("Publicado ✅");
      });
    } catch (e: any) {
      toast.error(e.message || "Error al publicar");
    } finally {
      setIsPublishing(false);
    }
  };

  // Guardar asunto y variables de PREVIEW (para que el editor muestre datos)
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
      if (!res.ok) throw new Error(await res.text());
      toast.success("Preview y subject guardados ✅");
    } catch (e: any) {
      toast.error(`JSON inválido: ${e.message}`);
    } finally {
      setIsSavingPreview(false);
    }
  };

  // Enviar prueba
  const sendTest = async () => {
    if (!to.trim()) return toast.error("Pon un email de destino");
    if (isSendingTest) return;

    setIsSendingTest(true);
    try {
      const vars = JSON.parse(varsJson || "{}");

      // Nota: si tu endpoint /send-test espera todavía globalData,
      // transforma aquí. Si ya lo cambiaste a JSON plano, manda "vars" directo.
      // --- descomenta una de estas dos líneas según tu server ---

      // 1) Si tu server usa JSON plano:
      const payload = { to, subject, vars };

      // 2) Si tu server aún espera { globalData: { Name: { data } } }:
      // const payload = {
      //   to, subject,
      //   vars: {
      //     globalData: Object.fromEntries(Object.entries(vars).map(([k,v]) => [k, { data: v }]))
      //   }
      // };

      const res = await fetch(`/api/studio/templates/${templateId}/send-test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const ok = res.ok;
      const msg = ok ? "Email de prueba enviado ✅" : `Error: ${await res.text()}`;
      toast[ok ? "success" : "error"](msg);
    } catch {
      toast.error("Error al enviar email de prueba");
    } finally {
      setIsSendingTest(false);
    }
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-4 h-screen">
      <div className="xl:col-span-3 h-full flex flex-col">
        <EmailEditor
          ref={editorRef}
          onReady={onLoad}
          options={{
            displayMode: 'email',
            locale: 'es',
            mergeTagsConfig: {
              sort: false
            }
          }}
          style={{ height: '100%', width: '100%' }}
        />
      </div>

      <aside className="xl:col-span-1 border-l p-4 space-y-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold">Prueba & Variables</h2>
          <Link
            href="/admin?tab=email-templates"
            className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Volver
          </Link>
        </div>

        {/* Indicador de autosave */}
        <div className="flex items-center justify-between text-xs text-gray-500 bg-gray-50 px-2 py-1 rounded">
          <span>
            {isAutoSaving ? (
              <span className="flex items-center gap-1">
                <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                Guardando automáticamente...
              </span>
            ) : lastSaved ? (
              <span className="flex items-center gap-1">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                Guardado {lastSaved.toLocaleTimeString()}
              </span>
            ) : (
              <span className="flex items-center gap-1">
                <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
                Sin cambios
              </span>
            )}
          </span>
        </div>

        <label className="block text-sm text-gray-600">Asunto del email</label>
        <input
          className="border rounded w-full px-3 py-2"
          placeholder="Confirmación de reserva"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
        />

        <label className="block text-sm text-gray-600 mt-4">Enviar prueba a</label>
        <input
          className="border rounded w-full px-3 py-2"
          placeholder="correo@dominio.com"
          value={to}
          onChange={(e) => setTo(e.target.value)}
        />

        <label className="block text-sm text-gray-600 mt-2">Variables (JSON)</label>
        <textarea
          className="border rounded w-full h-48 px-3 py-2 font-mono text-sm"
          value={varsJson}
          onChange={(e) => setVarsJson(e.target.value)}
        />

        <div className="flex gap-2">
          <button
            className="bg-black text-white px-3 py-2 rounded disabled:opacity-50"
            onClick={savePreview}
            disabled={isSavingPreview || isSendingTest || isPublishing}
          >
            {isSavingPreview ? "Cargando..." : "Guardar asunto y variables"}
          </button>
          <button
            className="bg-gray-700 text-white px-3 py-2 rounded disabled:opacity-50"
            onClick={saveDraft}
            disabled={isSavingPreview || isSendingTest || isPublishing}
          >
            Guardar borrador
          </button>
          <button
            className="bg-emerald-600 text-white px-3 py-2 rounded disabled:opacity-50"
            onClick={sendTest}
            disabled={isSavingPreview || isSendingTest || isPublishing}
          >
            {isSendingTest ? "Cargando..." : "Enviar prueba"}
          </button>
        </div>

        <div className="pt-4 border-t">
          <button
            className="bg-indigo-600 text-white px-3 py-2 rounded w-full disabled:opacity-50"
            onClick={publish}
            disabled={isSavingPreview || isSendingTest || isPublishing}
          >
            {isPublishing ? "Cargando..." : "Publicar (guardar HTML listo)"}
          </button>
          <p className="text-xs text-gray-500 mt-2">
            * “Guardar borrador” guarda el diseño y un HTML de referencia.<br />
            * “Publicar” guarda el HTML definitivo con {`{{variables}}`} para producción.<br />
            * “Enviar prueba” renderiza con Handlebars en tu API y manda por Resend.
          </p>
        </div>
      </aside>
    </div>
  );
}