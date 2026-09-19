import type {
  Address,
  AddressRequest,
  AddCartItemRequest,
  AdminProductImagesRequest,
  AdminShipmentResult,
  AdminUserStatusResult,
  AuthMeUser,
  BrowseHistoryItem,
  BrowseHistoryRequest,
  CancelOrderRequest,
  CaptchaData,
  Cart,
  CartMergeRequest,
  CartOrderCreateRequest,
  CartOrderPreviewRequest,
  CartSelectionRequest,
  Category,
  DirectOrderCreateRequest,
  FavoriteItem,
  FavoriteRequest,
  IdBatchRequest,
  LoginData,
  LoginRequest,
  Order,
  OrderCreateResult,
  OrderPreview,
  OrderStatus,
  OssSignDTO,
  OssSignRequest,
  PageData,
  PayOrderRequest,
  PayOrderResult,
  PendingReviewItem,
  Product,
  ProductDetail,
  ProductReviewPage,
  ReviewSubmissionResult,
  SearchHistoryItem,
  SearchHistoryRequest,
  ServiceMessage,
  ServiceSession,
  ShipOrderRequest,
  SmsInfo,
  SmsRequest,
  SubmitReviewsRequest,
  UpdateCartItemRequest,
  UserProfile,
  UserProfileUpdateRequest,
} from '../types'

export const TOKEN_KEY = 'orange_market_token'
export const USER_KEY = 'orange_market_user'
export const EXPIRES_KEY = 'orange_market_login_expires_at'
export const GUEST_CART_KEY = 'orange_market_guest_cart'

export class ApiError extends Error {
  code: number
  status: number

  constructor(message: string, code: number, status: number) {
    super(message)
    this.name = 'ApiError'
    this.code = code
    this.status = status
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  body?: unknown
  params?: Record<string, string | number | boolean | undefined | null>
  auth?: boolean
}

interface ApiPayload<T> {
  code?: number
  message?: string
  data?: T
}

function buildQuery(params?: RequestOptions['params']) {
  if (!params) return ''
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue
    search.set(key, String(value))
  }
  const query = search.toString()
  return query ? `?${query}` : ''
}

export function getToken() {
  return localStorage.getItem(TOKEN_KEY)
}

export function isSessionExpired() {
  const expiresAt = localStorage.getItem(EXPIRES_KEY)
  return Boolean(expiresAt && new Date(expiresAt).getTime() <= Date.now())
}

export function saveSession(data: LoginData) {
  localStorage.setItem(TOKEN_KEY, data.Token)
  localStorage.setItem(EXPIRES_KEY, data.expiresAt)
  window.dispatchEvent(new Event('orange_market_auth_updated'))
}

export function clearSession() {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(EXPIRES_KEY)
  localStorage.removeItem(USER_KEY)
  window.dispatchEvent(new Event('orange_market_auth_updated'))
}

