import { Link, NavLink, Outlet } from 'react-router-dom'
import {
  Citrus,
  Headset,
  Home,
  LayoutGrid,
  RotateCcw,
  ShieldCheck,
  ShoppingBag,
  Truck,
  UserRound,
  ReceiptText,
} from 'lucide-react'
import { useAuth } from '../state/AuthContext'
import { useCart } from '../state/CartContext'
import { CategoryProvider, useCategories } from '../state/CategoryContext'
import { categoryIcon } from '../lib/categoryIcons'
import { SearchBar } from './SearchBar'

function HeaderNav() {
  const { categories } = useCategories()

  return (
    <nav className="header-nav" aria-label="商品分类导航">
      <NavLink to="/" end className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
        <Home size={16} style={{ marginRight: 5 }} />
        首页
      </NavLink>
      <div className="nav-dropdown">
        <NavLink
          to="/catalog"
          className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
        >
          <LayoutGrid size={16} style={{ marginRight: 5 }} />
          全部分类
        </NavLink>
        {categories.length > 0 && (
          <div className="dropdown-panel">
            <div className="dropdown-card">
              {categories.map((category) => {
                const Icon = categoryIcon(category.icon)
                return (
                  <Link key={category.id} to={`/catalog?categoryId=${category.id}`}>
                    <Icon size={18} />
                    {category.name}
                  </Link>
                )
              })}
            </div>
          </div>
        )}
      </div>
      {categories.slice(0, 6).map((category) => (
        <Link key={category.id} to={`/catalog?categoryId=${category.id}`} className="nav-link">
          {category.name}
        </Link>
      ))}
    </nav>
  )
}

function TopBar() {
  const { user } = useAuth()

  return (
    <div className="topbar">
      <div className="topbar-inner">
        <span>橙子市集 · 新潮数码与生活好物</span>
        <div className="topbar-links">
          {user ? (
            <Link to="/profile">{user.nickname || '个人中心'}</Link>
          ) : (
            <Link to="/login">登录 / 注册</Link>
          )}
          <Link to="/orders">我的订单</Link>
          <Link to="/favorites">我的收藏</Link>
          <Link to="/history">浏览足迹</Link>
        </div>
      </div>
    </div>
  )
}

function SiteFooter() {
  const columns: { title: string; links: string[] }[] = [
    { title: '关于商城', links: ['品牌介绍', '加入我们', '媒体报道'] },
    { title: '购物指南', links: ['购物流程', '会员介绍', '常见问题'] },
    { title: '支付方式', links: ['在线支付', '订单支付说明'] },
    { title: '售后服务', links: ['退换货政策', '退款说明', '投诉建议'] },
    { title: '联系我们', links: ['在线客服', '合作洽谈'] },
  ]

  return (
    <footer className="site-footer">
      <div className="footer-service">
        <span className="footer-service-item">
          <ShieldCheck size={22} />
          <b>正品保障</b>
        </span>
        <span className="footer-service-item">
          <Truck size={22} />
          <b>极速发货</b>
        </span>
        <span className="footer-service-item">
          <RotateCcw size={22} />
          <b>七天退换</b>
        </span>
        <span className="footer-service-item">
          <Headset size={22} />
          <b>售后无忧</b>
        </span>
      </div>

      <div className="footer-links">
        {columns.map((column) => (
          <div className="footer-col" key={column.title}>
            <h4>{column.title}</h4>
            <ul>
              {column.links.map((link) => (
                <li key={link}>
                  <span>{link}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="footer-bottom">
        © {new Date().getFullYear()} 橙子市集 Orange Market · 简单生活，好物即达
      </div>
    </footer>
  )
}

export function AppShell() {
  const { user } = useAuth()
  const { count } = useCart()

  return (
    <CategoryProvider>
      <div className="app-shell">
        <header className="site-header">
          <TopBar />
          <div className="header-main">
            <Link to="/" className="brand" aria-label="橙子市集首页">
              <span className="brand-mark">
                <Citrus size={20} strokeWidth={2.2} />
              </span>
              <span>橙子市集</span>
            </Link>

            <HeaderNav />

            <SearchBar />

            <div className="header-actions">
              <Link to={user ? '/profile' : '/login'} className="header-user" title={user?.nickname || '登录'}>
                <UserRound size={18} />
                <span className="user-name">{user?.nickname || '登录'}</span>
              </Link>
              <Link to="/cart" className="header-cart" aria-label={`购物车，${count} 件商品`}>
                <ShoppingBag size={17} />
                <span>购物车</span>
                {count > 0 && (
                  <span className="cart-badge" key={count}>
                    {count > 99 ? '99+' : count}
                  </span>
                )}
              </Link>
            </div>
          </div>
        </header>

        <main className="site-main">
          <Outlet />
        </main>

        <SiteFooter />

        <nav className="mobile-nav" aria-label="移动端导航">
          <NavLink to="/" end className={({ isActive }) => (isActive ? 'active' : '')}>
            <Home size={20} />
            <span>首页</span>
          </NavLink>
          <NavLink to="/catalog" className={({ isActive }) => (isActive ? 'active' : '')}>
            <LayoutGrid size={20} />
            <span>分类</span>
          </NavLink>
          <NavLink to="/cart" className={({ isActive }) => (isActive ? 'active' : '')}>
            <span className="mobile-cart-wrap">
              <ShoppingBag size={20} />
              {count > 0 && (
                <span className="cart-badge" key={count}>
                  {count > 99 ? '99+' : count}
                </span>
              )}
            </span>
            <span>购物车</span>
          </NavLink>
          <NavLink to="/orders" className={({ isActive }) => (isActive ? 'active' : '')}>
            <ReceiptText size={20} />
            <span>订单</span>
          </NavLink>
          <NavLink
            to={user ? '/profile' : '/login'}
            className={({ isActive }) => (isActive ? 'active' : '')}
          >
            <UserRound size={20} />
            <span>我的</span>
          </NavLink>
        </nav>
      </div>
    </CategoryProvider>
  )
}
