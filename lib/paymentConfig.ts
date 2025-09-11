import { supabase } from './supabaseClient'

export interface PaymentConfig {
  id: number
  environment: 'prod' | 'stg'
  api_url: string
  app_code: string
  app_key: string
  is_active: boolean
  created_at: string
  updated_at: string
}

// Obtener configuración activa
export async function getActivePaymentConfig(): Promise<PaymentConfig | null> {
  const { data, error } = await supabase
    .from('payment_config')
    .select('*')
    .eq('is_active', true)
    .single()
  
  if (error) {
    console.error('Error fetching active payment config:', error)
    return null
  }
  
  return data
}

// Obtener todas las configuraciones
export async function getAllPaymentConfigs(): Promise<PaymentConfig[]> {
  const { data, error } = await supabase
    .from('payment_config')
    .select('*')
    .order('environment')
  
  if (error) {
    console.error('Error fetching payment configs:', error)
    return []
  }
  
  return data || []
}

// Activar una configuración específica
export async function activatePaymentConfig(id: number): Promise<boolean> {
  // Primero desactivar todas las configuraciones
  const { error: deactivateError } = await supabase
    .from('payment_config')
    .update({ is_active: false })
    .neq('id', 0) // Actualizar todas las filas
  
  if (deactivateError) {
    console.error('Error deactivating configs:', deactivateError)
    return false
  }
  
  // Luego activar la configuración específica
  const { error: activateError } = await supabase
    .from('payment_config')
    .update({ is_active: true, updated_at: new Date().toISOString() })
    .eq('id', id)
  
  if (activateError) {
    console.error('Error activating config:', activateError)
    return false
  }
  
  return true
}

// Actualizar configuración
export async function updatePaymentConfig(
  id: number, 
  updates: Partial<Omit<PaymentConfig, 'id' | 'created_at' | 'updated_at'>>
): Promise<boolean> {
  const { error } = await supabase
    .from('payment_config')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
  
  if (error) {
    console.error('Error updating payment config:', error)
    return false
  }
  
  return true
}

// Crear configuración inicial si no existe
export async function initializePaymentConfigs(): Promise<boolean> {
  const configs = await getAllPaymentConfigs()
  
  if (configs.length === 0) {
    // Insertar configuraciones por defecto
    const defaultConfigs = [
      {
        environment: 'stg' as const,
        api_url: 'https://ccapi-stg.paymentez.com',
        app_code: 'staging_app_code',
        app_key: 'staging_app_key',
        is_active: true
      },
      {
        environment: 'prod' as const,
        api_url: 'https://ccapi.paymentez.com',
        app_code: 'production_app_code',
        app_key: 'production_app_key',
        is_active: false
      }
    ]
    
    const { error } = await supabase
      .from('payment_config')
      .insert(defaultConfigs)
    
    if (error) {
      console.error('Error inserting default configs:', error)
      return false
    }
  }
  
  return true
}