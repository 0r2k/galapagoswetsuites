import { supabase } from './supabaseClient'

// Tipos para el contenido del sitio (SEO y hero)
export interface SiteContent {
  id: string
  hero_title_es?: string | null
  hero_subtitle_es?: string | null
  hero_description_es?: string | null
  hero_sizes_note_es?: string | null
  hero_title_en?: string | null
  hero_subtitle_en?: string | null
  hero_description_en?: string | null
  hero_sizes_note_en?: string | null
  seo_title_es?: string | null
  seo_description_es?: string | null
  og_title_es?: string | null
  og_description_es?: string | null
  og_image_es?: string | null
  twitter_title_es?: string | null
  twitter_description_es?: string | null
  seo_title_en?: string | null
  seo_description_en?: string | null
  og_title_en?: string | null
  og_description_en?: string | null
  og_image_en?: string | null
  twitter_title_en?: string | null
  twitter_description_en?: string | null
  created_at: string
  updated_at: string
}

// Tipos para la configuración de productos
export type ProductType = 'wetsuit' | 'wetsuit_adult' | 'wetsuit_kids' | 'snorkel' | 'fins' | string;
export type WetsuitSubtype = 'corto' | 'largo';
export type AdultSize = 'XS' | 'S' | 'M' | 'L' | 'XL' | 'XXL';
export type KidsSize = '4-6' | '6-8' | '8-10' | '10-12' | '12-14' | '14-16';
export type FootSize = '35' | '36' | '37' | '38' | '39' | '40' | '41' | '42' | '43' | '44' | '45';
export type Island = 'santa-cruz' | 'san-cristobal';
export type BookingMode = 'rental_range' | 'single_day_no_fixed_time';

// Interfaces para las tablas
export interface ProductConfig {
  id: string;
  product_type: ProductType;
  booking_mode?: BookingMode;
  product_subtype?: WetsuitSubtype;
  size?: string;
  supplier_cost: number;
  public_price: number;
  tax_percentage: number;
  stock_quantity: number;
  active: boolean;
  quantity_question?: string | null;
  quantity_question_en?: string | null;
  cta_label?: string | null;
  cta_label_en?: string | null;
  created_at: string;
  updated_at: string;
}

export interface AdditionalFee {
  id: string;
  fee_type: string;
  location?: Island;
  amount: number;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Customer {
  id: string;
  user_id: string | null;
  first_name?: string;
  last_name?: string;
  email: string;
  phone?: string;
  nationality?: string;
  uid: string | null;
  created_at: string;
  updated_at: string;
}

export type OrderStatus = 'pending' | 'confirmed' | 'completed' | 'cancelled';
export type PaymentStatus = 'pending' | 'paid' | 'refunded';

export interface RentalOrder {
  id: string;
  order_number: number;
  auth_code: string;
  bin: string;
  customer_id: string;
  dev_reference: string;
  total_amount: number;
  tax_amount: number;
  status: number;
  start_date: string | null;
  end_date: string | null;
  start_time: string | null;
  end_time: string | null;
  pickup?: string | null;
  return_island?: Island | null;
  service_date?: string | null;
  service_end_date?: string | null;
  payment_method?: string;
  status_detail?: string;
  payment_status: PaymentStatus;
  transaction_id?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface RentalItem {
  id: string;
  order_id: string;
  product_config_id: string;
  quantity: number;
  days: number;
  unit_price: number;
  subtotal: number;
  created_at: string;
  updated_at: string;
}

// Funciones para interactuar con la base de datos

// Productos
export async function getProducts() {
  const { data, error } = await supabase
    .from('product_config')
    .select('*')
    .eq('active', true);
  
  if (error) throw error;
  return data as ProductConfig[];
}

export async function getProductsByType(productType: ProductType) {
  const { data, error } = await supabase
    .from('product_config')
    .select('*')
    .eq('product_type', productType)
    .eq('active', true);
  
  if (error) throw error;
  return data as ProductConfig[];
}

export async function getProductById(id: string) {
  const { data, error } = await supabase
    .from('product_config')
    .select('*')
    .eq('id', id)
    .single();
  
  if (error) throw error;
  return data as ProductConfig;
}

export async function createProduct(product: Omit<ProductConfig, 'id' | 'created_at' | 'updated_at'>) {
  const { data, error } = await supabase
    .from('product_config')
    .insert([product])
    .select();
  
  if (error) throw error;
  return data[0] as ProductConfig;
}

export async function updateProduct(id: string, updates: Partial<ProductConfig>) {
  const { data, error } = await supabase
    .from('product_config')
    .update(updates)
    .eq('id', id)
    .select();
  
  if (error) throw error;
  return data[0] as ProductConfig;
}

// Tarifas adicionales
export async function getAdditionalFees() {
  const { data, error } = await supabase
    .from('additional_fees')
    .select('*')
    .eq('active', true);
  
  if (error) throw error;
  return data as AdditionalFee[];
}

export async function getAdditionalFeeByType(feeType: string) {
  const { data, error } = await supabase
    .from('additional_fees')
    .select('*')
    .eq('fee_type', feeType)
    .eq('active', true);
  
  if (error) throw error;
  return data as AdditionalFee[];
}

// Clientes
export async function getCurrentCustomer() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('user_id', user.id)
    .single();
  
