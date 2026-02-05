import React, { useEffect, useRef } from 'react'
import { X } from 'lucide-react'
import styles from './Dialog.module.css'
import { cn } from '../../lib/utils'
import { createPortal } from 'react-dom'

export function Dialog({ open, onOpenChange, children, className }) {
    if (!open) return null

    return createPortal(
        <div className={styles.overlay} onClick={() => onOpenChange(false)}>
            <div className={cn(styles.dialog, className)} onClick={e => e.stopPropagation()}>
                {children}
                <button className={styles.closeButton} onClick={() => onOpenChange(false)}>
                    <X size={20} />
                </button>
            </div>
        </div>,
        document.body
    )
}

export function DialogHeader({ className, children, ...props }) {
    return <div className={cn(styles.header, className)} {...props}>{children}</div>
}

export function DialogTitle({ className, children, ...props }) {
    return <h2 className={cn(styles.title, className)} {...props}>{children}</h2>
}

export function DialogContent({ className, children, ...props }) {
    return <div className={cn(styles.content, className)} {...props}>{children}</div>
}

export function DialogFooter({ className, children, ...props }) {
    return <div className={cn(styles.footer, className)} {...props}>{children}</div>
}
