'use client'

import { useState, useEffect, Suspense, useRef } from 'react'
import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import interactionPlugin from '@fullcalendar/interaction'
import timeGridPlugin from '@fullcalendar/timegrid'
import esLocale from '@fullcalendar/core/locales/es'
import { supabase } from '@/lib/supabaseClient'
import { deleteSession } from '@/app/login/actions'
import { RentalOrder } from '@/lib/db'
import { useRouter, useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Badge } from '@/components/ui/badge'

interface CalendarEvent {
  id: string
  title: string
  start: string
  end: string
  backgroundColor: string
  borderColor: string
  textColor: string
  allDay: boolean
  extendedProps: {
    orderNumber: number
    customerName: string
    status: number
    totalAmount: number
    pickup?: string
    returnIsland: string
    notes?: string
    displayEndDate: string
  }
}

interface ExtendedRentalOrder extends RentalOrder {
  users: {
    first_name: string
    last_name: string
    email: string
  } | null
}

const PASTEL_COLORS = [
  '#60A5FA', // blue-400
  '#34D399', // emerald-400
  '#A78BFA', // violet-400
  '#F472B6', // pink-400
  '#FB923C', // orange-400
  '#2DD4BF', // teal-400
  '#818CF8', // indigo-400
  '#FB7185', // rose-400
]

export default function CalendarPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-screen">Cargando calendario...</div>}>
      <CalendarView />
    </Suspense>
  )
}

