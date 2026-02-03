import React from 'react'
import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import Topbar from './Topbar'
import styles from './DashboardLayout.module.css'

export default function DashboardLayout() {
    return (
        <div className={styles.layout}>
            <Sidebar />
            <div className={styles.mainContent}>
                <Topbar />
                <main className={styles.pageContainer}>
                    <Outlet />
                </main>
            </div>
        </div>
    )
}
