import React, { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { Plus, Filter, Search, MoreHorizontal, Trash2, Upload } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import CreateContractModal from '../components/CreateContractModal'
import ImportContractModal from '../components/ImportContractModal'
import { AlertDialog } from '../components/ui/AlertDialog'
import { format } from 'date-fns'
import styles from './Contracts.module.css'

export default function Contracts() {
    const [statusFilter, setStatusFilter] = useState('all')
    const [buFilter, setBuFilter] = useState('all')
    const [sectorFilter, setSectorFilter] = useState('all')
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
    const [isImportModalOpen, setIsImportModalOpen] = useState(false)
    const [alertState, setAlertState] = useState({ open: false, title: '', description: '', variant: 'default', showCancel: true, onConfirm: null })

    const queryClient = useQueryClient()

    const { data: contracts, isLoading, error } = useQuery({
        queryKey: ['contracts', statusFilter],
        queryFn: async () => {
            let query = supabase
                .from('contracts')
                .select(`
            id, 
            contract_code, 
            name, 
            customer_name, 
            status, 
            original_value, 
            target_margin_pct,
            start_date,
            end_date,
            portfolio,
            sector
        `)
                .order('created_at', { ascending: false })

            if (statusFilter !== 'all') {
                query = query.eq('status', statusFilter)
            }
            if (buFilter !== 'all') {
                query = query.eq('portfolio', buFilter)
            }
            if (sectorFilter !== 'all') {
                query = query.eq('sector', sectorFilter)
            }

            const { data, error } = await query
            if (error) throw error
            return data
        }
    })

    const executeDelete = async (id) => {
        const { error } = await supabase.from('contracts').delete().eq('id', id)
        if (error) {
            setAlertState({
                open: true,
                title: 'Error',
                description: 'Error deleting contract: ' + error.message,
                variant: 'destructive',
                showCancel: false,
                onConfirm: null
            })
        } else {
            queryClient.invalidateQueries(['contracts'])
        }
    }

    const handleDelete = (id) => {
        setAlertState({
            open: true,
            title: 'Delete Contract',
            description: 'Are you sure you want to delete this contract? This action cannot be undone.',
            variant: 'destructive',
            onConfirm: () => executeDelete(id)
        })
    }

    // Format currency
    const currencyFormatter = new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
    })

    if (isLoading) return <div className="p-8">Loading contracts...</div>

    if (error) return <div className="p-8 text-red-500">Error loading contracts: {error.message}</div>

    return (
        <div className={styles.container}>
            <header className={styles.header}>
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Contract Register</h1>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" onClick={() => setIsImportModalOpen(true)}>
                        <Upload size={16} className="mr-2" />
                        Import
                    </Button>
                    <Button onClick={() => setIsCreateModalOpen(true)}>
                        <Plus size={16} className="mr-2" />
                        New Contract
                    </Button>
                </div>
            </header>

            <div className={styles.controls}>
                <div className={styles.search}>
                    <Search size={16} className={styles.searchIcon} />
                    <input type="text" placeholder="Search contracts..." className={styles.searchInput} />
                </div>
                <div className={styles.filters}>
                    <select
                        className={styles.select}
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                    >
                        <option value="all">Status: All</option>
                        <option value="active">Active</option>
                        <option value="on_hold">On Hold</option>
                        <option value="completed">Completed</option>
                        <option value="terminated">Terminated</option>
                    </select>
                    <select
                        className={styles.select}
                        value={buFilter}
                        onChange={(e) => setBuFilter(e.target.value)}
                    >
                        <option value="all">BU: All</option>
                        <option value="Construction">Construction</option>
                        <option value="Infrastructure">Infrastructure</option>
                        <option value="Services">Services</option>
                    </select>
                    <select
                        className={styles.select}
                        value={sectorFilter}
                        onChange={(e) => setSectorFilter(e.target.value)}
                    >
                        <option value="all">Sector: All</option>
                        <option value="Commercial">Commercial</option>
                        <option value="Public">Public</option>
                        <option value="Residential">Residential</option>
                        <option value="Industrial">Industrial</option>
                    </select>
                </div>
            </div>

            <Card>
                <div className={styles.tableContainer}>
                    <table className={styles.table}>
                        <thead>
                            <tr>
                                <th className={styles.th}>Code</th>
                                <th className={styles.th}>Contract Name</th>
                                <th className={styles.th}>Customer</th>
                                <th className={styles.th}>BU / Sector</th>
                                <th className={styles.th}>Status</th>
                                <th className={styles.th}>Value</th>
                                <th className={styles.th}>Margin %</th>
                                <th className={styles.th}>Start Date</th>
                                <th className={styles.th}>End Date</th>
                                <th className={styles.th}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {contracts?.length === 0 ? (
                                <tr>
                                    <td colSpan={9} className="text-center p-8 text-gray-500">
                                        No contracts found. Create one to get started.
                                    </td>
                                </tr>
                            ) : (
                                contracts?.map((contract) => (
                                    <tr key={contract.id} className={styles.tr}>
                                        <td className={styles.td}>
                                            <Link to={`/contracts/${contract.id}`} className={styles.link}>
                                                {contract.contract_code}
                                            </Link>
                                        </td>
                                        <td className={styles.td}>
                                            <span className="font-medium">{contract.name}</span>
                                        </td>
                                        <td className={styles.td}>{contract.customer_name}</td>
                                        <td className={styles.td}>
                                            <div className="flex flex-col text-xs">
                                                <span className="font-medium">{contract.portfolio || '-'}</span>
                                                <span className="text-gray-500">{contract.sector || '-'}</span>
                                            </div>
                                        </td>
                                        <td className={styles.td}>
                                            <span className={`${styles.badge} ${styles[contract.status]}`}>
                                                {contract.status.replace('_', ' ')}
                                            </span>
                                        </td>
                                        <td className={styles.td}>{currencyFormatter.format(contract.original_value || 0)}</td>
                                        <td className={styles.td}>{contract.target_margin_pct}%</td>
                                        <td className={styles.td}>{contract.start_date ? format(new Date(contract.start_date), 'MMM d, yyyy') : '-'}</td>
                                        <td className={styles.td}>{contract.end_date ? format(new Date(contract.end_date), 'MMM d, yyyy') : '-'}</td>
                                        <td className={styles.td}>
                                            <Button variant="ghost" size="sm" onClick={() => handleDelete(contract.id)} title="Delete Contract">
                                                <Trash2 size={16} className="text-red-500" />
                                            </Button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </Card>

            {isCreateModalOpen && (
                <CreateContractModal
                    onClose={() => setIsCreateModalOpen(false)}
                    onSuccess={() => {
                        queryClient.invalidateQueries(['contracts'])
                        setIsCreateModalOpen(false)
                    }}
                />
            )}

            {isImportModalOpen && (
                <ImportContractModal
                    isOpen={isImportModalOpen}
                    onClose={() => setIsImportModalOpen(false)}
                    onSuccess={() => {
                        queryClient.invalidateQueries(['contracts'])
                        setIsImportModalOpen(false)
                    }}
                />
            )}

            <AlertDialog
                open={alertState.open}
                onOpenChange={val => setAlertState(prev => ({ ...prev, open: val }))}
                title={alertState.title}
                description={alertState.description}
                variant={alertState.variant}
                showCancel={alertState.showCancel}
                onConfirm={alertState.onConfirm}
            />
        </div>
    )
}
