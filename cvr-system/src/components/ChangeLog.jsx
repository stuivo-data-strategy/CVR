import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { Button } from './ui/Button'
import { Plus, Trash2 } from 'lucide-react'
import { ContractChangeForm } from './ContractChangeForm'
import { format } from 'date-fns'
import styles from './ChangeLog.module.css'

export default function ChangeLog({ contractId }) {
    const queryClient = useQueryClient()
    const [isModalOpen, setIsModalOpen] = useState(false)

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

            {isModalOpen && (
                <ContractChangeForm
                    contractId={contractId}
                    onClose={() => setIsModalOpen(false)}
                    onSuccess={() => {
                        queryClient.invalidateQueries(['changes', contractId])
                    }}
                />
            )}
        </div>
    )
}
