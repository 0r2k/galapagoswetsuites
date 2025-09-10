import { createTemplate } from "@/lib/templates";
import { TemplateType } from "@/lib/templates";

async function createExampleTemplates() {
  console.log("Creando plantillas de ejemplo...");

  // Plantilla para Cliente - Confirmación de compra
  const customerTemplate = await createTemplate(
    "Confirmación de Compra - Cliente",
    {
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
    },
    'customer' as TemplateType,
    null // Los emails del cliente se agregan automáticamente
  );

  // Plantilla para Dueño del Negocio - Reporte de ventas
  const businessOwnerTemplate = await createTemplate(
    "Reporte de Venta - Dueño del Negocio",
    {
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
      totalAmount: 77.28,
      supplierCost: 48.30,
      commission: 6.21,
      profit: 20.70
    },
    'business_owner' as TemplateType,
    ['admin@galapagos-dive.com', 'ventas@galapagos-dive.com']
  );

  // Plantilla para Proveedor - Notificación de reserva
  const supplierTemplate = await createTemplate(
    "Notificación de Reserva - Proveedor",
    {
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
      totalAmount: 77.28,
      supplierCost: 48.30,
      commission: 6.21,
      profit: 20.70
    },
    'supplier' as TemplateType,
    ['proveedor@equipos-buceo.com', 'logistica@equipos-buceo.com']
  );

  console.log("Plantillas creadas:");
  console.log("- Cliente:", customerTemplate.id);
  console.log("- Dueño del negocio:", businessOwnerTemplate.id);
  console.log("- Proveedor:", supplierTemplate.id);

  // Ahora vamos a actualizar el contenido HTML de cada plantilla
  console.log("\nActualizando contenido HTML de las plantillas...");
  
  // Aquí necesitarías usar las funciones de actualización de plantillas
  // para establecer el contenido HTML específico de cada una
  
  console.log("¡Plantillas de ejemplo creadas exitosamente!");
}

// Ejecutar solo si se llama directamente
if (require.main === module) {
  createExampleTemplates().catch(console.error);
}

export { createExampleTemplates };