import React from 'react'
import { NavLink } from 'react-router-dom'
import { LayoutDashboard, FileText, PieChart, Settings, Calculator } from 'lucide-react'
import styles from './Sidebar.module.css'
import { cn } from '../lib/utils'

export default function Sidebar() {
    const navItems = [
        { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
        { to: '/contracts', label: 'Contracts', icon: FileText },
        { to: '/reports', label: 'Reports', icon: PieChart },
        { to: '/modeling', label: 'What-If Scenarios', icon: Calculator },
    ]

    return (
        <aside className={styles.sidebar}>
            <div className={styles.logo}>
                <img src="/logo.png" alt="CVR" style={{ height: '32px', width: '32px', objectFit: 'contain', marginRight: '8px' }} />
                <span className={styles.logoText}>Cost Value Reconciliation</span>
            </div>
            <nav className={styles.nav}>
                {navItems.map((item) => (
                    <NavLink
                        key={item.to}
                        to={item.to}
                        className={({ isActive }) =>
                            cn(styles.navItem, isActive && styles.active)
                        }
                    >
                        <item.icon size={20} />
                        <span>{item.label}</span>
                    </NavLink>
                ))}
            </nav>
            <div className={styles.footer}>
                <NavLink to="/settings" className={styles.navItem}>
                    <Settings size={20} />
                    <span>Settings</span>
                </NavLink>
            </div>
        </aside>
    )
}
