import { Resend } from 'resend';
import Handlebars from 'handlebars';
import { listTemplates } from './templates';
import { RentalOrder, RentalItem } from './db';

const resend = new Resend(process.env.RESEND_API_KEY!);
const FROM = process.env.RESEND_FROM_EMAIL || 'noreply@galapagos.viajes';

export interface OrderEmailData {
  order: RentalOrder & { 
    rental_items: (RentalItem & { 
      product_configs: {
        id: string;
        product_type: string;
        product_subtype?: string;
        size?: string;
        public_price: number;
        supplier_cost: number;
      }
    })[];
    customer: {
      id: string;
      first_name?: string;
      last_name?: string;
      email: string;
      phone?: string;
      nationality?: string;
    }
  };
}

export interface EmailVariables {
  // Variables del cliente
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  customerNationality: string;
  
  // Variables del pedido
  orderId: string;
  orderDate: string;
  startDate: string;
  startTime: string;
  endDate: string;
  endTime: string;
  returnIsland: string;
  rentalDays: number;
  
  // Variables de productos
  products: Array<{
    name: string;
    quantity: number;
    unitPrice: number;
    subtotal: number;
  }>;
  
  // Variables financieras
  subtotal: number;
  taxAmount: number;
  totalAmount: number;
  
  // Variables del negocio (para el dueño)
  supplierCost?: number;
  commission?: number;
  profit?: number;
}

function formatProductName(item: any): string {
  const productType = item.product_configs?.product_type;
  const productSubtype = item.product_configs?.product_subtype;
  const size = item.product_configs?.size;
  
  switch (productType) {
    case 'wetsuit':
      return `Traje de buceo ${productSubtype || ''}`.trim();
    case 'snorkel':
      return 'Snorkel';
    case 'fins':
      return `Aletas`.trim();
    default:
      return `Producto ${item.product_config_id}`;
  }
}

function prepareEmailVariables(orderData: OrderEmailData): EmailVariables {
  const { order } = orderData;
  
  // Calcular totales
  const subtotal = order.rental_items.reduce((total, item) => 
    total + (item.unit_price * item.quantity * item.days), 0
  );
  
  // Preparar productos
  const products = order.rental_items.map(item => ({
    name: formatProductName(item),
    quantity: item.quantity,
    unitPrice: item.unit_price,
    subtotal: item.subtotal
  }));
  
  // Calcular comisiones (ejemplo: 30% de ganancia)
  const supplierCost = order.rental_items.reduce((total, item) => 
    total + (item.product_configs?.supplier_cost * item.quantity * item.days), 0
  );
  const commission = subtotal - supplierCost;
  
  return {
    // Cliente
    customerName: `${order.customer?.first_name || ''} ${order.customer?.last_name || ''}`.trim() || 'Cliente',
    customerEmail: order.customer?.email || '',
    customerPhone: order.customer?.phone || '',
    customerNationality: order.customer?.nationality || '',
    
    // Pedido
    orderId: order.id,
    orderDate: new Date(order.created_at).toLocaleDateString('es-ES'),
    startDate: new Date(order.start_date).toLocaleDateString('es-ES'),
    startTime: order.start_time,
    endDate: new Date(order.end_date).toLocaleDateString('es-ES'),
    endTime: order.end_time,
    returnIsland: order.return_island === 'santa-cruz' ? 'Santa Cruz' : 'San Cristóbal',
    rentalDays: order.rental_items[0]?.days || 1,
    
    // Productos
    products,
    
    // Financiero
    subtotal: subtotal,
    taxAmount: order.tax_amount,
    totalAmount: order.total_amount,
    
    // Negocio
    supplierCost,
    commission
  };
}

function convertVariablesToHandlebarsFormat(variables: EmailVariables) {
  return {
    globalData: Object.keys(variables).reduce((acc, key) => {
      acc[key] = { data: variables[key as keyof EmailVariables] };
      return acc;
    }, {} as any)
  };
}