  if (error && error.code !== 'PGRST116') throw error; // PGRST116 es el código para "no se encontraron resultados"
  return data as Customer | null;
}

export async function createCustomer(customer: Omit<Customer, 'id' | 'created_at' | 'updated_at'>) {
  // Verificar si ya existe un usuario con este email
  const { data: existingUser, error: userError } = await supabase
    .from('users')
    .select('*')
    .eq('email', customer.email)
    .maybeSingle();
  
  // maybeSingle() no lanza error si no encuentra resultados, solo devuelve null
  if (existingUser) {
    // Si el usuario ya existe, retornarlo en lugar de crear uno nuevo
    return existingUser as Customer;
  }
  
  const { data, error } = await supabase
    .from('users')
    .insert([customer])
    .select();
  
  if (error) throw error;
  return data[0] as Customer;
}

export async function updateCustomer(id: string, updates: Partial<Customer>) {
  const { data, error } = await supabase
    .from('users')
    .update(updates)
    .eq('id', id)
    .select();
  
  if (error) throw error;
  return data[0] as Customer;
}

// Órdenes
export async function createRentalOrder(order: Omit<RentalOrder, 'id' | 'created_at' | 'updated_at'>) {
  const { data, error } = await supabase
    .from('rental_orders')
    .insert([order])
    .select();
  
  if (error) throw error;
  return data[0] as RentalOrder;
}

export async function getRentalOrdersByCustomer(customerId: string) {
  const { data, error } = await supabase
    .from('rental_orders')
    .select('*')
    .eq('customer_id', customerId);
  
  if (error) throw error;
  return data as RentalOrder[];
}

export async function getRentalOrderById(id: string) {
  const { data, error } = await supabase
    .from('rental_orders')
    .select(`
      *,
      rental_items (*)
    `)
    .eq('id', id)
    .single();
  
  if (error) throw error;
  return data as RentalOrder & { rental_items: RentalItem[] };
}

export async function updateRentalOrder(id: string, updates: Partial<RentalOrder>) {
  const { data, error } = await supabase
    .from('rental_orders')
    .update(updates)
    .eq('id', id)
    .select();
  
  if (error) throw error;
  return data[0] as RentalOrder;
}

// Items de alquiler
export async function createRentalItems(items: Omit<RentalItem, 'id' | 'created_at' | 'updated_at'>[]) {
  const { data, error } = await supabase
    .from('rental_items')
    .insert(items)
    .select();
  
  if (error) throw error;
  return data as RentalItem[];
}

// Función para calcular el precio de alquiler basado en las reglas de negocio
export function calculateRentalDays(startDate: Date, endDate: Date, startTime: string, endTime: string): number {
  // Calcular días basado en las reglas de horario
  let days = 0;
  const startHour = Number.parseInt(startTime.split(":")[0]);
  const endHour = Number.parseInt(endTime.split(":")[0]);

  // Día de inicio: si retira hasta las 4pm se cobra ese día
  if (startHour <= 16) {
    days += 1;
  }

  // Días intermedios
  const daysDiff = Math.floor((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
  if (daysDiff > 1) {
    days += daysDiff - 1;
  }

  // Día de devolución: si entrega desde las 5pm se cobra ese día
  if (daysDiff >= 1 && endHour >= 17) {
    days += 1;
  }

  return days;
}

// Funciones para manejar el contenido del sitio
export async function getSiteContent(): Promise<SiteContent | null> {
  const { data, error } = await supabase
    .from('site_content')
    .select('*')
    .limit(1)
    .single()
  
  if (error) {
    console.error('Error fetching site content:', error)
    return null
  }
  return data as SiteContent
}

export async function updateSiteContent(id: string, updates: Partial<SiteContent>): Promise<SiteContent | null> {
  const { data, error } = await supabase
    .from('site_content')
    .update(updates)
    .eq('id', id)
    .select()
    .single()
  
  if (error) {
    console.error('Error updating site content:', error)
    return null
  }
  return data as SiteContent
}
