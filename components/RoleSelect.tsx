import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Check, ChevronDown } from 'lucide-react'
import RoleIcon from './RoleIcon'

interface RoleSelectProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  required?: boolean
}

const ROLES = ['Top', 'Jungle', 'Mid', 'ADC', 'Support']

export default function RoleSelect({ value, onChange, placeholder = "Select Role", required = false }: RoleSelectProps) {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <div className="relative">
      <Button
        type="button"
        variant="outline"
        className="w-full px-3 py-2 bg-gray-800 border border-gray-700 text-white justify-between"
        onClick={() => setIsOpen(!isOpen)}
      >
        {value ? (
          <div className="flex items-center gap-2">
            <RoleIcon role={value} size={16} />
            <span>{value}</span>
          </div>
        ) : (
          <span className="text-gray-400">{placeholder}</span>
        )}
        <ChevronDown className="h-4 w-4" />
      </Button>

      {isOpen && (
        <div className="absolute z-10 w-full mt-1 bg-gray-800 border border-gray-700 rounded-md shadow-lg">
          {ROLES.map(role => (
            <button
              key={role}
              type="button"
              className="w-full px-3 py-2 text-left text-white hover:bg-gray-700 flex items-center gap-2"
              onClick={() => {
                onChange(role)
                setIsOpen(false)
              }}
            >
              <RoleIcon role={role} size={16} />
              <span>{role}</span>
              {value === role && <Check className="h-4 w-4 ml-auto" />}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