function CalendarView() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const initialDate = searchParams.get('date') || new Date().toISOString().split('T')[0]
  
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedEvent, setSelectedEvent] = useState<any | null>(null) // typing FullCalendar event object is tricky, using any for ease or checking docs
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [userRole, setUserRole] = useState<string | null>(null)

  const calendarRef = useRef<FullCalendar>(null)

  useEffect(() => {
    checkUserRole()
  }, [])

  // Sync URL date with calendar view
  useEffect(() => {
    const dateParam = searchParams.get('date')
    if (dateParam && calendarRef.current) {
      const calendarApi = calendarRef.current.getApi()
      const currentDate = calendarApi.getDate().toISOString().split('T')[0]
      // Only gotoDate if significant difference (e.g. month change) to avoid fighting with internal state
      // Simple check: if month is different
      const paramDateObj = new Date(dateParam)
      const currentDateObj = calendarApi.getDate()
      
      if (paramDateObj.getMonth() !== currentDateObj.getMonth() || 
          paramDateObj.getFullYear() !== currentDateObj.getFullYear()) {
          calendarApi.gotoDate(dateParam)
      }
    }
  }, [searchParams])

  const checkUserRole = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
        const { data } = await supabase.from('users').select('role').eq('email', user.email).single()
        if (data) setUserRole(data.role)
    }
  }

  const fetchOrders = async (start: Date, end: Date) => {
    setLoading(true)
    try {
      // Small delay to prevent flash if data is cached or very fast
      const { data, error } = await supabase
        .from('rental_orders')
        .select(`
          *,
          users!rental_orders_customer_id_fkey (
            first_name,
            last_name,
            email
          )
        `)
        .gte('status', 0) // Exclude failed/cancelled orders (status < 0)
        // Overlap check: start_date <= viewEnd AND end_date >= viewStart
        .lte('start_date', end.toISOString())
        .gte('end_date', start.toISOString())
        .order('created_at', { ascending: false })

      if (error) throw error

      // Sort orders by start date to optimize color assignment and avoid adjacent collisions
      const sortedOrders = [...(data as unknown as ExtendedRentalOrder[])].sort((a, b) => {
        const dateDiff = new Date(a.start_date).getTime() - new Date(b.start_date).getTime()
        if (dateDiff !== 0) return dateDiff
        return b.order_number - a.order_number
      })

      const processedOrders: { order: ExtendedRentalOrder, color: string }[] = []

      const formattedEvents: CalendarEvent[] = sortedOrders.map(order => {
        let color = '#EAB308' // Yellow/Warning default (Pending)

        if (order.status > 0) {
            // Assign color based on order number to ensure variety even without overlaps
            const colorIndex = order.order_number % PASTEL_COLORS.length
            color = PASTEL_COLORS[colorIndex]
        } else if (order.status < 0) {
            color = '#EF4444' // Red/Destructive
        }
        
        processedOrders.push({ order, color })

        // Calculate end date (exclusive) for FullCalendar
        const endDate = new Date(order.end_date)
        endDate.setDate(endDate.getDate() + 1)
        const exclusiveEndDate = endDate.toISOString().split('T')[0]

        const customerName = order.users 
          ? `${order.users.first_name} ${order.users.last_name}`
          : 'Cliente desconocido'

        return {
          id: order.id,
          title: `#${order.order_number} - ${customerName}`,
          start: order.start_date,
          end: exclusiveEndDate,
          backgroundColor: color,
          borderColor: color,
          textColor: '#ffffff',
          allDay: true,
          extendedProps: {
            orderNumber: order.order_number,
            customerName: customerName,
            status: order.status,
            totalAmount: order.total_amount,
            pickup: order.pickup,
            returnIsland: order.return_island,
            notes: order.notes || '',
            displayEndDate: order.end_date // Store original end date for display
          }
        }
      })

      setEvents(formattedEvents)
    } catch (error) {
      console.error('Error fetching orders:', error)
      toast.error('Error al cargar reservas')
    } finally {
      setLoading(false)
    }
  }

  const handleDatesSet = (dateInfo: any) => {
    fetchOrders(dateInfo.start, dateInfo.end)

    // Update URL with current month
    const viewDate = dateInfo.view.currentStart.toISOString().split('T')[0]
    const currentParam = searchParams.get('date')
    
    // Only update if different month/year to reduce noise
    const viewDateObj = new Date(viewDate)
    const currentParamObj = currentParam ? new Date(currentParam) : null

    if (!currentParamObj || 
        viewDateObj.getMonth() !== currentParamObj.getMonth() || 
        viewDateObj.getFullYear() !== currentParamObj.getFullYear()) {
        
        const params = new URLSearchParams(searchParams.toString())
        params.set('date', viewDate)
        router.replace(`/calendar?${params.toString()}`, { scroll: false })
    }
  }


  const handleEventClick = (info: any) => {
    setSelectedEvent(info.event)
    setIsModalOpen(true)
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    await deleteSession()
    router.push('/login') // Assuming login is at /login or /?
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
        <h1 className="text-3xl font-bold">Calendario de Reservas</h1>
        <div className="flex gap-4">
            {userRole === 'admin' && (
                <Button variant="outline" onClick={() => router.push('/admin')}>
                  Ir al Admin
                </Button>
            )}
            <Button onClick={handleLogout}>Cerrar Sesión</Button>
        </div>
      </div>

      <div className="bg-white p-6 rounded-lg shadow min-h-[600px] relative">
        {loading && (
           <div className="absolute inset-0 z-10 bg-white/80 flex items-center justify-center rounded-lg transition-opacity duration-200">
             <div className="bg-white px-4 py-2 rounded-md shadow-sm border text-sm font-medium">Actualizando...</div>
           </div>
        )}
        <FullCalendar
          ref={calendarRef}
          initialDate={initialDate}
          plugins={[dayGridPlugin, interactionPlugin, timeGridPlugin]}
          initialView="dayGridMonth"
          headerToolbar={{
            left: 'prev,next today',
            center: 'title',
            right: 'dayGridMonth,timeGridWeek'
          }}
          events={events}
          eventClick={handleEventClick}
          datesSet={handleDatesSet}
          height="auto"
          locale={esLocale}
          dayMaxEvents={true}
        />
      </div>

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Detalles de la Reserva</DialogTitle>
          </DialogHeader>
          {selectedEvent && (
            <div className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                    <span className="font-bold col-span-4 text-lg">{selectedEvent.extendedProps.customerName}</span>
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <p className="text-sm font-medium text-gray-500">Número de Orden</p>
                        <p className="font-mono">#{selectedEvent.extendedProps.orderNumber}</p>
                    </div>
                    <div>
                        <p className="text-sm font-medium text-gray-500">Estado</p>
                        <Badge 
                            variant={
                                selectedEvent.extendedProps.status > 0 ? 'default' : 
                                selectedEvent.extendedProps.status === 0 ? 'secondary' : 'destructive'
                            }
                            className="mt-1"
                        >
                            {selectedEvent.extendedProps.status === 0 ? 'Pendiente' :
                             selectedEvent.extendedProps.status > 0 ? 'Completado' :
                             'Cancelado/Fallido'}
                        </Badge>
                    </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <p className="text-sm font-medium text-gray-500">Inicio</p>
                        <p>{selectedEvent.startStr}</p>
                    </div>
                    <div>
                        <p className="text-sm font-medium text-gray-500">Fin</p>
                        <p>{selectedEvent.extendedProps.displayEndDate}</p>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <p className="text-sm font-medium text-gray-500">Recogida en</p>
                        <p className="capitalize">{selectedEvent.extendedProps.pickup || 'No especificado'}</p>
                    </div>
                    <div>
                        <p className="text-sm font-medium text-gray-500">Isla de Devolución</p>
                        <p className="capitalize">{selectedEvent.extendedProps.returnIsland?.replace('-', ' ')}</p>
                    </div>
                </div>
                
                {selectedEvent.extendedProps.notes && (
                    <div>
                        <p className="text-sm font-medium text-gray-500">Notas</p>
                        <p className="text-sm text-gray-700 mt-1 p-2 bg-gray-50 rounded border">{selectedEvent.extendedProps.notes}</p>
                    </div>
                )}
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setIsModalOpen(false)}>Cerrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}