export async function sendAutomaticEmails(orderData: OrderEmailData) {
  try {
    const variables = prepareEmailVariables(orderData);
    const handlebarsVars = convertVariablesToHandlebarsFormat(variables);
    
    // Obtener plantillas por tipo
    // Obtener todas las plantillas con una sola consulta
    const allTemplates = await listTemplates();
    const emailPromises: Promise<any>[] = [];
    
    // Función para obtener el subject según el tipo de plantilla
    const getSubjectByType = (templateType: string) => {
      switch (templateType) {
        case 'customer':
          return `Confirmación de Reserva - Pedido ${orderData.order.id}`;
        case 'business_owner':
          return `Nueva Reserva - Pedido ${orderData.order.id} - Comisión: $${variables.commission?.toFixed(2)}`;
        case 'supplier':
          return `Nueva Reserva de Equipos - Pedido ${orderData.order.id}`;
        default:
          return `Notificación - Pedido ${orderData.order.id}`;
      }
    };
    
    // Procesar todas las plantillas
    for (const template of allTemplates) {
      if (template.html_published && template.recipient_emails?.length && template.template_type) {
        const { default: mjml2html } = await import('mjml');

        let mjmlTemplate = template.html_published;
        if (mjmlTemplate.trim().startsWith('<mjml>')) {
          const { html: compiled, errors } = mjml2html(mjmlTemplate, {
            minify: false,
            validationLevel: 'soft',
          });
          if (errors?.length) {
            const msg = errors.map((e: any) => e.message || e.formattedMessage).join('\n');
            console.error('MJML errors:', msg);
          }
          mjmlTemplate = compiled;
        }

        const finalHtml = Handlebars.compile(mjmlTemplate)(handlebarsVars);
        let recipients = [...template.recipient_emails];
        
        // Para plantillas de cliente, agregar el email del cliente
        if (template.template_type === 'customer' && orderData.order.customer?.email) {
          if (!recipients.includes(orderData.order.customer.email)) {
            recipients.push(orderData.order.customer.email);
          }
        }
        
        emailPromises.push(
          resend.emails.send({
            from: FROM,
            to: recipients,
            subject: getSubjectByType(template.template_type),
            html: finalHtml,
          })
        );
      }
    }
    
    // Enviar todos los emails en paralelo
    const results = await Promise.allSettled(emailPromises);
    
    // Log de resultados
    results.forEach((result, index) => {
      if (result.status === 'rejected') {
        console.error(`Error enviando email ${index + 1}:`, result.reason);
      } else {
        console.log(`Email ${index + 1} enviado exitosamente`);
      }
    });
    
    return {
      success: true,
      emailsSent: results.filter(r => r.status === 'fulfilled').length,
      emailsFailed: results.filter(r => r.status === 'rejected').length
    };
    
  } catch (error) {
    console.error('Error en sendAutomaticEmails:', error);
    throw error;
  }
}

// Función auxiliar para obtener datos completos del pedido
export async function getOrderDataForEmails(orderId: string): Promise<OrderEmailData | null> {
  try {
    const { supabase } = await import('./supabaseClient');
    
    // Obtener el pedido con todos los datos relacionados
    const { data: order, error: orderError } = await supabase
      .from('rental_orders')
      .select('*')
      .eq('id', orderId)
      .single();
    
    if (orderError || !order) {
      console.error('Error obteniendo pedido:', orderError);
      return null;
    }
    
    // Obtener los items del pedido con información del producto
    const { data: items, error: itemsError } = await supabase
      .from('rental_items')
      .select(`
        *,
        product_configs (
          id,
          product_type,
          product_subtype,
          size,
          public_price,
          supplier_cost
        )
      `)
      .eq('order_id', orderId);
    
    if (itemsError) {
      console.error('Error obteniendo items:', itemsError);
      return null;
    }
    
    // Obtener información del cliente
    const { data: customer, error: customerError } = await supabase
      .from('users')
      .select('*')
      .eq('id', order.customer_id)
      .single();
    
    if (customerError) {
      console.error('Error obteniendo cliente:', customerError);
      return null;
    }
    
    return {
      order: {
        ...order,
        rental_items: items || [],
        customer: customer
      }
    };
    
  } catch (error) {
    console.error('Error en getOrderDataForEmails:', error);
    return null;
  }
}