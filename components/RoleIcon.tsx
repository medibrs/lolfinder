import Image from 'next/image'

interface RoleIconProps {
  role: string
  size?: number
  className?: string
}

export default function RoleIcon({ role, size = 24, className = '' }: RoleIconProps) {
  const getRoleIcon = (role: string) => {
    const icons: { [key: string]: string } = {
      'Top': '/roles/top.svg',
      'Jungle': '/roles/jungle.svg',
      'Mid': '/roles/mid.svg',
      'ADC': '/roles/adc.svg',
      'Support': '/roles/support.svg'
    }
    return icons[role] || '/roles/top.svg' // fallback to top icon
  }

  return (
    <img
      src={getRoleIcon(role)}
      alt={role}
      width={size}
      height={size}
      className={`inline-block ${className}`}
      style={{ 
        width: size, 
        height: size,
        filter: 'brightness(0) invert(1)' // Makes SVG white
      }}
    />
  )
}
