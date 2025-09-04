"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { CalendarIcon, CheckIcon, Waves, MapPin, ChevronDownIcon, PlusIcon } from "lucide-react"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { cn } from "@/lib/utils"

type WetsuitType = "corto" | "largo" | null
type AgeGroup = "adulto" | "niño" | null
type AdultSize = "XS" | "S" | "M" | "L" | "XL" | "XXL"
type KidsSize = "4-6" | "6-8" | "8-10" | "10-12" | "12-14" | "14-16"
type Size = AdultSize | KidsSize | null
type FootSize = "35" | "36" | "37" | "38" | "39" | "40" | "41" | "42" | "43" | "44" | "45" | null
type Island = "santa-cruz" | "san-cristobal" | null

interface RentalState {
  wetsuitType: WetsuitType
  ageGroup: AgeGroup
  size: Size
  includeSnorkel: boolean | undefined
  includeFins: boolean | undefined
  footSize: FootSize
  startDate: Date | undefined
  endDate: Date | undefined
  startTime: string | null
  endTime: string | null
  returnIsland: Island
}

export default function GalapagosRentalPage() {
  const [currentStep, setCurrentStep] = useState(1)
  const [completedRentals, setCompletedRentals] = useState<RentalState[]>([])
  const [rental, setRental] = useState<RentalState>({
    wetsuitType: null,
    ageGroup: null,
    size: null,
    includeSnorkel: undefined,
    includeFins: undefined,
    footSize: null,
    startDate: undefined,
    endDate: undefined,
    startTime: null,
    endTime: null,
    returnIsland: null,
  })

  const calculateRentalPrice = (rentalItem: RentalState): number => {
    if (!rentalItem.startDate || !rentalItem.endDate || !rentalItem.startTime || !rentalItem.endTime) return 0

    const startDateTime = new Date(rentalItem.startDate)
    const endDateTime = new Date(rentalItem.endDate)

    // Calcular días basado en las reglas de horario
    let days = 0
    const startHour = Number.parseInt(rentalItem.startTime.split(":")[0])
    const endHour = Number.parseInt(rentalItem.endTime.split(":")[0])

    // Día de inicio: si retira hasta las 4pm se cobra ese día
    if (startHour <= 16) {
      days += 1
    }

    // Días intermedios
    const daysDiff = Math.floor((endDateTime.getTime() - startDateTime.getTime()) / (1000 * 60 * 60 * 24))
    if (daysDiff > 1) {
      days += daysDiff - 1
    }

    // Día de devolución: si entrega desde las 5pm se cobra ese día
    if (daysDiff >= 1 && endHour >= 17) {
      days += 1
    }

    let total = 0

    // Precio del traje
    const wetsuitPrice = rentalItem.ageGroup === "adulto" ? 25 : 15
    total += wetsuitPrice * days

    // Precio de extras
    if (rentalItem.includeSnorkel === true) total += 10 * days
    if (rentalItem.includeFins === true) total += 10 * days

    if (rentalItem.returnIsland === "san-cristobal") {
      total += 5
    }

    return total
  }

  const getTotalPrice = (): number => {
    const completedTotal = completedRentals.reduce((sum, rental) => sum + calculateRentalPrice(rental), 0)
    const currentTotal = calculateRentalPrice(rental)
    return completedTotal + currentTotal
  }

  const getTotalSteps = (): number => {
    return rental.includeFins ? 6 : 5
  }

  const canProceed = (step: number): boolean => {
    switch (step) {
      case 1:
        return rental.wetsuitType !== null
      case 2:
        return rental.ageGroup !== null && rental.size !== null
      case 3:
        return true // Optional step
      case 4:
        if (!rental.includeFins) return true
        return rental.footSize !== null
      case 5:
        return (
          rental.startDate !== undefined &&
          rental.endDate !== undefined &&
          rental.startTime !== null &&
          rental.endTime !== null
        )
      case 6:
        return rental.returnIsland !== null
      default:
        return false
    }
  }

  const goToNextStep = () => {
    const totalSteps = getTotalSteps()
    let nextStep = currentStep + 1

    // Si estamos en el paso 2 (edad y talla) y no hemos interactuado con el paso 3 (equipo de snorkel),
    // establecer explícitamente los valores por defecto para que se registre como visitado
    if (currentStep === 2) {
      // Al avanzar del paso 2, establecer explícitamente los valores de snorkel/aletas
      // para que se registre como visitado el paso 3
      if (rental.includeSnorkel === undefined && rental.includeFins === undefined) {
        setRental({
          ...rental,
          includeSnorkel: false,
          includeFins: false
        })
      }
    } else if (currentStep === 3 && rental.includeFins === false) {
      // Si no escogió aletas, saltar al paso 5
      nextStep = 5
    }

    if (nextStep <= totalSteps && canProceed(currentStep)) {
      setCurrentStep(nextStep)
      setTimeout(() => {
        const nextStepElement = document.getElementById(`step-${nextStep}`)
        if (nextStepElement) {
          nextStepElement.scrollIntoView({ behavior: "smooth", block: "center" })
        }
      }, 100)
    }
  }

  const finishRental = () => {
    setCompletedRentals([...completedRentals, rental])
    setRental({
      wetsuitType: null,
      ageGroup: null,
      size: null,
      includeSnorkel: undefined,
      includeFins: undefined,
      footSize: null,
      startDate: undefined,
      endDate: undefined,
      startTime: null,
      endTime: null,
      returnIsland: null,
    })
    setCurrentStep(1)
    setTimeout(() => {
      const firstStepElement = document.getElementById(`step-1`)
      if (firstStepElement) {
        firstStepElement.scrollIntoView({ behavior: "smooth", block: "center" })
      }
    }, 100)
  }

  const getAvailableSizes = (): (AdultSize | KidsSize)[] => {
    if (rental.ageGroup === "niño") {
      return ["4-6", "6-8", "8-10", "10-12", "12-14", "14-16"]
    }
    return ["XS", "S", "M", "L", "XL", "XXL"]
  }

  const getVisibleSteps = (): number[] => {
    const visible = []
    // Siempre mostrar el paso 1
    visible.push(1)
    
    // Mostrar paso 2 solo si el paso 1 está completo o si es el paso actual
    if (rental.wetsuitType || currentStep >= 2) {
      visible.push(2)
    }
    
    // Mostrar paso 3 solo si el paso 2 está completo o si es el paso actual
    if ((rental.ageGroup && rental.size) || currentStep >= 3) {
      visible.push(3)
    }
    
    // Mostrar paso 4 (talla de aletas) solo si se seleccionaron aletas Y el paso 3 está completo o es el paso actual
    if (rental.includeFins === true && ((rental.includeSnorkel !== undefined || rental.includeFins !== undefined) || currentStep >= 4)) {
      visible.push(4)
    }
    
    // Mostrar paso 5 (fechas) solo si:
    // - Con aletas: el paso 4 está completo o es el paso actual
    // - Sin aletas: el paso 3 está completo o es el paso actual
    if ((rental.includeFins === true && rental.footSize && currentStep >= 4) || 
        (rental.includeFins === false && (rental.includeSnorkel !== undefined || rental.includeFins !== undefined) && currentStep >= 3) || 
        currentStep >= 5) {
      visible.push(5)
    }
    
    // Mostrar paso 6 (isla de devolución) solo si el paso 5 está completo o es el paso actual
    if ((rental.startDate && rental.endDate && rental.startTime && rental.endTime && currentStep >= 5) || currentStep >= 6) {
      visible.push(6)
    }
    
    return visible
  }

  const getTimeOptions = () => {
    const times = []
    for (let hour = 7; hour <= 20; hour++) {
      times.push(`${hour.toString().padStart(2, "0")}:00`)
    }
    return times
  }

  const renderStep = (step: number) => {
    switch (step) {
      case 1:
        return (
          <Card id="step-1">
            <CardHeader className="text-center">
              <CardTitle className="text-2xl text-balance">Elige tu tipo de traje</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <Button
                  variant={rental.wetsuitType === "corto" ? "default" : "outline"}
                  className="h-24 flex-col gap-2"
                  onClick={() => {
                    setRental({ ...rental, wetsuitType: "corto" })
                  }}
                >
                  <div className="text-2xl">🏊‍♂️</div>
                  <span>Wetsuit Corto 3mm</span>
                </Button>
                <Button
                  variant={rental.wetsuitType === "largo" ? "default" : "outline"}
                  className="h-24 flex-col gap-2"
                  onClick={() => {
                    setRental({ ...rental, wetsuitType: "largo" })
                  }}
                >
                  <div className="text-2xl">🤿</div>
                  <span>Wetsuit Largo 3mm</span>
                </Button>
              </div>
            </CardContent>
          </Card>
        )

      case 2:
        return (
          <Card id="step-2">
            <CardHeader className="text-center">
              <CardTitle className="text-2xl text-balance">Edad y Talla</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <div className="grid grid-cols-2 gap-2">
                  {(["adulto", "niño"] as const).map((ageGroup) => (
                    <Button
                      key={ageGroup}
                      variant={rental.ageGroup === ageGroup ? "default" : "outline"}
                      size="sm"
                      onClick={() => {
                        setRental({ ...rental, ageGroup, size: null })
                      }}
                    >
                      {ageGroup.charAt(0).toUpperCase() + ageGroup.slice(1)}
                    </Button>
                  ))}
                </div>
              </div>

              {rental.ageGroup && (
                <div>
                  <h3 className="font-medium mb-3">Talla</h3>
                  <div className="grid grid-cols-3 gap-2">
                    {getAvailableSizes().map((size) => (
                      <Button
                        key={size}
                        variant={rental.size === size ? "default" : "outline"}
                        size="sm"
                        onClick={() => {
                          setRental({ ...rental, size })
                        }}
                      >
                        {size}
                      </Button>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )

      case 3:
        return (
          <Card id="step-3">
            <CardHeader className="text-center">
              <CardTitle className="text-2xl text-balance">Equipo de Snorkel</CardTitle>
              <p className="text-muted-foreground">Opcional - Selecciona lo que necesites</p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <Button
                  variant={rental.includeSnorkel ? "default" : "outline"}
                  className="h-24 flex-col gap-2"
                  onClick={() => setRental({ ...rental, includeSnorkel: !rental.includeSnorkel })}
                >
                  <div className="text-2xl">🤿</div>
                  <span>Snorkel - $10/día</span>
                  {/* {rental.includeSnorkel && <CheckIcon className="h-4 w-4" />} */}
                </Button>
                <Button
                  variant={rental.includeFins ? "default" : "outline"}
                  className="h-24 flex-col gap-2"
                  onClick={() => setRental({ ...rental, includeFins: !rental.includeFins })}
                >
                  <div className="text-2xl">🦶</div>
                  <span>Aletas - $10/día</span>
                  {/* {rental.includeFins && <CheckIcon className="h-4 w-4" />} */}
                </Button>
              </div>
            </CardContent>
          </Card>
        )

      case 4:
        if (!rental.includeFins) return null

        return (
          <Card id="step-4">
            <CardHeader className="text-center">
              <CardTitle className="text-2xl text-balance">Talla de Aletas</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid grid-cols-4 gap-2">
                  {(["35", "36", "37", "38", "39", "40", "41", "42", "43", "44", "45"] as const).map((size) => (
                    <Button
                      key={size}
                      variant={rental.footSize === size ? "default" : "outline"}
                      size="sm"
                      onClick={() => {
                        setRental({ ...rental, footSize: size })
                      }}
                    >
                      {size}
                    </Button>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        )

      case 5:
        return (
          <Card className="w-full max-w-md" id="step-5">
            <CardHeader className="text-center">
              <CardTitle className="text-2xl text-balance">Fechas y Horarios de Alquiler</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Fecha y hora de inicio</label>
                <div className="flex gap-2">
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "flex-1 justify-start text-left font-normal",
                          !rental.startDate && "text-muted-foreground",
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {rental.startDate ? format(rental.startDate, "dd/MM", { locale: es }) : "Fecha"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={rental.startDate}
                        onSelect={(date) => setRental({ ...rental, startDate: date })}
                        disabled={(date) => date < new Date()}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                  <Select
                    value={rental.startTime || ""}
                    onValueChange={(time) => setRental({ ...rental, startTime: time })}
                  >
                    <SelectTrigger className="w-24">
                      <SelectValue placeholder="Hora" />
                    </SelectTrigger>
                    <SelectContent>
                      {getTimeOptions().map((time) => (
                        <SelectItem key={time} value={time}>
                          {time}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Fecha y hora de devolución</label>
                <div className="flex gap-2">
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "flex-1 justify-start text-left font-normal",
                          !rental.endDate && "text-muted-foreground",
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {rental.endDate ? format(rental.endDate, "dd/MM", { locale: es }) : "Fecha"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={rental.endDate}
                        onSelect={(date) => setRental({ ...rental, endDate: date })}
                        disabled={(date) => date < (rental.startDate || new Date())}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                  <Select
                    value={rental.endTime || ""}
                    onValueChange={(time) => setRental({ ...rental, endTime: time })}
                  >
                    <SelectTrigger className="w-24">
                      <SelectValue placeholder="Hora" />
                    </SelectTrigger>
                    <SelectContent>
                      {getTimeOptions().map((time) => (
                        <SelectItem key={time} value={time}>
                          {time}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>
        )

      case 6:
        return (
          <Card className="w-full max-w-md" id="step-6">
            <CardHeader className="text-center">
              <CardTitle className="text-2xl text-balance">Isla de Devolución</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <Button
                  variant={rental.returnIsland === "santa-cruz" ? "default" : "outline"}
                  className="h-24 flex-col gap-2"
                  onClick={() => {
                    setRental({ ...rental, returnIsland: "santa-cruz" })
                  }}
                >
                  <MapPin className="h-6 w-6" />
                  <span>Santa Cruz</span>
                </Button>
                <Button
                  variant={rental.returnIsland === "san-cristobal" ? "default" : "outline"}
                  className="h-24 flex-col gap-2"
                  onClick={() => {
                    setRental({ ...rental, returnIsland: "san-cristobal" })
                  }}
                >
                  <MapPin className="h-6 w-6" />
                  <span>San Cristóbal (+$5)</span>
                </Button>
              </div>
            </CardContent>
          </Card>
        )

      default:
        return null
    }
  }

  const getCompletedSteps = (): number => {
    let completed = 0

    if (rental.wetsuitType) completed = 1
    if (rental.ageGroup && rental.size) completed = 2
    // Solo incrementar a 3 si el usuario ha interactuado con el paso 3 (equipo de snorkel)
    // y ha seleccionado explícitamente true o false (no undefined)
    if (completed >= 2 && (rental.includeSnorkel === true || rental.includeSnorkel === false || 
                           rental.includeFins === true || rental.includeFins === false)) {
      completed = 3
    }

    // Solo contar paso 4 si se escogieron aletas
    if (rental.includeFins === true && rental.footSize) completed = 4
    else if (rental.includeFins === false && completed >= 3) {
      // Si no escogió aletas, saltar al paso 5 en el conteo
      if (rental.startDate && rental.endDate && rental.startTime && rental.endTime) completed = 4 // Equivale al paso 5 real
      if (rental.returnIsland) completed = 5 // Equivale al paso 6 real
    } else if (rental.includeFins === true && completed >= 4) {
      if (rental.startDate && rental.endDate && rental.startTime && rental.endTime) completed = 5
      if (rental.returnIsland) completed = 6
    }

    return completed
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Waves className="h-8 w-8 text-primary" />
              <h1 className="text-xl font-bold">Galápagos Dive Rental</h1>
            </div>
            <Badge variant="secondary" className="hidden sm:flex">
              {getCompletedSteps()} de {getTotalSteps()} completados
            </Badge>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative py-12 bg-gradient-to-b from-primary/5 to-background">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-4xl font-bold text-balance mb-4">Renta tu Equipo de Buceo</h2>
          <p className="text-xl text-muted-foreground text-pretty max-w-2xl mx-auto">
            Explora las maravillas submarinas de las Islas Galápagos con nuestro equipo profesional de buceo y snorkel
          </p>
        </div>
      </section>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="flex flex-col lg:flex-row gap-8 items-start">
          {/* Left Column - Steps */}
          <div className="flex-1 flex flex-col items-center space-y-8">
            {completedRentals.length > 0 && (
              <div className="w-full max-w-md">
                <Collapsible>
                  <CollapsibleTrigger asChild>
                    <Button variant="outline" className="w-full justify-between bg-transparent">
                      <span>Alquileres Configurados ({completedRentals.length})</span>
                      <ChevronDownIcon className="h-4 w-4" />
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="space-y-2 mt-2">
                    {completedRentals.map((completedRental, index) => (
                      <Card key={index} className="p-3 w-full max-w-md">
                        <div className="text-sm space-y-1">
                          <div className="font-medium">Alquiler #{index + 1}</div>
                          <div>
                            Traje: {completedRental.wetsuitType} ({completedRental.ageGroup} - {completedRental.size})
                          </div>
                          {(completedRental.includeSnorkel || completedRental.includeFins) && (
                            <div>
                              Extras:{" "}
                              {[
                                completedRental.includeSnorkel && "Snorkel",
                                completedRental.includeFins && `Aletas (${completedRental.footSize})`,
                              ]
                                .filter(Boolean)
                                .join(", ")}
                            </div>
                          )}
                          <div>Total: ${calculateRentalPrice(completedRental)}</div>
                        </div>
                      </Card>
                    ))}
                  </CollapsibleContent>
                </Collapsible>
              </div>
            )}

            {/* Progress Bar */}
            <div className="w-full max-w-md">
              <div className="flex justify-between text-sm text-muted-foreground mb-2">
                <span>Progreso</span>
                <span>
                  {getCompletedSteps()}/{getTotalSteps()}
                </span>
              </div>
              <div className="w-full bg-muted rounded-full h-2">
                <div
                  className="bg-primary h-2 rounded-full transition-all duration-300"
                  style={{ width: `${(getCompletedSteps() / getTotalSteps()) * 100}%` }}
                />
              </div>
            </div>

            <div className="space-y-8 w-full flex flex-col items-center">
              {getVisibleSteps().map((step) => (
                <div key={step} className="w-full max-w-md transition-all duration-500">
                  {renderStep(step)}
                </div>
              ))}
            </div>

            {/* Next button that appears after the last visible step */}
            {currentStep < getTotalSteps() && canProceed(currentStep) && (
              <div className="flex gap-2 w-full max-w-md">
                <Button onClick={goToNextStep} size="lg" className="flex-1">
                  Siguiente
                </Button>
              </div>
            )}

            {currentStep === getTotalSteps() && canProceed(getTotalSteps()) && (
              <div className="flex gap-2 w-full max-w-md">
                <Button onClick={finishRental} variant="outline" size="lg" className="flex-1 bg-transparent">
                  <PlusIcon className="h-4 w-4 mr-2" />
                  Rentar Otro
                </Button>
                <Button size="lg" className="flex-1">
                  Finalizar Reserva
                </Button>
              </div>
            )}
          </div>

          {/* Desktop and Tablet Sticky Summary */}
          <div className="hidden md:block w-full md:w-80 md:sticky md:top-24">
            <Card className="bg-muted/50 w-full max-w-md">
              <CardHeader>
                <CardTitle className="text-lg">Resumen de tu Alquiler</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                {completedRentals.map((completedRental, index) => (
                  <div key={index} className="border-b pb-2 mb-2">
                    <div className="font-medium text-xs text-muted-foreground mb-1">Alquiler #{index + 1}</div>
                    <div className="flex justify-between">
                      <span>Traje {completedRental.ageGroup}:</span>
                      <span className="font-medium">${completedRental.ageGroup === "adulto" ? "25" : "15"}/día</span>
                    </div>
                    {completedRental.includeSnorkel && (
                      <div className="flex justify-between">
                        <span>Snorkel:</span>
                        <span className="font-medium">$10/día</span>
                      </div>
                    )}
                    {completedRental.includeFins && (
                      <div className="flex justify-between">
                        <span>Aletas:</span>
                        <span className="font-medium">$10/día</span>
                      </div>
                    )}
                    <div className="flex justify-between font-medium">
                      <span>Subtotal:</span>
                      <span>${calculateRentalPrice(completedRental)}</span>
                    </div>
                  </div>
                ))}

                {/* Alquiler actual */}
                {rental.wetsuitType && (
                  <>
                    {completedRentals.length > 0 && (
                      <div className="font-medium text-xs text-muted-foreground mb-1">Alquiler Actual</div>
                    )}
                    <div className="flex justify-between">
                      <span>Traje:</span>
                      <span className="font-medium">Wetsuit {rental.wetsuitType}</span>
                    </div>
                  </>
                )}
                {rental.ageGroup && rental.size && (
                  <div className="flex justify-between">
                    <span>Talla:</span>
                    <span className="font-medium">
                      {rental.size} ({rental.ageGroup}) - ${rental.ageGroup === "adulto" ? "25" : "15"}/día
                    </span>
                  </div>
                )}
                {(rental.includeSnorkel || rental.includeFins) && (
                  <div className="flex justify-between">
                    <span>Extras:</span>
                    <span className="font-medium">
                      {[
                        rental.includeSnorkel && "Snorkel ($10/día)",
                        rental.includeFins && rental.footSize && `Aletas (${rental.footSize}) ($10/día)`,
                        rental.includeFins && !rental.footSize && "Aletas ($10/día)",
                      ]
                        .filter(Boolean)
                        .join(", ")}
                    </span>
                  </div>
                )}
                {rental.startDate && rental.endDate && rental.startTime && rental.endTime && (
                  <div className="flex justify-between">
                    <span>Fechas:</span>
                    <span className="font-medium">
                      {format(rental.startDate, "dd/MM", { locale: es })} {rental.startTime} -{" "}
                      {format(rental.endDate, "dd/MM", { locale: es })} {rental.endTime}
                    </span>
                  </div>
                )}
                {rental.returnIsland && (
                  <div className="flex justify-between">
                    <span>Devolución:</span>
                    <span className="font-medium">
                      {rental.returnIsland === "santa-cruz" ? "Santa Cruz" : "San Cristóbal (+$5)"}
                    </span>
                  </div>
                )}

                {getTotalPrice() > 0 && (
                  <div className="border-t pt-2 mt-2">
                    <div className="flex justify-between font-bold text-base">
                      <span>Total:</span>
                      <span>${getTotalPrice()}</span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-background border-t">
            <div className="p-4">
              <Card className="bg-muted/50 w-full max-w-md mx-auto">
                <CardContent className="p-3">
                  <div className="flex items-center justify-between text-sm">
                    <div>
                      <div className="font-medium">
                        {completedRentals.length > 0 ? `${completedRentals.length + 1} alquileres` : "Resumen"}
                      </div>
                      {rental.wetsuitType && (
                        <div className="text-xs text-muted-foreground">
                          Wetsuit {rental.wetsuitType} ({rental.ageGroup} - {rental.size})
                        </div>
                      )}
                    </div>
                    {getTotalPrice() > 0 && (
                      <div className="text-right">
                        <div className="font-bold">${getTotalPrice()}</div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t bg-card/50 mt-16">
        <div className="container mx-auto px-4 py-8 text-center">
          <div className="flex items-center justify-center gap-2 mb-4">
            <Waves className="h-6 w-6 text-primary" />
            <span className="font-semibold">Galápagos Dive Rental</span>
          </div>
          <p className="text-muted-foreground text-sm">Explora las Islas Galápagos de manera responsable y segura</p>
        </div>
      </footer>
    </div>
  )
}
