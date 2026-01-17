'use client'

import { useState } from 'react'
import { Input } from '@/components/ui/input'
import {
  formatDisplayNumber,
  formatEditNumber,
  parseInputNumber,
  sanitizeInput,
} from '@/lib/formatters'

interface CurrencyInputProps {
  value: number | null | undefined
  onChange: (value: number | null) => void
  disabled?: boolean
  className?: string
  placeholder?: string
}

/**
 * Input de moneda con formato argentino
 * - Display: con separador de miles (1.234.567,89)
 * - Edición: sin separador de miles (1234567,89)
 * - Acepta solo dígitos y una coma decimal
 * - Máximo 2 decimales
 */
export function CurrencyInput({
  value,
  onChange,
  disabled,
  className,
  placeholder = '0',
}: CurrencyInputProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [editValue, setEditValue] = useState('')

  const displayValue = isEditing ? editValue : formatDisplayNumber(value)

  return (
    <Input
      type="text"
      inputMode="decimal"
      value={displayValue}
      onChange={(e) => {
        const sanitized = sanitizeInput(e.target.value)
        setEditValue(sanitized)
      }}
      onFocus={() => {
        setIsEditing(true)
        setEditValue(formatEditNumber(value))
      }}
      onBlur={() => {
        setIsEditing(false)
        const parsed = parseInputNumber(editValue)
        onChange(parsed)
      }}
      placeholder={placeholder}
      disabled={disabled}
      className={className}
    />
  )
}
