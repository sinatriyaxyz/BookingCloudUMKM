import { ApiError } from './client.js'

const BASE = '/api'
export const CUSTOMER_TOKEN_KEY = 'customer_token'
export const CUSTOMER_INFO_KEY = 'customer_info'

export function getCustomerToken() {
  return localStorage.getItem(CUSTOMER_TOKEN_KEY)
}

export function getStoredCustomer() {
  try {
    const raw = localStorage.getItem(CUSTOMER_INFO_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function setCustomerAuth(token, customer) {
  localStorage.setItem(CUSTOMER_TOKEN_KEY, token)
  if (customer) {
    localStorage.setItem(CUSTOMER_INFO_KEY, JSON.stringify(customer))
  }
}

export function clearCustomerAuth() {
  localStorage.removeItem(CUSTOMER_TOKEN_KEY)
  localStorage.removeItem(CUSTOMER_INFO_KEY)
}

export async function customerApi(path, { method = 'GET', body } = {}) {
  const headers = {}
  const token = getCustomerToken()
  if (token) headers.Authorization = `Bearer ${token}`
  if (body !== undefined) headers['Content-Type'] = 'application/json'

  let res
  try {
    res = await fetch(BASE + path, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    })
  } catch {
    throw new ApiError(0, 'NETWORK', 'Tidak dapat terhubung ke server.')
  }

  if (res.status === 401 && token && !path.startsWith('/customer/auth/')) {
    clearCustomerAuth()
  }

  if (res.status === 204) return null
  let data = null
  try {
    data = await res.json()
  } catch {
    /* tanpa body */
  }
  if (!res.ok) {
    const e = data?.error
    throw new ApiError(res.status, e?.code || 'ERROR', e?.message || 'Terjadi kesalahan.')
  }
  return data
}

export async function customerRegister(payload) {
  const data = await customerApi('/customer/auth/register', { method: 'POST', body: payload })
  setCustomerAuth(data.token, data.customer)
  return data
}

export async function customerLogin(payload) {
  const data = await customerApi('/customer/auth/login', { method: 'POST', body: payload })
  setCustomerAuth(data.token, data.customer)
  return data
}

export async function getCustomerMe() {
  const me = await customerApi('/customer/me')
  if (me) localStorage.setItem(CUSTOMER_INFO_KEY, JSON.stringify(me))
  return me
}

export const getCustomerBookings = () => customerApi('/customer/bookings')
export const getCustomerLoyalty = () => customerApi('/customer/loyalty')
export const redeemVoucher = (voucherId) =>
  customerApi('/customer/vouchers/redeem', { method: 'POST', body: { voucherId } })

export function estimateVoucherDiscount(voucher, price) {
  const numPrice = Number(price || 0)
  const minSpend = Number(voucher.minSpend || 0)
  if (numPrice < minSpend) {
    return { valid: false, reason: `Min. transaksi Rp ${minSpend.toLocaleString('id-ID')}` }
  }
  let discount = 0
  if (voucher.discountType === 'percent') {
    discount = Math.round((numPrice * Number(voucher.discountValue || 0)) / 100)
    if (voucher.maxDiscount != null) {
      discount = Math.min(discount, Number(voucher.maxDiscount))
    }
  } else {
    discount = Number(voucher.discountValue || 0)
  }
  discount = Math.min(discount, numPrice)
  return { valid: true, discountAmount: discount, finalPrice: Math.max(0, numPrice - discount) }
}


