import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Check, MapPin, Plus, Trash2 } from 'lucide-react'
import type { Address } from '../types'
import { userApi } from '../lib/api'
import { EmptyState } from '../components/EmptyState'
import { LoadingState } from '../components/LoadingState'
import { useToast } from '../state/ToastContext'

interface AddressFormState {
  receiver: string
  phone: string
  province: string
  city: string
  district: string
  detail: string
  isDefault: boolean
}

const EMPTY_FORM: AddressFormState = {
  receiver: '',
  phone: '',
  province: '',
  city: '',
  district: '',
  detail: '',
  isDefault: false,
}

export function AddressesPage() {
  const [addresses, setAddresses] = useState<Address[]>([])
  const [editing, setEditing] = useState<Address | 'new' | null>(null)
  const [form, setForm] = useState<AddressFormState>(EMPTY_FORM)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const { toast } = useToast()

  const load = useCallback(async () => {
    try {
      setAddresses(await userApi.addresses())
    } catch (err) {
      toast(err instanceof Error ? err.message : '地址加载失败', 'error')
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    void load()
  }, [load])

  const startCreate = () => {
    setEditing('new')
    setForm(EMPTY_FORM)
  }

  const startEdit = (address: Address) => {
    setEditing(address)
    setForm({
      receiver: address.receiver,
      phone: address.phone,
      province: address.province,
      city: address.city,
      district: address.district,
      detail: address.detail,
      isDefault: address.isDefault,
    })
  }

  const saveAddress = async (event: FormEvent) => {
    event.preventDefault()
    const body = {
      receiver: form.receiver.trim(),
      phone: form.phone.trim(),
      province: form.province.trim(),
      city: form.city.trim(),
      district: form.district.trim(),
      detail: form.detail.trim(),
      isDefault: form.isDefault,
    }
    if (!body.receiver || !body.phone || !body.province || !body.city || !body.district || !body.detail) {
      toast('请完整填写地址信息', 'error')
      return
    }
    setSaving(true)
    try {
      if (editing === 'new') await userApi.createAddress(body)
      else if (editing) await userApi.updateAddress(editing.id, body)
      toast('地址已保存')
      setEditing(null)
      await load()
    } catch (err) {
      toast(err instanceof Error ? err.message : '保存失败', 'error')
    } finally {
      setSaving(false)
    }
  }

  const removeAddress = async (addressId: string) => {
    if (!window.confirm('确认删除该地址？')) return
    try {
      await userApi.deleteAddress(addressId)
      toast('地址已删除')
      await load()
    } catch (err) {
      toast(err instanceof Error ? err.message : '删除失败', 'error')
    }
  }

  const makeDefault = async (addressId: string) => {
    try {
      await userApi.setDefaultAddress(addressId)
      toast('已设为默认地址')
      await load()
    } catch (err) {
      toast(err instanceof Error ? err.message : '操作失败', 'error')
    }
  }

  if (loading) return <div className="page"><LoadingState /></div>

  return (
    <div className="page addresses-page">
      <div className="page-heading">
        <div>
          <h1>收货地址</h1>
          <p>{addresses.length} 个已保存地址</p>
        </div>
        <button type="button" className="button primary" onClick={startCreate}>
          <Plus size={17} />
          新增地址
        </button>
      </div>

      {addresses.length === 0 && !editing ? (
        <EmptyState
          title="还没有收货地址"
          icon={MapPin}
          action={
            <button type="button" className="button primary" onClick={startCreate}>
              添加地址
            </button>
          }
        />
      ) : (
        <div className="addresses-layout">
          <div className="address-list">
            {addresses.map((address) => (
              <article className="address-card" key={address.id}>
                <header>
                  <strong>{address.receiver}</strong>
                  <span>{address.phone}</span>
                  {address.isDefault && (
                    <i>
                      <Check size={13} />
                      默认
                    </i>
                  )}
                </header>
                <p>
                  {address.province}
                  {address.city}
                  {address.district}
                  {address.detail}
                </p>
                <footer>
                  {!address.isDefault && (
                    <button type="button" className="icon-text-button" onClick={() => makeDefault(address.id)}>
                      设为默认
                    </button>
                  )}
                  <button type="button" className="icon-text-button" onClick={() => startEdit(address)}>
                    编辑
                  </button>
                  <button
                    type="button"
                    className="icon-text-button danger"
                    onClick={() => removeAddress(address.id)}
                  >
                    <Trash2 size={15} />
                    删除
                  </button>
                </footer>
              </article>
            ))}
            <Link to="/checkout" className="button secondary">
              返回结算
            </Link>
          </div>

          {editing && (
            <form className="address-form" onSubmit={saveAddress}>
              <h2>{editing === 'new' ? '新增地址' : '编辑地址'}</h2>
              <div className="form-grid">
                <label>
                  <span>收货人</span>
                  <input value={form.receiver} onChange={(event) => setForm({ ...form, receiver: event.target.value })} />
                </label>
                <label>
                  <span>手机号</span>
                  <input
                    value={form.phone}
                    onChange={(event) => setForm({ ...form, phone: event.target.value.replace(/\D/g, '').slice(0, 11) })}
                  />
                </label>
                <label>
                  <span>省份</span>
                  <input value={form.province} onChange={(event) => setForm({ ...form, province: event.target.value })} />
                </label>
                <label>
                  <span>城市</span>
                  <input value={form.city} onChange={(event) => setForm({ ...form, city: event.target.value })} />
                </label>
                <label>
                  <span>区县</span>
                  <input value={form.district} onChange={(event) => setForm({ ...form, district: event.target.value })} />
                </label>
                <label className="wide-field">
                  <span>详细地址</span>
                  <input value={form.detail} onChange={(event) => setForm({ ...form, detail: event.target.value })} />
                </label>
              </div>
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={form.isDefault}
                  onChange={(event) => setForm({ ...form, isDefault: event.target.checked })}
                />
                设为默认地址
              </label>
              <div className="form-actions">
                <button type="submit" className="button primary" disabled={saving}>
                  {saving ? '保存中...' : '保存'}
                </button>
                <button type="button" className="button secondary" onClick={() => setEditing(null)}>
                  取消
                </button>
              </div>
            </form>
          )}
        </div>
      )}
    </div>
  )
}
