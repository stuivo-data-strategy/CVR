import React from 'react'
import { User, Bell } from 'lucide-react'
import styles from './Topbar.module.css'

export default function Topbar() {
    return (
        <header className={styles.topbar}>
            <h2 className={styles.pageTitle}>Overview</h2>
            <div className={styles.actions}>
                <button className={styles.iconButton}>
                    <Bell size={20} />
                </button>
                <div className={styles.profile}>
                    <div className={styles.avatar}>
                        <User size={20} />
                    </div>
                    <span className={styles.username}>User</span>
                </div>
            </div>
        </header>
    )
}
