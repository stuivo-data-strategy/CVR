import React, { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './ui/Dialog'
import { Button } from './ui/Button'
import { supabase } from '../lib/supabase'
import { useQueryClient } from '@tanstack/react-query'
import styles from './CreateContractModal.module.css'

export default function CreateContractModal({ open, onOpenChange }) {
    const queryClient = useQueryClient()
    const [loading, setLoading] = useState(false)
    const [formData, setFormData] = useState({
        contract_code: '',
        name: '',
        customer_name: '',
        start_date: '',
        original_value: '',
        target_margin_pct: '',
    })

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value })
    }

    const handleSubmit = async (e) => {
        e.preventDefault()
        setLoading(true)

        const { error } = await supabase.from('contracts').insert([
            {
                ...formData,
                original_value: formData.original_value ? parseFloat(formData.original_value) : 0,
                target_margin_pct: formData.target_margin_pct ? parseFloat(formData.target_margin_pct) : 0,
                target_margin_pct: formData.target_margin_pct ? parseFloat(formData.target_margin_pct) : 0,
                status: 'active'
            }
        ])

        if (error) {
            alert(error.message)
        } else {
            queryClient.invalidateQueries(['contracts'])
            onOpenChange(false)
            setFormData({
                contract_code: '',
                name: '',
                customer_name: '',
                start_date: '',
                original_value: '',
                target_margin_pct: '',
                portfolio: '',
                sector: '',
            })
        }
        setLoading(false)
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogHeader>
                <DialogTitle>New Contract</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit}>
                <DialogContent className={styles.formGrid}>
                    <div className={styles.field}>
                        <label className={styles.label}>Contract Code</label>
                        <input required name="contract_code" value={formData.contract_code} onChange={handleChange} className={styles.input} placeholder="e.g. C-2024-001" />
                    </div>
                    <div className={styles.field}>
                        <label className={styles.label}>Contract Name</label>
                        <input required name="name" value={formData.name} onChange={handleChange} className={styles.input} placeholder="Project Alpha" />
                    </div>
                    <div className={styles.field}>
                        <label className={styles.label}>Customer Name</label>
                        <input required name="customer_name" value={formData.customer_name} onChange={handleChange} className={styles.input} placeholder="Acme Inc." />
                    </div>
                    <div className={styles.field}>
                        <label className={styles.label}>Start Date</label>
                        <input required type="date" name="start_date" value={formData.start_date} onChange={handleChange} className={styles.input} />
                    </div>
                    <div className={styles.field}>
                        <label className={styles.label}>Original Value</label>
                        <input type="number" step="0.01" name="original_value" value={formData.original_value} onChange={handleChange} className={styles.input} placeholder="0.00" />
                    </div>
                    <div className={styles.field}>
                        <label className={styles.label}>Target Margin %</label>
                        <input type="number" step="0.1" name="target_margin_pct" value={formData.target_margin_pct} onChange={handleChange} className={styles.input} placeholder="15.0" />
                    </div>
                    <div className={styles.field}>
                        <label className={styles.label}>Portfolio</label>
                        <input name="portfolio" value={formData.portfolio || ''} onChange={handleChange} className={styles.input} placeholder="e.g. PF00001" />
                    </div>
                    <div className={styles.field}>
                        <label className={styles.label}>Sector</label>
                        <input name="sector" value={formData.sector || ''} onChange={handleChange} className={styles.input} placeholder="e.g. Public" />
                    </div>
                </DialogContent>
                <DialogFooter>
                    <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
                    <Button type="submit" disabled={loading}>{loading ? 'Creating...' : 'Create Contract'}</Button>
                </DialogFooter>
            </form>
        </Dialog>
    )
}
