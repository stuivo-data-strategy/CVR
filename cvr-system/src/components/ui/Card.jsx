import React from 'react'
import styles from './Card.module.css'
import { cn } from '../../lib/utils'

export function Card({ className, children, ...props }) {
    return (
        <div className={cn(styles.card, className)} {...props}>
            {children}
        </div>
    )
}

export function CardHeader({ className, children, ...props }) {
    return <div className={cn(styles.header, className)} {...props}>{children}</div>
}

export function CardTitle({ className, children, ...props }) {
    return <h3 className={cn(styles.title, className)} {...props}>{children}</h3>
}

export function CardContent({ className, children, ...props }) {
    return <div className={cn(styles.content, className)} {...props}>{children}</div>
}

export function CardDescription({ className, children, ...props }) {
    return <p className={cn("text-sm text-muted-foreground", className)} {...props}>{children}</p>
}
