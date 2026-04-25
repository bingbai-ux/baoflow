'use client'

import { BarcodeBars } from '@/components/dashboard/barcode-bars'
import { Gauge } from '@/components/dashboard/gauge'

interface BarcodeBarsClientProps {
  data: number[]
  width?: number
  height?: number
}

export function BarcodeBarsClient({ data, width, height }: BarcodeBarsClientProps) {
  return <BarcodeBars data={data} width={width} height={height} />
}

interface GaugeClientProps {
  value: number
  size?: number
}

export function GaugeClient({ value, size }: GaugeClientProps) {
  return <Gauge value={value} size={size} />
}
