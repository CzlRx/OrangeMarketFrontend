import { useEffect, useState } from 'react'
import QRCode from 'qrcode'

interface QrCodeImageProps {
  value: string
  size?: number
}

export function QrCodeImage({ value, size = 220 }: QrCodeImageProps) {
  const [src, setSrc] = useState('')
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let cancelled = false
    setSrc('')
    setFailed(false)
    void QRCode.toDataURL(value, {
      width: size,
      margin: 1,
      color: { dark: '#1a1a1a', light: '#ffffff' },
    })
      .then((url) => {
        if (!cancelled) setSrc(url)
      })
      .catch(() => {
        if (!cancelled) setFailed(true)
      })
    return () => {
      cancelled = true
    }
  }, [value, size])

  if (failed) {
    return <p className="payment-qr-error">二维码生成失败，请刷新页面重试</p>
  }
  if (!src) {
    return (
      <div
        className="payment-qr-placeholder"
        style={{ width: size, height: size }}
        aria-hidden
      />
    )
  }
  return (
    <img
      className="payment-qr-image"
      src={src}
      alt="支付宝付款码"
      width={size}
      height={size}
    />
  )
}
