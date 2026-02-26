"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover"
import { SheetPopoverContent } from "@/components/ui/sheet-popover-content"
import { CalendarIcon, Loader2 } from "lucide-react"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { toast } from "sonner"
import { supabase } from "@/lib/supabaseClient"

interface AdminDatePickerProps {
  orderId: string
  initialDate: string
  initialTime: string
  type: 'start' | 'end'
  otherDate: string
  otherTime: string
  onUpdate: () => void
}

export function AdminDatePicker({
  orderId,
  initialDate,
  initialTime,
  type,
  otherDate,
  otherTime,
  onUpdate
}: AdminDatePickerProps) {
  const [date, setDate] = useState<Date | undefined>(
    initialDate ? new Date(initialDate + 'T12:00:00') : undefined
  )
  const [time, setTime] = useState<string | null>(initialTime ? initialTime.slice(0, 5) : null)
  const [isOpen, setIsOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  // Reset state when props change
  useEffect(() => {
    if (initialDate) {
      // Create date at noon to avoid timezone issues
      const datePart = initialDate.split('T')[0]
      const [y, m, d] = datePart.split('-').map(Number)
      setDate(new Date(y, m - 1, d, 12, 0, 0, 0))
    }
    setTime(initialTime ? initialTime.slice(0, 5) : null)
  }, [initialDate, initialTime])

  const timeSlots = [
    { time: "07:00", available: true },
    { time: "08:00", available: true },
    { time: "09:00", available: true },
    { time: "10:00", available: true },
    { time: "11:00", available: true },
    { time: "12:00", available: true },
    { time: "13:00", available: true },
    { time: "14:00", available: true },
    { time: "15:00", available: true },
    { time: "16:00", available: true },
    { time: "17:00", available: true },
    { time: "18:00", available: true },
    { time: "19:00", available: true },
    { time: "20:00", available: true },
  ]

  const handleDateSelect = (newDate: Date | undefined) => {
    if (!newDate) return
    setDate(newDate)
    setTime(null) // Reset time when date changes to force selection
  }

  const isTimeDisabled = (timeSlot: string) => {
    if (!date) return true
    
    const selectedDateStr = format(date, 'yyyy-MM-dd')
    const otherDateStr = otherDate.split('T')[0]
    const otherTimeStr = otherTime ? otherTime.slice(0, 5) : ''

    if (selectedDateStr === otherDateStr) {
      if (type === 'start') {
        // Start time must be strictly before end time
        return timeSlot >= otherTimeStr
      } else {
        // End time must be strictly after start time
        return timeSlot <= otherTimeStr
      }
    }
    
    return false
  }

  const handleTimeSelect = async (newTime: string) => {
    if (!date) return

    // Optimistic update removed to prevent selecting invalid times
    // setTime(newTime)
    
    // Validate
    const selectedDateStr = format(date, 'yyyy-MM-dd')
    const otherDateStr = otherDate.split('T')[0]
    
    let isValid = true
    let errorMessage = ''

    const otherTimeStr = otherTime ? otherTime.slice(0, 5) : ''

    if (type === 'start') {
      // Start date must be before or equal to end date (otherDate)
      if (selectedDateStr > otherDateStr) {
        isValid = false
        errorMessage = 'La fecha de inicio no puede ser posterior a la fecha de fin'
      } else if (selectedDateStr === otherDateStr) {
        // Same day, check times
        if (newTime >= otherTimeStr) {
           isValid = false
           errorMessage = 'La hora de inicio debe ser anterior a la hora de fin'
        }
      }
    } else {
      // End date must be after or equal to start date (otherDate)
      if (selectedDateStr < otherDateStr) {
        isValid = false
        errorMessage = 'La fecha de fin no puede ser anterior a la fecha de inicio'
      } else if (selectedDateStr === otherDateStr) {
         if (newTime <= otherTimeStr) {
             isValid = false
             errorMessage = 'La hora de fin debe ser posterior a la hora de inicio'
         }
      }
    }

    if (!isValid) {
      toast.error(errorMessage)
      // Deselect time if it was selected (though UI should prevent this via disabled state)
      setTime(null)
      return
    }

    // Set valid time and save
    setTime(newTime)
    await saveChanges(selectedDateStr, newTime)
  }

  const saveChanges = async (dateStr: string, timeStr: string) => {
    setLoading(true)
    try {
      const updateData = type === 'start' 
        ? { start_date: dateStr, start_time: timeStr }
        : { end_date: dateStr, end_time: timeStr }

      const { error } = await supabase
        .from('rental_orders')
        .update(updateData)
        .eq('id', orderId)

      if (error) throw error

      toast.success('Fecha actualizada correctamente')
      setIsOpen(false)
      onUpdate()
    } catch (error) {
      console.error('Error updating order:', error)
      toast.error('Error al actualizar la fecha')
    } finally {
      setLoading(false)
    }
  }

  const boundaryDate = otherDate ? (() => {
    const datePart = otherDate.split('T')[0]
    const [y, m, d] = datePart.split('-').map(Number)
    return new Date(y, m - 1, d, 0, 0, 0, 0)
  })() : undefined

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          className="justify-start text-left font-normal p-0 h-auto hover:bg-transparent hover:text-primary"
        >
          <div className="flex items-center gap-2">
            <span>{date ? format(date, "d MMM yyyy", { locale: es }) : ''} - {time}</span>
            <CalendarIcon className="h-3 w-3 opacity-50" />
          </div>
        </Button>
      </PopoverTrigger>
      <SheetPopoverContent className="w-auto p-0 max-h-[75vh] overflow-y-auto">
        <div className="flex">
          <Calendar
            mode="single"
            selected={date}
            onSelect={handleDateSelect}
            className="p-2 sm:pe-5"
            locale={es}
            defaultMonth={date || new Date()}
            disabled={
              boundaryDate
                ? type === 'start'
                  ? { after: boundaryDate }
                  : { before: boundaryDate }
                : undefined
            }
          />
          <div className="w-40 border-l">
            <div className="py-4">
              <div className="space-y-3">
                <div className="flex h-5 shrink-0 items-center px-5">
                  <p className="text-sm font-medium">
                    {date ? format(date, "EEEE, d", { locale: es }) : 'Seleccionar'}
                  </p>
                </div>
                <div
                  className="h-[250px] overflow-y-auto px-5 touch-pan-y"
                  style={{ WebkitOverflowScrolling: "touch" }}
                >
                  <div className="grid gap-1.5">
                    {timeSlots.map(({ time: timeSlot }) => (
                      <Button
                        key={timeSlot}
                        variant={time === timeSlot ? "default" : "outline"}
                        size="sm"
                        className="w-full"
                        onClick={() => handleTimeSelect(timeSlot)}
                        disabled={loading || isTimeDisabled(timeSlot)}
                      >
                        {loading && time === timeSlot ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          timeSlot
                        )}
                      </Button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </SheetPopoverContent>
    </Popover>
  )
}
