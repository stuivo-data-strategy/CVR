import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { Button } from './ui/Button'
import { Plus, Trash2 } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './ui/Dialog'
import { format } from 'date-fns'
import styles from './ChangeLog.module.css'

export default function ChangeLog({ contractId }) {
    const queryClient = useQueryClient()
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [formData, setFormData] = useState({
        change_code: '',
        description: '',
        effective_date: '',
        revenue_delta: '',
        cost_delta: '',
        change_type: 'scope_addition',
        status: 'proposed'
    })

    const { data: changes, isLoading } = useQuery({
        queryKey: ['changes', contractId],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('contract_changes')
                .select('*')
                .eq('contract_id', contractId)
                .order('created_at', { ascending: false })
            if (error) throw error
            return data
        }
    })

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value })
    }

    const handleSubmit = async (e) => {
        e.preventDefault()
        const { error } = await supabase.from('contract_changes').insert({
            ...formData,
            contract_id: contractId,
            revenue_delta: parseFloat(formData.revenue_delta) || 0,
            cost_delta: parseFloat(formData.cost_delta) || 0
        })

        if (error) alert(error.message)
        else {
            setIsModalOpen(false)
            queryClient.invalidateQueries(['changes', contractId])
            setFormData({
                change_code: '',
                description: '',
                effective_date: '',
                revenue_delta: '',
                cost_delta: '',
                change_type: 'scope_addition',
                status: 'proposed'
            })
        }
    }

    const handleDelete = async (id) => {
        if (!confirm('Delete change?')) return
        const { error } = await supabase.from('contract_changes').delete().eq('id', id)
        if (error) alert(error.message)
        else queryClient.invalidateQueries(['changes', contractId])
    }

    // Formatting
    const formatCurrency = (val) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val)

    return (
        <div className={styles.container}>
            <div className={styles.toolbar}>
                <h3 className="text-lg font-semibold">Contract Changes</h3>
                <Button size="sm" onClick={() => setIsModalOpen(true)}>
                    <Plus size={16} className="mr-2" />
                    Add Change
                </Button>
            </div>

            <div className={styles.tableContainer}>
                <table className={styles.table}>
                    <thead>
                        <tr>
                            <th className={styles.th}>Code</th>
                            <th className={styles.th}>Description</th>
                            <th className={styles.th}>Type</th>
                            <th className={styles.th}>Status</th>
                            <th className={styles.thRight}>Revenue Delta</th>
                            <th className={styles.thRight}>Cost Delta</th>
                            <th className={styles.th}></th>
                        </tr>
                    </thead>
                    <tbody>
                        {changes?.length === 0 ? (
                            <tr><td colSpan={7} className="text-center p-4">No changes recorded.</td></tr>
                        ) : (
                            changes?.map(change => (
                                <tr key={change.id} className={styles.tr}>
                                    <td className={styles.td}>{change.change_code}</td>
                                    <td className={styles.td}>{change.description}</td>
                                    <td className={styles.td}><span className={styles.pill}>{change.change_type?.replace('_', ' ')}</span></td>
                                    <td className={styles.td}><span className={`${styles.pill} ${styles[change.status]}`}>{change.status}</span></td>
                                    <td className={styles.tdRight}>{formatCurrency(change.revenue_delta)}</td>
                                    <td className={styles.tdRight}>{formatCurrency(change.cost_delta)}</td>
                                    <td className={styles.td}>
                                        <button className={styles.iconBtn} onClick={() => handleDelete(change.id)}>
                                            <Trash2 size={16} />
                                        </button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
                <DialogHeader><DialogTitle>Add Contract Change</DialogTitle></DialogHeader>
                <form onSubmit={handleSubmit} className={styles.form}>
                    <DialogContent>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="flex flex-col gap-2">
                                <label className="text-sm font-medium">Code</label>
                                <input className={styles.input} name="change_code" value={formData.change_code} onChange={handleChange} required />
                            </div>
                            <div className="flex flex-col gap-2">
                                <label className="text-sm font-medium">Type</label>
                                <select className={styles.input} name="change_type" value={formData.change_type} onChange={handleChange}>
                                    <option value="scope_addition">Scope Addition</option>
                                    <option value="scope_reduction">Scope Reduction</option>
                                    <option value="rate_change">Rate Change</option>
                                    <option value="other">Other</option>
                                </select>
                            </div>
                            <div className="flex flex-col gap-2 col-span-2">
                                <label className="text-sm font-medium">Description</label>
                                <input className={styles.input} name="description" value={formData.description} onChange={handleChange} required />
                            </div>
                            <div className="flex flex-col gap-2">
                                <label className="text-sm font-medium">Rev. Delta</label>
                                <input className={styles.input} type="number" name="revenue_delta" value={formData.revenue_delta} onChange={handleChange} />
                            </div>
                            <div className="flex flex-col gap-2">
                                <label className="text-sm font-medium">Cost Delta</label>
                                <input className={styles.input} type="number" name="cost_delta" value={formData.cost_delta} onChange={handleChange} />
                            </div>
                        </div>
                    </DialogContent>
                    <DialogFooter>
                        <Button type="submit">Save Change</Button>
                    </DialogFooter>
                </form>
            </Dialog>
        </div>
    )
}
