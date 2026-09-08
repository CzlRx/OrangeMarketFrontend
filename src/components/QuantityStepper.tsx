import { Minus, Plus } from 'lucide-react'

interface QuantityStepperProps {
  value: number
  onChange: (value: number) => void
  min?: number
  max?: number
  disabled?: boolean
}

export function QuantityStepper({
  value,
  onChange,
  min = 1,
  max = 99,
  disabled = false,
}: QuantityStepperProps) {
  return (
    <div className="quantity-stepper" aria-label="数量">
      <button
        type="button"
        disabled={disabled || value <= min}
        onClick={() => onChange(Math.max(min, value - 1))}
        aria-label="减少数量"
      >
        <Minus size={14} />
      </button>
      <span>{value}</span>
      <button
        type="button"
        disabled={disabled || value >= max}
        onClick={() => onChange(Math.min(max, value + 1))}
        aria-label="增加数量"
      >
        <Plus size={14} />
      </button>
    </div>
  )
}
