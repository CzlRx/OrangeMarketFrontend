export interface ApiResult<T> {
  code: number
  message: string
  data: T
  timestamp: number
}

export interface PageData<T> {
  list: T[]
  total: number
  page: number
  pageSize: number
  hasMore: boolean
}

export interface CaptchaData {
  image: string
  captchaKey: string
}

export interface SmsInfo {
  cooldown: number
  expiresIn: number
}

export interface LoginData {
  Token: string
  expiresAt: string
  newUser: boolean
}

export type UserStatus = 'active' | 'disabled'
export type Gender = 0 | 1 | 2

export interface AuthMeUser {
  id: number
  phone: string | null
  nickname: string | null
  avatarUrl: string | null
  gender: number | null
  birthday: string | null
  status: UserStatus | null
  role: string | null
  lastLoginAt: string | null
  createdAt: string | null
  updatedAt: string | null
  deletedAt: number | null
}

export interface UserProfile {
  id: string
  phone: string
  nickname: string
  avatarUrl?: string
  gender?: number
  birthday?: string
  status: UserStatus
  role: string
  lastLoginAt?: string
}

export interface Category {
  id: string
  name: string
  eyebrow: string
  color: string
  icon: string
  isVirtual: boolean
}

export interface Product {
  id: string
  name: string
  subtitle?: string
  categoryId?: string
  images: string[]
  videoUrl?: string
  price: number
  originalPrice: number
  stock: number
  sales: number
  rating?: number
  reviewCount: number
  description?: string
  shippingFee: number
  tags: string[]
}

export interface ProductDetail {
  product: Product
  reviews: Review[]
  reviewSummary: ReviewSummary
}

export interface Review {
  id: string
  productId: string
  userName: string
  avatar?: string
  content: string
  rating: number
  anonymous: boolean
  createdAt: string
}

export interface ReviewSummary {
  average: number
  reviewCount: number
  goodRate: number
  allCount: number
  goodCount: number
  mediumCount: number
  badCount: number
}

export interface ProductReviewPage extends PageData<Review> {
  summary: ReviewSummary
}

export interface ReviewItemRequest {
  orderItemId: string
  productId: string
  rating: number
  content: string
  anonymous?: boolean
}

export interface SubmitReviewsRequest {
  reviews: ReviewItemRequest[]
}

export interface PendingReviewItem {
  orderId: string
  orderNo: string
  orderItemId: string
  productId: string
  productName: string
  productImage: string
  unitPrice: number
  quantity: number
  lineAmount: number
}

export interface ReviewSubmissionResult {
  orderId: string
  orderNo: string
  status: OrderStatus
  reviewIds: string[]
  completedAt?: string
}

export interface CartItem {
  id: string
  productId: string
  quantity: number
  selected: boolean
  product?: Product
  effectivePrice?: number
  shippingFee?: number
}

export interface Cart {
  items: CartItem[]
  selectedCount: number
  subtotal: number
  shippingFee: number
  total: number
}

export interface Address {
  id: string
  receiver: string
  phone: string
  provinceCode?: string
  province: string
  cityCode?: string
  city: string
  districtCode?: string
  district: string
  detail: string
  isDefault: boolean
}

export type OrderStatus =
  | 'pending_payment'
  | 'pending_shipment'
  | 'pending_receipt'
  | 'pending_review'
  | 'completed'
  | 'cancelled'
  | 'refunding'
  | 'refunded'

export interface OrderItem {
  id: string
  productId: string
  productName: string
  productImage: string
  unitPrice: number
  quantity: number
  lineAmount: number
}

export interface OrderAddress {
  receiver: string
  phone: string
  province: string
  city: string
  district: string
  detail: string
}

export interface Order {
  id: string
  orderNo: string
  status: OrderStatus
  items: OrderItem[]
  address: OrderAddress
  subtotal: number
  shippingFee: number
  total: number
  buyerRemark?: string
  paymentMethod?: string
  trackingNo?: string
  createdAt: string
  paymentExpireAt?: string
  paidAt?: string
  shippedAt?: string
  receivedAt?: string
  completedAt?: string
  cancelledAt?: string
}

export interface OrderPreview {
  items: OrderItem[]
  address: OrderAddress
  subtotal: number
  shippingFee: number
  total: number
  paymentExpireMinutes: number
}

export interface OrderCreateResult {
  orderId: string
  orderNo: string
  status: OrderStatus
  total: number
  paymentExpireAt: string
}

