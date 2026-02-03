import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Button } from '../components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card'
import styles from './Login.module.css'

export default function Login() {
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState(null)

    const navigate = useNavigate()

    const handleLogin = async (e) => {
        e.preventDefault()
        setLoading(true)
        setError(null)

        // For now, since RLS is loose and we want to just test UI, we might let them pass or actually auth
        // The instructions said "Enable Supabase email/password login"

        const { error } = await supabase.auth.signInWithPassword({
            email,
            password,
        })

        if (error) {
            setError(error.message)
            setLoading(false)
        } else {
            navigate('/dashboard')
        }
    }

    const handleSignUp = async (e) => {
        e.preventDefault()
        setLoading(true)
        setError(null)

        const { error } = await supabase.auth.signUp({
            email,
            password,
            options: {
                data: {
                    full_name: email.split('@')[0], // Placeholder name
                }
            }
        })

        if (error) {
            setError(error.message)
        } else {
            setError('Check your email for the confirmation link!')
        }
        setLoading(false)
    }

    return (
        <div className={styles.container}>
            <Card className={styles.loginCard}>
                <CardHeader>
                    <CardTitle>CVR System Login</CardTitle>
                </CardHeader>
                <CardContent>
                    <form className={styles.form} onSubmit={handleLogin}>
                        <div className={styles.field}>
                            <label className={styles.label}>Email</label>
                            <input
                                type="email"
                                className={styles.input}
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                            />
                        </div>
                        <div className={styles.field}>
                            <label className={styles.label}>Password</label>
                            <input
                                type="password"
                                className={styles.input}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                            />
                        </div>

                        {error && <div className={styles.error}>{error}</div>}

                        <div className={styles.actions}>
                            <Button type="submit" disabled={loading} className={styles.fullWidth}>
                                {loading ? 'Loading...' : 'Sign In'}
                            </Button>
                            <Button
                                type="button"
                                disabled={loading}
                                variant="ghost"
                                onClick={handleSignUp}
                                className={styles.fullWidth}
                            >
                                Sign Up
                            </Button>
                        </div>
                    </form>
                </CardContent>
            </Card>
        </div>
    )
}
