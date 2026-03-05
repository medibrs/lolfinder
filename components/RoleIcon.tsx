"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { cdnUrl } from "@/lib/cdn"

interface RoleIconProps extends React.ComponentProps<"img"> {
  role: string
  size?: number
}

export default function RoleIcon({
  role,
  size = 24,
  className,
  style,
  ...props
}: RoleIconProps) {
  const getRoleIconUri = (roleName: string) => {
    const icons: Record<string, string> = {
      Top: cdnUrl("/roles/top.svg"),
      Jungle: cdnUrl("/roles/jungle.svg"),
      Mid: cdnUrl("/roles/mid.svg"),
      ADC: cdnUrl("/roles/adc.svg"),
      Support: cdnUrl("/roles/support.svg"),
    }
    return icons[roleName] || cdnUrl("/roles/top.svg")
  }

  return (
    <img
      data-slot="role-icon"
      src={getRoleIconUri(role)}
      alt={role}
      className={cn("block", className)}
      style={{
        width: size,
        height: size,
        filter: "brightness(0) invert(1)", // Makes SVG white
        ...style,
      }}
      {...props}
    />
  )
}
