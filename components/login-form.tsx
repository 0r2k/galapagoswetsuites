'use client'

import { FormEvent, useState } from "react"
import { useRouter } from "next/navigation"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { supabase } from "@/lib/supabaseClient"

interface LoginFormProps extends React.ComponentProps<"form"> {
  redirectUrl?: string;
}

export function LoginForm({
  className,
  redirectUrl = '/admin',
  ...props
}: LoginFormProps) {
  const router = useRouter()
  const [email, setEmail] = useState<string>('')
  const [password, setPassword] = useState<string>('')
  const [errorMsg, setErrorMsg] = useState<string>('')
  const [loading, setLoading] = useState<boolean>(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setErrorMsg('')

    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      
      if (error) {
        setErrorMsg(error.message)
      } else {
        router.push(redirectUrl)
      }
    } catch (err) {
      console.error('Error interno durante el inicio de sesión:', err)
      setErrorMsg('Ocurrió un error interno. Por favor, inténtelo de nuevo más tarde.')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return <div>Loading...</div>
  }

  return (
    <form onSubmit={handleSubmit} className={cn("flex flex-col gap-6", className)} {...props}>
      <div className="grid gap-8">
        <div className="grid gap-3">
          <Label htmlFor="email">Email</Label>
          <Input
            className="bg-white"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <div className="grid gap-3">
          <div className="flex items-center">
            <Label htmlFor="password">Contraseña</Label>
          </div>
          <Input
            className="bg-white"
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        <Button type="submit" className="w-full" disabled={loading}>
          Ingresar
        </Button>
        {errorMsg && <p style={{ color: 'crimson' }}>{errorMsg}</p>}
      </div>

    </form>
  )
}
