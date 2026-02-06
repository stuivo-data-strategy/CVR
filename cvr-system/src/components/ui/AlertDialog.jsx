import React, { useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { X, AlertTriangle } from 'lucide-react'
import styles from './Dialog.module.css' // Re-using base dialog styles
import { cn } from '../../lib/utils'

/**
 * AlertDialog Component
 * 
 * Replaces native window.confirm and window.alert.
 * 
 * Props:
 * - open: boolean
 * - onOpenChange: (open: boolean) => void
 * - title: string
 * - description: string
 * - cancelText: string (default "Cancel")
 * - confirmText: string (default "Continue")
 * - onConfirm: () => void | Promise<void>
 * - variant: 'default' | 'destructive' (default 'default')
 * - showCancel: boolean (default true, set false for alert style)
 */
export function AlertDialog({
    open,
    onOpenChange,
    title,
    description,
    cancelText = "Cancel",
    confirmText = "Continue",
    onConfirm,
    variant = 'default',
    showCancel = true
}) {
    if (!open) return null

    const handleConfirm = async () => {
        if (onConfirm) {
            await onConfirm()
        }
        onOpenChange(false)
    }

    return createPortal(
        <div className={styles.overlay} onClick={() => onOpenChange(false)}>
            <div className={cn(styles.dialog, "max-w-md w-full")} onClick={e => e.stopPropagation()}>
                <div className={styles.header}>
                    <div className="flex items-center gap-2">
                        {variant === 'destructive' && <AlertTriangle className="text-red-500" size={24} />}
                        <h2 className={styles.title}>{title}</h2>
                    </div>
                    <button className={styles.closeButton} onClick={() => onOpenChange(false)}>
                        <X size={20} />
                    </button>
                </div>

                <div className={styles.content}>
                    <p className="text-gray-600 dark:text-gray-300">{description}</p>
                </div>

                <div className={styles.footer}>
                    {showCancel && (
                        <button
                            type="button"
                            className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-800"
                            onClick={() => onOpenChange(false)}
                        >
                            {cancelText}
                        </button>
                    )}
                    <button
                        type="button"
                        className={cn(
                            "px-4 py-2 rounded-md text-sm font-medium text-white",
                            variant === 'destructive'
                                ? "bg-red-600 hover:bg-red-700"
                                : "bg-blue-600 hover:bg-blue-700"
                        )}
                        onClick={handleConfirm}
                    >
                        {confirmText}
                    </button>
                </div>
            </div>
        </div>,
        document.body
    )
}
