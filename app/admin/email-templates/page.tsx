"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Trash2, Edit, Plus, Settings } from "lucide-react";
import { toast } from "sonner";
import { TemplateType } from "@/lib/templates";

type Item = { 
  id: string; 
  name: string; 
  template_type: TemplateType | null;
  recipient_emails: string[] | null;
  updated_at: string; 
};

export default function EmailTemplatesList() {
  const [items, setItems] = useState<Item[]>([]);
  const [name, setName] = useState("");
  const [templateType, setTemplateType] = useState<TemplateType | "">("");
  const [recipientEmails, setRecipientEmails] = useState("");
  const [editingTemplate, setEditingTemplate] = useState<string | null>(null);
  const [editTemplateType, setEditTemplateType] = useState<TemplateType | "">("");
  const [editRecipientEmails, setEditRecipientEmails] = useState("");

  const load = async () => {
    const res = await fetch("/api/studio/templates", { cache: "no-store" });
    const json = await res.json();
    setItems(json.items);
  };

  useEffect(() => { load(); }, []);

  const create = async () => {
    if (!name.trim()) {
      toast.error("Por favor ingresa un nombre para la plantilla");
      return;
    }
    if (!templateType) {
      toast.error("Por favor selecciona un tipo de plantilla");
      return;
    }
    
    const emails = recipientEmails.split(',').map(email => email.trim()).filter(email => email);
    
    try {
      const res = await fetch("/api/studio/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          template_type: templateType,
          recipient_emails: emails.length > 0 ? emails : null,
          preview_data: getPreviewDataByType(templateType)
        })
      });
      const json = await res.json();
      setName("");
      setTemplateType("");
      setRecipientEmails("");
      toast.success("Plantilla creada exitosamente");
      window.location.href = `/admin/email-templates/${json.item.id}/edit`;
    } catch (error) {
      toast.error("Error al crear la plantilla");
    }
  };

  const getPreviewDataByType = (type: TemplateType) => {
    const baseData = {
      customerName: "Juan Pérez",
      customerEmail: "juan@example.com",
      customerPhone: "+593 99 123 4567",
      customerNationality: "Ecuador",
      orderId: "ORD-12345",
      orderDate: "15/01/2025",
      startDate: "20/01/2025",
      startTime: "09:00",
      endDate: "22/01/2025",
      endTime: "17:00",
      returnIsland: "Santa Cruz",
      rentalDays: 3,
      products: [
        { name: "Traje de buceo largo - Talla M", quantity: 1, unitPrice: 15, subtotal: 45 },
        { name: "Aletas - Talla 42", quantity: 1, unitPrice: 8, subtotal: 24 }
      ],
      subtotal: 69,
      taxAmount: 8.28,
      totalAmount: 77.28
    };
    
    if (type === 'business_owner' || type === 'supplier') {
      return {
        ...baseData,
        supplierCost: 48.30,
        commission: 6.21,
        profit: 20.70
      };
    }
    
    return baseData;
  };

  const updateTemplateConfig = async (templateId: string) => {
    if (!editTemplateType) {
      toast.error("Por favor selecciona un tipo de plantilla");
      return;
    }
    
    const emails = editRecipientEmails.split(',').map(email => email.trim()).filter(email => email);
    
    try {
      const res = await fetch(`/api/studio/templates/${templateId}/config`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          template_type: editTemplateType,
          recipient_emails: emails.length > 0 ? emails : null
        })
      });
      
      if (res.ok) {
        toast.success("Configuración actualizada exitosamente");
        setEditingTemplate(null);
        load();
      } else {
        toast.error("Error al actualizar la configuración");
      }
    } catch (error) {
      toast.error("Error al actualizar la configuración");
    }
  };

  const startEditing = (template: Item) => {
    setEditingTemplate(template.id);
    setEditTemplateType(template.template_type || "");
    setEditRecipientEmails(template.recipient_emails?.join(', ') || "");
  };

  const deleteTemplate = async (id: string, templateName: string) => {
    if (!confirm(`¿Estás seguro de que quieres eliminar la plantilla "${templateName}"?`)) {
      return;
    }
    try {
      const res = await fetch(`/api/studio/templates/${id}`, {
        method: "DELETE"
      });
      if (res.ok) {
        toast.success("Plantilla eliminada exitosamente");
        load(); // Recargar la lista
      } else {
        toast.error("Error al eliminar la plantilla");
      }
    } catch (error) {
      toast.error("Error al eliminar la plantilla");
    }
  };

  return (
    <div className="p-6 mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Plantillas de Email</h1>
          <p className="text-muted-foreground">Gestiona las plantillas de correo electrónico para tu aplicación</p>
        </div>
        <Badge variant="secondary" className="text-sm">
          {items.length} plantilla{items.length !== 1 ? 's' : ''}
        </Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Crear Nueva Plantilla
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex gap-4">
              <div className="space-y-2 flex-1">
                <Label htmlFor="template-name">Nombre de la plantilla</Label>
                <Input
                  id="template-name"
                  placeholder="Ej: Confirmación de Reserva Cliente"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className="bg-white border border-gray-300"
                />
              </div>
              <div className="space-y-2 flex-0">
                <Label htmlFor="template-type">Tipo de plantilla</Label>
                <Select value={templateType} onValueChange={(value: TemplateType) => {
                  setTemplateType(value);
                  if (value === 'customer') {
                    setRecipientEmails('');
                  }
                }}>
                  <SelectTrigger className="bg-white border border-gray-300">
                    <SelectValue placeholder="Selecciona el tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="customer">Cliente - Confirmación de compra</SelectItem>
                    <SelectItem value="business_owner">Dueño del negocio - Reporte de ventas</SelectItem>
                    <SelectItem value="supplier">Proveedor - Notificación de reserva</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2 flex-1">
                <Label htmlFor="recipient-emails">Emails destinatarios (separados por comas)</Label>
                <Input
                    id="recipient-emails"
                    placeholder={templateType === 'customer' ? "El email del cliente será el destinatario" : "admin@empresa.com, ventas@empresa.com"}
                    value={recipientEmails}
                    onChange={e => setRecipientEmails(e.target.value)}
                    disabled={templateType === 'customer'}
                    className="bg-white border border-gray-300"
                />
              </div>
            </div>
            <Button onClick={create} className="w-full">
              <Plus className="h-4 w-4 mr-2" />
              Crear Plantilla
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4">
        {items.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <div className="text-muted-foreground text-center">
                <h3 className="font-semibold text-lg mb-2">No hay plantillas</h3>
                <p>Crea tu primera plantilla de email para comenzar</p>
              </div>
            </CardContent>
          </Card>
        ) : (
          items.map(item => (
            <Card key={item.id} className="shadow-none hover:shadow-md transition-shadow py-3 bg-white">
              <CardContent className="py-0 px-6">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="font-semibold text-lg">{item.name}</h3>
                      {item.template_type && (
                        <Badge variant="secondary">
                          {item.template_type === 'customer' && 'Cliente'}
                          {item.template_type === 'business_owner' && 'Dueño del negocio'}
                          {item.template_type === 'supplier' && 'Proveedor'}
                        </Badge>
                      )}
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">
                        Última actualización: {new Date(item.updated_at).toLocaleDateString('es-ES', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </p>
                      {item.recipient_emails && item.recipient_emails.length > 0 && (
                        <p className="text-sm text-gray-600">
                          Destinatarios: {item.recipient_emails.join(', ')}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => startEditing(item)}
                    >
                      <Settings className="h-4 w-4 mr-2" />
                      Config
                    </Button>
                    <Button asChild variant="outline" size="sm">
                      <Link href={`/admin/email-templates/${item.id}/edit`}>
                        <Edit className="h-4 w-4 mr-2" />
                        Editar
                      </Link>
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => deleteTemplate(item.id, item.name)}
                      className="text-destructive hover:text-white"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Eliminar
                    </Button>
                  </div>
                </div>
                
                {editingTemplate === item.id && (
                  <div className="border-t mt-4 pt-4 bg-gray-50 -mx-6 -mb-3 px-6 pb-6 rounded-b-xl">
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Tipo de plantilla</Label>
                          <Select value={editTemplateType} onValueChange={(value: TemplateType) => {
                            setEditTemplateType(value);
                            if (value === 'customer') {
                              setEditRecipientEmails('');
                            }
                          }}>
                            <SelectTrigger className="bg-white">
                              <SelectValue placeholder="Selecciona el tipo" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="customer">Cliente - Confirmación de compra</SelectItem>
                              <SelectItem value="business_owner">Dueño del negocio - Reporte de ventas</SelectItem>
                              <SelectItem value="supplier">Proveedor - Notificación de reserva</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>Emails destinatarios (separados por comas)</Label>
                          <Input
                            placeholder={editTemplateType === 'customer' ? "El email del cliente será el destinatario" : "admin@empresa.com, ventas@empresa.com"}
                            value={editRecipientEmails}
                            onChange={e => setEditRecipientEmails(e.target.value)}
                            disabled={editTemplateType === 'customer'}
                            className="bg-white border border-gray-300"
                          />
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button onClick={() => updateTemplateConfig(item.id)} size="sm">
                          Guardar Configuración
                        </Button>
                        <Button variant="outline" onClick={() => setEditingTemplate(null)} size="sm">
                          Cancelar
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
