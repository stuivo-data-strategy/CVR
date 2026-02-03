import React from 'react'
import styles from './Button.module.css'
import { cn } from '../../lib/utils'

export function Button({ className, variant = 'primary', size = 'default', children, ...props }) {
    return (
        <button
            className={cn(styles.button, styles[variant], styles[size], className)}
            {...props}
        >
            {children}
        </button>
    )
}
