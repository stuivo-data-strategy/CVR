import React from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './Dialog'
import { Button } from './Button'
import { AlertTriangle, Info } from 'lucide-react'

export function AlertDialog({ open, onOpenChange, title, description, onConfirm, confirmText = "Confirm", cancelText = "Cancel", variant = "primary" }) {
    if (!open) return null

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-[400px]">
                <DialogHeader>
                    <DialogTitle className={`flex items-center gap-2 ${variant === 'destructive' ? 'text-red-600' : 'text-gray-900'}`}>
                        {variant === 'destructive' ? <AlertTriangle size={20} /> : <Info size={20} />}
                        {title}
                    </DialogTitle>
                </DialogHeader>
                <div className="py-4 text-sm text-gray-600">
                    {description}
                </div>
                <DialogFooter className="flex justify-end gap-2">
                    {cancelText && (
                        <Button variant="outline" onClick={() => onOpenChange(false)}>
                            {cancelText}
                        </Button>
                    )}
                    <Button
                        variant={variant === 'destructive' ? 'destructive' : 'primary'}
                        onClick={() => {
                            if (onConfirm) onConfirm()
                            onOpenChange(false)
                        }}
                    >
                        {confirmText}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
