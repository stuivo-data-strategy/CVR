import React, { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/Card'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { Link } from 'react-router-dom'
import { FileText, ArrowRight, AlertTriangle, TrendingDown } from 'lucide-react'
import { Button } from '../components/ui/Button'

// Simple Slider Component (since we don't have a UI library one handy yet, or we can use native input range)
const RiskSlider = ({ value, onChange }) => (
    <div className="flex flex-col gap-2 w-full max-w-xs">
        <label className="text-sm font-medium text-gray-700">Margin Warning Threshold: <span className="text-red-600 font-bold">{value}%</span></label>
        <input
            type="range"
            min="0"
            max="20"
            step="1"
            value={value}
            onChange={(e) => onChange(Number(e.target.value))}
            className="w-full accent-red-500 cursor-pointer"
        />
        <span className="text-xs text-gray-500">Show contracts with margin below {value}%</span>
    </div>
)

export default function Reports() {
    const [riskThreshold, setRiskThreshold] = useState(10) // Default 10%
    const [selectedPortfolio, setSelectedPortfolio] = useState('All')

    // Fetch Portfolio Risk Data
    const { data: riskData } = useQuery({
        queryKey: ['portfolio_risk'],
        queryFn: async () => {
            const { data } = await supabase.from('view_portfolio_risk').select('*')
            return data
        }
    })

    // Filter Logic
    const portfolios = ['All', ...new Set(riskData?.map(d => d.business_unit).filter(Boolean))]

    const filteredContracts = riskData?.filter(c => {
        const matchesPortfolio = selectedPortfolio === 'All' || c.business_unit === selectedPortfolio
        const isAtRisk = c.current_forecast_margin_pct < riskThreshold
        return matchesPortfolio && isAtRisk
    }) || []

    const totalExposure = filteredContracts.reduce((sum, c) => sum + (c.final_revenue || 0), 0)
    const weightedMargin = filteredContracts.length > 0
        ? (filteredContracts.reduce((sum, c) => sum + (c.final_margin || 0), 0) / totalExposure) * 100
        : 0

    return (
        <div className="p-6 max-w-7xl mx-auto flex flex-col gap-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold">Portfolio Analytics</h1>
                    <p className="text-gray-500">Executive risk identification and margin forensics.</p>
                </div>

                <div className="flex items-center gap-4 bg-white p-3 rounded border shadow-sm">
                    <RiskSlider value={riskThreshold} onChange={setRiskThreshold} />
                    <div className="h-10 w-px bg-gray-200 mx-2 hidden md:block"></div>
                    <div className="flex flex-col gap-1">
                        <label className="text-xs font-semibold text-gray-600">Portfolio Slice</label>
                        <select
                            className="text-sm border rounded p-1"
                            value={selectedPortfolio}
                            onChange={(e) => setSelectedPortfolio(e.target.value)}
                        >
                            {portfolios.map(p => <option key={p} value={p}>{p}</option>)}
                        </select>
                    </div>
                </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className="bg-red-50 border-red-100">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-red-800 text-lg">{filteredContracts.length} Contracts</CardTitle>
                        <CardDescription className="text-red-600">Identified "At Risk" (&lt; {riskThreshold}%)</CardDescription>
                    </CardHeader>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-gray-900 text-lg">${(totalExposure / 1000000).toFixed(1)}M</CardTitle>
                        <CardDescription>Total Revenue Exposure</CardDescription>
                    </CardHeader>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className={`text-lg ${weightedMargin < riskThreshold ? 'text-red-600' : 'text-gray-900'}`}>{weightedMargin.toFixed(1)}%</CardTitle>
                        <CardDescription>Weighted Average Margin</CardDescription>
                    </CardHeader>
                </Card>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Detailed Risk Analysis</CardTitle>
                    <CardDescription>Contracts matching your risk criteria.</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="text-xs text-gray-700 uppercase bg-gray-50 border-b">
                                <tr>
                                    <th className="px-4 py-3">Contract</th>
                                    <th className="px-4 py-3">Portfolio</th>
                                    <th className="px-4 py-3 text-right">Revenue ($)</th>
                                    <th className="px-4 py-3 text-right">Target %</th>
                                    <th className="px-4 py-3 text-right">Forecast %</th>
                                    <th className="px-4 py-3 text-right">Variance</th>
                                    <th className="px-4 py-3 text-center">Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredContracts.map(c => (
                                    <tr key={c.contract_id} className="bg-white border-b hover:bg-gray-50">
                                        <td className="px-4 py-3 font-medium text-gray-900">
                                            {c.contract_code} - {c.contract_name}
                                            {c.margin_variance < -5 && <span className="ml-2 text-xs bg-red-100 text-red-800 px-1.5 py-0.5 rounded">Critical</span>}
                                        </td>
                                        <td className="px-4 py-3 text-gray-500">{c.business_unit}</td>
                                        <td className="px-4 py-3 text-right">${(c.final_revenue / 1000).toFixed(0)}k</td>
                                        <td className="px-4 py-3 text-right text-gray-500">{c.target_margin_pct}%</td>
                                        <td className={`px-4 py-3 text-right font-bold ${c.current_forecast_margin_pct < c.target_margin_pct ? 'text-red-600' : 'text-green-600'}`}>
                                            {c.current_forecast_margin_pct.toFixed(1)}%
                                        </td>
                                        <td className="px-4 py-3 text-right flex items-center justify-end gap-1">
                                            {c.margin_variance < 0 ? <TrendingDown size={14} className="text-red-500" /> : null}
                                            <span className={c.margin_variance < 0 ? 'text-red-600' : 'text-green-600'}>{c.margin_variance.toFixed(1)}%</span>
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            <Link to={`/contracts/${c.contract_id}?tab=reports`}>
                                                <Button variant="ghost" size="sm" className="h-8 text-blue-600 hover:text-blue-800">
                                                    View Report <ArrowRight size={14} className="ml-1" />
                                                </Button>
                                            </Link>
                                        </td>
                                    </tr>
                                ))}
                                {filteredContracts.length === 0 && (
                                    <tr>
                                        <td colSpan={7} className="px-4 py-8 text-center text-gray-500 italic">
                                            No contracts found below {riskThreshold}% margin in this portfolio.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