function redirectToLogin() {
  const current = window.location.pathname + window.location.search
  if (!current.startsWith('/login')) {
    const redirect = encodeURIComponent(current)
    window.location.assign(`/login?redirect=${redirect}`)
  }
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, params } = options
  const auth = options.auth ?? true
  const headers: Record<string, string> = {}
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  const token = getToken()
  if (token && auth) headers.Authorization = `Bearer ${token}`

  const response = await fetch(`/api${path}${buildQuery(params)}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  })

  let payload: ApiPayload<T> | null = null
  try {
    payload = (await response.json()) as ApiPayload<T>
  } catch {
    payload = null
  }

  const code = payload?.code
  const message = payload?.message ?? ''

  if (response.status === 401 || code === 401 || code === 40100) {
    clearSession()
    redirectToLogin()
    throw new ApiError(message || '登录已过期，请重新登录', 401, 401)
  }

  const businessFailed = typeof code === 'number' && code !== 0
  if (!payload || !response.ok || businessFailed) {
    const status = response.status || 500
    throw new ApiError(message || `请求失败（HTTP ${status}）`, code ?? status, status)
  }

  return payload.data as T
}

export const authApi = {
  captcha: () => request<CaptchaData>('/auth/captcha', { auth: false }),
  sendSms: (body: SmsRequest) =>
    request<SmsInfo>('/auth/sms/send', { method: 'POST', body, auth: false }),
  login: (body: LoginRequest) =>
    request<LoginData>('/auth/login', { method: 'POST', body, auth: false }),
  me: () => request<AuthMeUser>('/auth/me'),
  logout: () => request<unknown>('/auth/logout', { method: 'DELETE' }),
}

export const categoryApi = {
  list: () => request<Category[]>('/categories', { auth: false }),
}

export interface ProductListParams {
  page?: number
  pageSize?: number
  keyword?: string
  categoryId?: string
  sort?: 'default' | 'price_asc' | 'sales_desc'
}

export const productApi = {
  list: (params: ProductListParams = {}) =>
    request<PageData<Product>>('/products', {
      params: { ...params },
      auth: false,
    }),
  detail: (productId: string) =>
    request<ProductDetail>(`/products/${productId}`, { auth: false }),
  reviews: (
    productId: string,
    params: {
      filter?: 'all' | 'good' | 'medium' | 'bad' | 'media'
      page?: number
      pageSize?: number
    } = {},
  ) => request<ProductReviewPage>(`/products/${productId}/reviews`, { params, auth: false }),
}

export const cartApi = {
  get: () => request<Cart>('/cart'),
  addItem: (body: AddCartItemRequest) =>
    request<Cart['items'][number]>('/cart/items', { method: 'POST', body }),
  updateItem: (cartItemId: string, body: UpdateCartItemRequest) =>
    request<Cart['items'][number]>(`/cart/items/${cartItemId}`, { method: 'PATCH', body }),
  deleteItem: (cartItemId: string) =>
    request<unknown>(`/cart/items/${cartItemId}`, { method: 'DELETE' }),
  setSelection: (body: CartSelectionRequest) =>
    request<unknown>('/cart/items/selection', { method: 'PUT', body }),
  deleteSelected: () => request<unknown>('/cart/items/selected', { method: 'DELETE' }),
  merge: (body: CartMergeRequest) => request<Cart>('/cart/merge', { method: 'POST', body }),
}

export const orderApi = {
  cartPreview: (body: CartOrderPreviewRequest) =>
    request<OrderPreview>('/orders/cart/preview', { method: 'POST', body }),
  createFromCart: (body: CartOrderCreateRequest) =>
    request<OrderCreateResult>('/orders/cart', { method: 'POST', body }),
  createDirect: (body: DirectOrderCreateRequest) =>
    request<OrderCreateResult>('/orders/direct', { method: 'POST', body }),
  list: (params: { status?: OrderStatus | ''; page?: number; pageSize?: number }) =>
    request<PageData<Order>>('/orders', { params }),
  detail: (orderId: string) => request<Order>(`/orders/${orderId}`),
  pay: (orderId: string, body: PayOrderRequest) =>
    request<PayOrderResult>(`/orders/${orderId}/pay`, { method: 'POST', body }),
  cancel: (orderId: string, body: CancelOrderRequest = {}) =>
    request<unknown>(`/orders/${orderId}/cancel`, { method: 'POST', body }),
  receive: (orderId: string) =>
    request<unknown>(`/orders/${orderId}/receive`, { method: 'POST' }),
  pendingReviews: () => request<PendingReviewItem[]>('/users/me/reviews/pending'),
  submitReviews: (orderId: string, body: SubmitReviewsRequest) =>
    request<ReviewSubmissionResult>(`/orders/${orderId}/reviews`, { method: 'POST', body }),
}

export const userApi = {
  me: () => request<UserProfile>('/users/me'),
  update: (body: UserProfileUpdateRequest) =>
    request<UserProfile>('/users/me', { method: 'PATCH', body }),
  addresses: () => request<Address[]>('/users/me/addresses'),
  createAddress: (body: AddressRequest) =>
    request<Address>('/users/me/addresses', { method: 'POST', body }),
  updateAddress: (addressId: string, body: AddressRequest) =>
    request<Address>(`/users/me/addresses/${addressId}`, { method: 'PUT', body }),
  deleteAddress: (addressId: string) =>
    request<unknown>(`/users/me/addresses/${addressId}`, { method: 'DELETE' }),
  setDefaultAddress: (addressId: string) =>
    request<Address>(`/users/me/addresses/${addressId}/default`, { method: 'PUT' }),
}

export const socialApi = {
  favorites: (params: { page?: number; pageSize?: number }) =>
    request<PageData<FavoriteItem>>('/users/me/favorites', { params }),
  addFavorite: (body: FavoriteRequest) =>
    request<FavoriteItem>('/users/me/favorites', { method: 'POST', body }),
  removeFavorite: (productId: string) =>
    request<unknown>(`/users/me/favorites/${productId}`, { method: 'DELETE' }),
  browseHistory: (params: { page?: number; pageSize?: number }) =>
    request<PageData<BrowseHistoryItem>>('/users/me/browse-history', { params }),
  recordBrowse: (body: BrowseHistoryRequest) =>
    request<BrowseHistoryItem>('/users/me/browse-history', { method: 'POST', body }),
  deleteBrowse: (historyId: string) =>
    request<unknown>(`/users/me/browse-history/${historyId}`, { method: 'DELETE' }),
  clearBrowse: () => request<unknown>('/users/me/browse-history', { method: 'DELETE' }),
  deleteBrowses: (body: IdBatchRequest) =>
    request<unknown>('/users/me/browse-history/batch-delete', { method: 'POST', body }),
  searchHistory: (params: { page?: number; pageSize?: number }) =>
    request<PageData<SearchHistoryItem>>('/users/me/search-history', { params }),
  recordSearch: (body: SearchHistoryRequest) =>
    request<SearchHistoryItem>('/users/me/search-history', { method: 'POST', body }),
  deleteSearch: (historyId: string) =>
    request<unknown>(`/users/me/search-history/${historyId}`, { method: 'DELETE' }),
  clearSearch: () => request<unknown>('/users/me/search-history', { method: 'DELETE' }),
}

export const adminApi = {
  shipOrder: (orderId: string, body: ShipOrderRequest) =>
    request<AdminShipmentResult>(`/admin/orders/${orderId}/ship`, { method: 'POST', body }),
  banUser: (userId: string) =>
    request<AdminUserStatusResult>(`/admin/users/${userId}/ban`, { method: 'PUT' }),
  updateProductImages: (productId: string, body: AdminProductImagesRequest) =>
    request<Product>(`/admin/products/${productId}/images`, { method: 'PUT', body }),
}

export const uploadApi = {
  sign: (body: OssSignRequest) =>
    request<OssSignDTO>('/uploads/sign', { method: 'POST', body }),
}

export type ServicePageParams = {
  page?: number
  pageSize?: number
}

/** 同一时刻只发一次建会话请求，避免 React StrictMode / 连点打出两条大厅会话 */
let createSessionInflight: Promise<ServiceSession> | null = null

/** 用户端人工客服 REST */
export const serviceApi = {
  createSession: () => {
    if (!createSessionInflight) {
      createSessionInflight = request<ServiceSession>('/service/sessions', { method: 'POST' }).finally(
        () => {
          createSessionInflight = null
        },
      )
    }
    return createSessionInflight
  },
  currentSession: () => request<ServiceSession>('/service/sessions/current'),
  session: (sessionId: string) => request<ServiceSession>(`/service/sessions/${sessionId}`),
  messages: (sessionId: string, params: ServicePageParams = {}) =>
    request<PageData<ServiceMessage>>(`/service/sessions/${sessionId}/messages`, { params }),
  closeSession: (sessionId: string) =>
    request<Record<string, never>>(`/service/sessions/${sessionId}/close`, { method: 'POST' }),
}

/** 客服工作台 REST（admin） */
export const adminServiceApi = {
  lobby: (params: ServicePageParams = {}) =>
    request<PageData<ServiceSession>>('/admin/service/sessions/lobby', { params }),
  mine: (params: ServicePageParams = {}) =>
    request<PageData<ServiceSession>>('/admin/service/sessions/mine', { params }),
  claim: (sessionId: string) =>
    request<ServiceSession>(`/admin/service/sessions/${sessionId}/claim`, { method: 'POST' }),
  messages: (sessionId: string, params: ServicePageParams = {}) =>
    request<PageData<ServiceMessage>>(`/admin/service/sessions/${sessionId}/messages`, { params }),
  closeSession: (sessionId: string) =>
    request<Record<string, never>>(`/admin/service/sessions/${sessionId}/close`, {
      method: 'POST',
    }),
}

export function readGuestCart() {
  try {
    const raw = localStorage.getItem(GUEST_CART_KEY)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function saveGuestCart(items: { productId: string; quantity: number; selected?: boolean }[]) {
  localStorage.setItem(GUEST_CART_KEY, JSON.stringify(items))
  window.dispatchEvent(new Event('orange_market_guest_cart_updated'))
}
