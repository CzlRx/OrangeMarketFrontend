import { useState, type FormEvent } from 'react'
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'
import {
  Citrus,
  Heart,
  Home,
  LayoutGrid,
  ReceiptText,
  Search,
  ShoppingBag,
  UserRound,
} from 'lucide-react'
import { useAuth } from '../state/AuthContext'
import { useCart } from '../state/CartContext'

export function AppShell() {
  const [keyword, setKeyword] = useState('')
  const { user } = useAuth()
  const { count } = useCart()
  const navigate = useNavigate()

  const submitSearch = (event: FormEvent) => {
    event.preventDefault()
    const value = keyword.trim()
    navigate(value ? `/catalog?keyword=${encodeURIComponent(value)}` : '/catalog')
  }

  const navItem = ({ isActive }: { isActive: boolean }) =>
    `nav-item${isActive ? ' active' : ''}`

  return (
    <div className="app-shell">
      <header className="site-header">
        <div className="header-inner">
          <Link to="/" className="brand" aria-label="橙子市集首页">
            <span className="brand-mark">
              <Citrus size={22} strokeWidth={2.2} />
            </span>
            <span>橙子市集</span>
          </Link>

          <form className="header-search" onSubmit={submitSearch}>
            <Search size={17} />
            <input
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
              placeholder="搜索商品"
              aria-label="搜索商品"
            />
            <button type="submit">搜索</button>
          </form>

          <nav className="desktop-nav">
            <NavLink to="/" end className={navItem}>
              <Home size={18} />
              <span>首页</span>
            </NavLink>
            <NavLink to="/catalog" className={navItem}>
              <LayoutGrid size={18} />
              <span>分类</span>
            </NavLink>
            <NavLink to="/orders" className={navItem}>
              <ReceiptText size={18} />
              <span>订单</span>
            </NavLink>
            <NavLink to="/favorites" className="nav-icon">
              <Heart size={19} />
              <span className="sr-only">收藏</span>
            </NavLink>
            <NavLink to="/cart" className="nav-icon cart-link" aria-label={`购物车，${count} 件`}>
              <ShoppingBag size={19} />
              {count > 0 && <span className="cart-badge">{count > 99 ? '99+' : count}</span>}
              <span className="sr-only">购物车</span>
            </NavLink>
            <NavLink
              to={user ? '/profile' : '/login'}
              className="nav-icon user-chip"
              title={user?.nickname || '登录'}
            >
              <UserRound size={19} />
              <span className="nav-user-name">{user?.nickname || '登录'}</span>
            </NavLink>
          </nav>
        </div>
      </header>

      <main className="site-main">
        <Outlet />
      </main>

      <footer className="site-footer">
        <span>橙子市集</span>
        <span>接口契约 v1.0</span>
      </footer>

      <nav className="mobile-nav" aria-label="移动端导航">
        <NavLink to="/" end className={navItem}>
          <Home size={20} />
          <span>首页</span>
        </NavLink>
        <NavLink to="/catalog" className={navItem}>
          <LayoutGrid size={20} />
          <span>分类</span>
        </NavLink>
        <NavLink to="/cart" className={navItem}>
          <span className="mobile-cart-wrap">
            <ShoppingBag size={20} />
            {count > 0 && <span className="cart-badge">{count > 99 ? '99+' : count}</span>}
          </span>
          <span>购物车</span>
        </NavLink>
        <NavLink to="/orders" className={navItem}>
          <ReceiptText size={20} />
          <span>订单</span>
        </NavLink>
        <NavLink to={user ? '/profile' : '/login'} className={navItem}>
          <UserRound size={20} />
          <span>我的</span>
        </NavLink>
      </nav>
    </div>
  )
}
