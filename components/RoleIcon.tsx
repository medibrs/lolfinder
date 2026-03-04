"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

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
      Top: "/roles/top.svg",
      Jungle: "/roles/jungle.svg",
      Mid: "/roles/mid.svg",
      ADC: "/roles/adc.svg",
      Support: "/roles/support.svg",
    }
    return icons[roleName] || "/roles/top.svg"
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
