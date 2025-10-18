import { Resend } from 'resend';
import Handlebars from 'handlebars';
import * as cheerio from "cheerio";
import { listTemplates } from './templates';
import { RentalOrder, RentalItem } from './db';
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const resend = new Resend(process.env.RESEND_API_KEY!);
const FROM = process.env.RESEND_FROM || 'noreply@galapagos.viajes';

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

export interface OrderEmailData {
  order: RentalOrder & { 
    rental_items: (RentalItem & { 
      product_config: {
        id: string;
        product_type: string;
        product_subtype?: string;
        size?: string;
        name: string;
        name_en: string;
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
  orderNumber: number;
  orderDate: string;
  startDate: string;
  startTime: string;
  endDate: string;
  endTime: string;
  pickup: string;
  returnIsland: string;
  rentalDays: number;
  
  // Variables de productos
  products: Array<{
    name: string;
    name_en: string;
    quantity: number;
    days: number;
    unitPrice: number;
    subtotal: number;
  }>;
  
  // Variables financieras
  subtotal: number;
  taxAmount: number;
  totalAmount: number;
  returnFeeAmount: number;
  returnFee: number;
  initialPayment: number;
  pickupPayment: number;
  
  // Variables del negocio (para el dueño)
  supplierCost?: number;
  supplierTotalAmount?: number;
  commission?: number;
  profit?: number;
  
  // Enlaces
  sizesSelectionID: string;
}

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

// Función para calcular el costo adicional por isla de devolución
async function calculateReturnFeeAmount(returnIsland: string, totalItems: number): Promise<number> {
  try {
    const { data: additionalFee } = await supabaseAdmin
      .from('additional_fees')
      .select('amount')
      .eq('location', returnIsland)
      .eq('active', true)
      .single();
    
    if (additionalFee && additionalFee.amount > 0) {
      // Calcular multiplicador por cada grupo de 3 items (redondeado hacia arriba)
      const multiplier = Math.ceil(totalItems / 3);
      return additionalFee.amount * multiplier;
    }
    
    return 0;
  } catch (error) {
    console.error('Error calculating return fee:', error);
    return 0;
  }
}

async function prepareEmailVariables(orderData: OrderEmailData): Promise<EmailVariables> {
  const { order } = orderData;
  
  // Calcular totales
  const subtotal = order.rental_items.reduce((total, item) => 
    total + (item.unit_price * item.quantity * item.days), 0
  );
  
  // Calcular cantidad total de items para el costo de devolución
  const totalItems = order.rental_items.reduce((total, item) => total + item.quantity, 0);
  
  // Calcular costo adicional por isla de devolución
  const returnFee = await calculateReturnFeeAmount(order.return_island, totalItems);
  const returnFeeAmount = returnFee;
  
  // Preparar productos
  const products = order.rental_items.map(item => ({
    name: item.product_config.name,
    name_en: item.product_config.name_en,
    quantity: item.quantity,
    days: item.days,
    unitPrice: item.unit_price,
    subtotal: item.subtotal
  }));
  
  // Calcular comisiones (ejemplo: 30% de ganancia)
  const supplierCost = order.rental_items.reduce((total, item) => 
    total + (item.product_config?.supplier_cost * item.quantity * item.days), 0
  );
  const commission = subtotal - supplierCost;
  const initialPayment = subtotal - supplierCost;
  
  // Calcular pago inicial (diferencia entre precio público y costo proveedor)
  // const initialPayment = order.rental_items.reduce((total, item) => {
  //   const priceDifference = (item.unit_price - (item.product_config?.supplier_cost || 0)) * item.quantity * item.days;
  //   return total + priceDifference;
  // }, 0);
  
  // Calcular valor a pagar al recoger (total - pago inicial)
  const pickupPayment = order.total_amount - Math.max(initialPayment, 0);
  
  // Calcular total que debe cobrar el proveedor (supplierCost + returnFeeAmount)
  const supplierTotalAmount = supplierCost + returnFeeAmount;
  
  return {
    // Cliente
    customerName: `${order.customer?.first_name || ''} ${order.customer?.last_name || ''}`.trim() || 'Cliente',
    customerEmail: order.customer?.email || '',
    customerPhone: order.customer?.phone || '',
    customerNationality: order.customer?.nationality || '',
    
    // Pedido
    orderNumber: order.order_number,
    orderDate: new Date(order.created_at).toLocaleDateString('es-ES'),
    startDate: new Date(order.start_date).toLocaleDateString('es-ES'),
    startTime: order.start_time,
    endDate: new Date(order.end_date).toLocaleDateString('es-ES'),
    endTime: order.end_time,
    pickup: order.pickup === 'santa-cruz' ? 'Santa Cruz - Agency Office' : 'Hotel - ' + order.pickup,
    returnIsland: order.return_island === 'santa-cruz' ? 'Santa Cruz' : 'San Cristóbal',
    rentalDays: order.rental_items[0]?.days || 1,
    
    // Productos
    products,
    
    // Negocio
    supplierCost,
    supplierTotalAmount,
    commission,

    // Financiero
    subtotal: subtotal,
    taxAmount: order.tax_amount,
    totalAmount: order.total_amount + supplierTotalAmount,
    returnFeeAmount: returnFeeAmount,
    returnFee: returnFee,
    initialPayment: Math.max(initialPayment, 0),
    pickupPayment: Math.max(pickupPayment, 0),
    
    // Enlaces
    sizesSelectionID: `https://galapagos.viajes/sizes?orderId=${order.id}`
    
  };
}

function convertVariablesToHandlebarsFormat(variables: EmailVariables) {
  return {
    globalData: Object.keys(variables).reduce((acc, key) => {
      const value = variables[key as keyof EmailVariables];
      
      // Manejar arrays de manera especial
      if (Array.isArray(value)) {
        acc[key] = { 
          data: value.map(item => {
            if (typeof item === 'object' && item !== null) {
              // Para objetos dentro del array, validar cada propiedad
              const safeItem = {} as any;
              Object.keys(item).forEach(itemKey => {
                const itemValue = (item as any)[itemKey];
                safeItem[itemKey] = (typeof itemValue === 'number' && (!isFinite(itemValue) || isNaN(itemValue))) ? 0 : itemValue;
              });
              return safeItem;
            }
            return item;
          })
        };
      } else {
        // Validar que el valor no sea infinito o NaN
        const safeValue = (typeof value === 'number' && (!isFinite(value) || isNaN(value))) ? 0 : value;
        acc[key] = { data: safeValue };
      }
      return acc;
    }, {} as any)
  };
}

export async function sendAutomaticEmails(orderData: OrderEmailData, templateType?: string, language: string = 'es') {
  try {
    const variables = await prepareEmailVariables(orderData);
    const handlebarsVars = convertVariablesToHandlebarsFormat(variables);
    
    // Obtener plantillas por tipo
    // Obtener todas las plantillas con una sola consulta
    const allTemplates = await listTemplates();
    const emailPromises: (() => Promise<any>)[] = [];
    
    // Función para obtener el subject según el tipo de plantilla y idioma
    const getSubjectByType = (templateType: string, lang: string) => {
      if (lang === 'en') {
        switch (templateType) {
          case 'customer':
            return `Congratulations! You have confirmed your equipment rental`;
          case 'business_owner':
            return `New Reservation - Order #${orderData.order.order_number} - Commission: $${variables.commission?.toFixed(2)}`;
          case 'supplier':
            return `New Equipment Reservation - Order #${orderData.order.order_number}`;
          default:
            return `Notification - Order #${orderData.order.order_number}`;
        }
      } else {
        switch (templateType) {
          case 'customer':
            return `En hora buena, haz confirmado el alquiler de tus equipos`;
          case 'business_owner':
            return `Nueva Reserva - Pedido #${orderData.order.order_number} - Comisión: $${variables.commission?.toFixed(2)}`;
          case 'supplier':
            return `Nueva Reserva de Equipos - Pedido #${orderData.order.order_number}`;
          default:
            return `Notificación - Pedido #${orderData.order.order_number}`;
        }
      }
    };
    
    // Filtrar plantillas por tipo e idioma si se especifica
    let filteredTemplates = allTemplates;
    
    if (templateType) {
      filteredTemplates = filteredTemplates.filter(template => template.template_type === templateType);
    }
    
    // Filtrar por idioma: solo para plantillas de customer usar el idioma del pedido,
    // para business_owner y supplier siempre usar español
    filteredTemplates = filteredTemplates.filter(template => {
      if (template.template_type === 'customer') {
        // Para customer, usar el idioma del pedido
        return (template as any).language === language || !(template as any).language;
      } else {
        // Para business_owner y supplier, siempre usar español
        return (template as any).language === 'es' || !(template as any).language;
      }
    });
    
    // Procesar plantillas filtradas
    for (const template of filteredTemplates) {
      // console.log(`🔍 Procesando plantilla: "${template.name}" (${template.template_type})`);
      // console.log(`📧 Recipients: ${JSON.stringify(template.recipient_emails)}`);
      // console.log(`📝 Tiene HTML: ${!!template.html_published}`);
      
      if (template.html && template.template_type) {

        let templateHTML = template.html;
        
        let recipients = template.recipient_emails ? [...template.recipient_emails] : [];
        let finalHtml = Handlebars.compile(templateHTML)(handlebarsVars);
        finalHtml = stripConditionalSections(finalHtml, handlebarsVars);
        
        // Para plantillas de cliente, agregar el email del cliente
        if (template.template_type === 'customer' && orderData.order.customer?.email) {
          if (!recipients.includes(orderData.order.customer.email)) {
            recipients.push(orderData.order.customer.email);
          }
        }
        
        // console.log(`📬 Recipients finales para "${template.name}": ${JSON.stringify(recipients)}`);
        
        // Usar el subject de la plantilla si existe, sino usar el por defecto
        // Para customer usar el idioma del pedido, para otros tipos siempre español
        const subjectLanguage = template.template_type === 'customer' ? language : 'es';
        const emailSubject = template.subject && template.subject.trim() 
          ? template.subject 
          : getSubjectByType(template.template_type, subjectLanguage);
          
        console.log(`📋 Subject: "${emailSubject}"`);
        
        // Crear función para enviar el email (no la promesa directamente)
        emailPromises.push(() => 
          resend.emails.send({
            from: FROM,
            to: recipients,
            subject: emailSubject,
            html: finalHtml,
          })
        );
      } else {
        console.log(`⚠️ Saltando plantilla "${template.name}": ${!template.html ? 'Sin HTML' : 'Sin tipo'}`);
      }
    }
    
    // Función helper para delay
    const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
    
    // Enviar emails secuencialmente para respetar rate limit de Resend (2 req/sec)
    console.log(`📤 Enviando ${emailPromises.length} emails secuencialmente...`);
    const results = [];
    
    for (let i = 0; i < emailPromises.length; i++) {
      try {
        // console.log(`📧 Enviando email ${i + 1}/${emailPromises.length}...`);
        const result = await emailPromises[i](); // Ejecutar la función para obtener la promesa
        results.push({ status: 'fulfilled', value: result });
        // console.log(`✅ Email ${i + 1} enviado exitosamente:`, result);
        
        // Delay de 600ms entre emails (permite ~1.6 emails/segundo, bajo el límite de 2/segundo)
        if (i < emailPromises.length - 1) {
          // console.log(`⏳ Esperando 600ms antes del siguiente email...`);
          await delay(600);
        }
      } catch (error) {
        results.push({ status: 'rejected', reason: error });
        console.error(`❌ Error enviando email ${i + 1}:`, error);
        
        // Mantener el delay incluso si hay error
        if (i < emailPromises.length - 1) {
          // console.log(`⏳ Esperando 600ms antes del siguiente email...`);
          await delay(600);
        }
      }
    }
    
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
    // Obtener el pedido básico
    const { data: order, error: orderError } = await supabaseAdmin
      .from('rental_orders')
      .select('*')
      .eq('id', orderId)
      .single();
    
    if (orderError || !order) {
      console.error('Error obteniendo pedido:', orderError);
      return null;
    }
    
    // Obtener los items del pedido con información del producto
    const { data: items, error: itemsError } = await supabaseAdmin
      .from('rental_items')
      .select(`
        *,
        product_config (
          id,
          product_type,
          product_subtype,
          size,
          public_price,
          supplier_cost,
          name,
          name_en
        )
      `)
      .eq('order_id', orderId);
    
    if (itemsError) {
      console.error('Error obteniendo items:', itemsError);
      return null;
    }
    
    // Obtener información del cliente
    const { data: customer, error: customerError } = await supabaseAdmin
      .from('users')
      .select('id, first_name, last_name, email, phone, nationality')
      .eq('id', order.customer_id)
      .single();
    
    if (customerError) {
      console.error('Error obteniendo cliente:', customerError);
      return null;
    }

    // Mapear los datos a la estructura esperada por OrderEmailData
    const mappedOrder: OrderEmailData = {
      order: {
        // Datos básicos de la orden (RentalOrder)
        id: order.id,
        order_number: order.order_number,
        auth_code: order.auth_code,
        bin: order.bin,
        customer_id: order.customer_id,
        dev_reference: order.dev_reference,
        total_amount: order.total_amount,
        tax_amount: order.tax_amount,
        status: order.status,
        start_date: order.start_date,
        end_date: order.end_date,
        start_time: order.start_time,
        end_time: order.end_time,
        pickup: order.pickup,
        return_island: order.return_island,
        payment_method: order.payment_method,
        status_detail: order.status_detail,
        payment_status: order.payment_status,
        transaction_id: order.transaction_id,
        notes: order.notes,
        created_at: order.created_at,
        updated_at: order.updated_at,
        
        // Items mapeados con product_config
        rental_items: (items || []).map(item => ({
          id: item.id,
          order_id: item.order_id,
          product_config_id: item.product_config_id,
          quantity: item.quantity,
          days: item.days,
          unit_price: item.unit_price,
          subtotal: item.subtotal,
          created_at: item.created_at,
          updated_at: item.updated_at,
          product_config: {
            id: item.product_config.id,
            product_type: item.product_config.product_type,
            product_subtype: item.product_config.product_subtype,
            size: item.product_config.size,
            public_price: item.product_config.public_price,
            supplier_cost: item.product_config.supplier_cost,
            name: item.product_config.name,
            name_en: item.product_config.name_en,
          }
        })),
        
        // Datos del cliente
        customer: {
          id: customer.id,
          first_name: customer.first_name,
          last_name: customer.last_name,
          email: customer.email,
          phone: customer.phone,
          nationality: customer.nationality
        }
      }
    };

    return mappedOrder;
  } catch (error) {
    console.error('Error en getOrderDataForEmails:', error);
    return null;
  }
}