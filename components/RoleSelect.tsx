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
        className="w-full px-4 h-12 bg-slate-900/50 border-slate-800 text-slate-300 justify-between focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/20 rounded-xl transition-all"
        onClick={() => setIsOpen(!isOpen)}
      >
        {value ? (
          <div className="flex items-center gap-2">
            <RoleIcon role={value} size={16} className="brightness-125" />
            <span className="text-xs font-bold uppercase tracking-widest">{value}</span>
          </div>
        ) : (
          <span className="text-slate-600 text-xs font-bold uppercase tracking-widest">{placeholder}</span>
        )}
        <ChevronDown className={`h-4 w-4 text-slate-500 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
      </Button>

      {isOpen && (
        <div className="absolute z-50 w-full mt-2 bg-[#0b1221] border border-slate-800 rounded-xl shadow-2xl overflow-hidden backdrop-blur-md">
          {ROLES.map(role => (
            <button
              key={role}
              type="button"
              className="w-full px-4 py-3 text-left text-slate-400 hover:bg-slate-800/50 hover:text-cyan-400 transition-colors flex items-center gap-3 group"
              onClick={() => {
                onChange(role)
                setIsOpen(false)
              }}
            >
              <RoleIcon role={role} size={16} className="opacity-40 group-hover:opacity-100 transition-opacity" />
              <span className="text-[10px] font-bold uppercase tracking-[0.2em]">{role}</span>
              {value === role && <Check className="h-3 w-3 ml-auto text-cyan-500" />}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
