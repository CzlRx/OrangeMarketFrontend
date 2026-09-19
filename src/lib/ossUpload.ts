import { ApiError, uploadApi } from './api'
import type { OssCallbackResult, OssSignDTO, OssUploadScene } from '../types'

export const OSS_MAX_BYTES: Record<OssUploadScene, number> = {
  avatar: 2 * 1024 * 1024,
  product: 5 * 1024 * 1024,
}

export const OSS_IMAGE_ACCEPT =
  'image/jpeg,image/png,image/webp,image/gif,.jpg,.jpeg,.png,.webp,.gif'

const ALLOWED_CONTENT_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])

const FILENAME_CONTENT_TYPES: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
}

export interface OssUploadResult {
  accessUrl: string
  objectKey: string
  callbackSucceeded: boolean
}

export function resolveImageContentType(file: File): string {
  let type = (file.type || '').trim().toLowerCase()
  const semicolon = type.indexOf(';')
  if (semicolon >= 0) type = type.slice(0, semicolon).trim()
  if (type === 'image/jpg') type = 'image/jpeg'
  if (ALLOWED_CONTENT_TYPES.has(type)) return type

  const name = file.name.trim().toLowerCase().replace(/\\/g, '/')
  const base = name.slice(name.lastIndexOf('/') + 1)
  const dot = base.lastIndexOf('.')
  if (dot >= 0) {
    const fromName = FILENAME_CONTENT_TYPES[base.slice(dot)]
    if (fromName) return fromName
  }
  throw new Error('仅支持 jpeg/png/webp/gif 图片')
}

export function assertImageFile(file: File, scene: OssUploadScene) {
  if (!file || file.size <= 0) {
    throw new Error('请选择图片文件')
  }
  const maxBytes = OSS_MAX_BYTES[scene]
  if (file.size > maxBytes) {
    const maxMb = Math.round(maxBytes / (1024 * 1024))
    throw new Error(scene === 'avatar' ? `头像不能超过 ${maxMb}MB` : `商品图不能超过 ${maxMb}MB`)
  }
  return resolveImageContentType(file)
}

function optionalSignField(sign: OssSignDTO, key: keyof OssSignDTO): string {
  return sign[key] ?? ''
}

function requireSignField(sign: OssSignDTO, key: keyof OssSignDTO): string {
  const value = sign[key]
  if (!value) {
    throw new Error('签名信息不完整，请稍后重试')
  }
  return value
}

function extractOssError(text: string): string {
  const message = text.match(/<Message>([\s\S]*?)<\/Message>/i)?.[1]?.trim()
  const code = text.match(/<Code>([\s\S]*?)<\/Code>/i)?.[1]?.trim()
  if (message && code) return `${code}：${message}`
  if (message) return message
  try {
    const json = JSON.parse(text) as { message?: string; Message?: string }
    if (json.message) return json.message
    if (json.Message) return json.Message
  } catch {
    // not JSON
  }
  const trimmed = text.replace(/\s+/g, ' ').trim()
  return trimmed ? trimmed.slice(0, 180) : ''
}

async function postObject(
  sign: OssSignDTO,
  file: File,
  contentType: string,
  scene: OssUploadScene,
  userId: string,
): Promise<OssUploadResult> {
  const host = requireSignField(sign, 'host')
  const form = new FormData()
  form.append('success_action_status', '200')
  form.append('policy', requireSignField(sign, 'policy'))
  form.append('x-oss-signature', requireSignField(sign, 'signature'))
  form.append('x-oss-signature-version', requireSignField(sign, 'x_oss_signature_version'))
  form.append('x-oss-credential', requireSignField(sign, 'x_oss_credential'))
  form.append('x-oss-date', requireSignField(sign, 'x_oss_date'))
  form.append('key', requireSignField(sign, 'key'))
  form.append('x-oss-security-token', requireSignField(sign, 'security_token'))
  const callback = optionalSignField(sign, 'callback')
  if (callback) {
    form.append('callback', callback)
  }
  form.append('Content-Type', contentType)
  form.append('x:scene', scene)
  form.append('x:userId', userId)
  form.append('file', file)

  const uploadUrl = import.meta.env.DEV ? '/oss-upload' : host
  let response: Response
  try {
    response = await fetch(uploadUrl, { method: 'POST', body: form })
  } catch {
    throw new Error('无法直传到对象存储，请检查 OSS 跨域配置或网络')
  }

  const text = await response.text()
  if (response.ok) {
    try {
      const payload = JSON.parse(text) as { code?: number; message?: string; data?: OssCallbackResult }
      if (typeof payload.code === 'number' && payload.code !== 0) {
        throw new Error(payload.message || '上传回调失败')
      }
      return {
        accessUrl: payload.data?.accessUrl || sign.accessUrl,
        objectKey: payload.data?.object || sign.key,
        callbackSucceeded: true,
      }
    } catch (err) {
      if (err instanceof SyntaxError) {
        return {
          accessUrl: sign.accessUrl,
          objectKey: sign.key,
          callbackSucceeded: false,
        }
      }
      throw err
    }
  }

  // 回调失败时 OSS 常返回 203，对象通常已写入，可用签发时的 accessUrl 落库
  if (response.status === 203) {
    return {
      accessUrl: sign.accessUrl,
      objectKey: sign.key,
      callbackSucceeded: false,
    }
  }

  throw new Error(extractOssError(text) || `上传失败（HTTP ${response.status}）`)
}

export async function uploadImageToOss(options: {
  file: File
  scene: OssUploadScene
  userId: string
}): Promise<OssUploadResult> {
  const { file, scene, userId } = options
  if (!userId) {
    throw new Error('请先登录')
  }
  const contentType = assertImageFile(file, scene)
  let sign: OssSignDTO
  try {
    sign = await uploadApi.sign({
      scene,
      filename: file.name,
      contentType,
    })
  } catch (err) {
    if (err instanceof ApiError && err.message.includes('对象存储未配置')) {
      const result = await uploadApi.direct(scene, file)
      return {
        accessUrl: result.accessUrl,
        objectKey: result.object,
        callbackSucceeded: true,
      }
    }
    if (err instanceof ApiError) throw err
    throw err instanceof Error ? err : new Error('获取上传签名失败')
  }
  return postObject(sign, file, contentType, scene, userId)
}