export interface PayOrderResult {
  orderId: string
  orderNo: string
  status: OrderStatus
  paymentMethod: string
  paidAt?: string
  qrCode?: string
  outTradeNo?: string
  expireAt?: string
}

export interface FavoriteItem {
  id: string
  productId: string
  createdAt: string
  product?: Product
}

export interface BrowseHistoryItem {
  id: string
  productId: string
  viewedAt: string
  product?: Product
}

export interface SearchHistoryItem {
  id: string
  keyword: string
  searchedAt: string
}

export interface AdminShipmentResult {
  orderId: string
  orderNo: string
  status: OrderStatus
  trackingNo: string
  shippedAt: string
}

export interface AdminUserStatusResult {
  userId: string
  status: UserStatus
  role: string
}

export interface SmsRequest {
  phone: string
  purpose?: string
  captchaKey: string
  captchaCode: string
}

export interface LoginRequest {
  phone: string
  smsCode: string
}

export interface UserProfileUpdateRequest {
  nickname?: string
  gender?: Gender
  birthday?: string
  avatarUrl?: string
}

export type OssUploadScene = 'avatar' | 'product'

export interface OssSignRequest {
  scene: OssUploadScene
  filename: string
  contentType: string
}

/** POST /api/uploads/sign 的 data；部分字段为 Jackson @JsonProperty 的下划线名 */
export interface OssSignDTO {
  dir: string
  key: string
  host: string
  accessUrl: string
  policy: string
  security_token: string
  signature: string
  x_oss_credential: string
  x_oss_date: string
  x_oss_signature_version: string
  callback?: string
}

export interface OssCallbackResult {
  object: string
  accessUrl: string
  scene: OssUploadScene
}

export interface AdminProductImagesRequest {
  coverImage?: string
  images?: string[]
}

export interface AddressRequest {
  receiver: string
  phone: string
  provinceCode?: string
  province: string
  cityCode?: string
  city: string
  districtCode?: string
  district: string
  detail: string
  isDefault?: boolean
}

export interface AddCartItemRequest {
  productId: string
  quantity: number
}

export interface UpdateCartItemRequest {
  quantity?: number
  selected?: boolean
}

export interface CartSelectionRequest {
  selected: boolean
}

export interface CartMergeItemRequest {
  productId: string
  quantity: number
  selected?: boolean
}

export interface CartMergeRequest {
  items: CartMergeItemRequest[]
}

export interface CartOrderPreviewRequest {
  cartItemIds: string[]
  addressId: string
}

export interface CartOrderCreateRequest {
  cartItemIds: string[]
  addressId: string
  buyerRemark?: string
}

export interface DirectOrderCreateRequest {
  productId: string
  quantity: number
  addressId: string
  buyerRemark?: string
}

export interface PayOrderRequest {
  paymentMethod: 'alipay' | 'mock'
}

export interface CancelOrderRequest {
  reason?: string
}

export interface FavoriteRequest {
  productId: string
}

export interface BrowseHistoryRequest {
  productId: string
}

export interface SearchHistoryRequest {
  keyword: string
}

export interface IdBatchRequest {
  ids: string[]
}

export interface ShipOrderRequest {
  trackingNo: string
}

/* ------------------------------ 人工客服 ------------------------------ */

export type ServiceSessionStatus = 'active' | 'closed'

export type ServiceSenderType = 'user' | 'agent' | 'system'

export interface ServiceSession {
  id: string
  userId: string
  userNickname?: string
  agentId?: string
  status: ServiceSessionStatus
  createdAt: string
  closedAt?: string
}

export interface ServiceMessage {
  id: string
  sessionId: string
  senderType: ServiceSenderType
  senderId?: string | null
  content: string
  createdAt: string
}

export type WsClientSend =
  | { type: 'ping' }
  | { type: 'chat'; sessionId: string; content: string }

export type WsServerEvent =
  | { type: 'connected'; userId: number; agent: boolean }
  | { type: 'disconnected' }
  | { type: 'pong' }
  | {
      type: 'chat'
      sessionId: string
      messageId: string
      senderType: ServiceSenderType
      senderId?: string
      content: string
      createdAt?: string
    }
  | { type: 'session_claimed'; sessionId: string; agentId: string }
  | {
      type: 'session_closed'
      sessionId: string
      closedBy: 'user' | 'agent'
      closerId?: string
      messageId: string
      senderType: 'system'
      content: string
      createdAt?: string
    }
  | { type: 'error'; message: string }
