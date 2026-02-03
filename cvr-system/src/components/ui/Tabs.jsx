import React from 'react'
import styles from './Tabs.module.css'
import { cn } from '../../lib/utils'

export function Tabs({ defaultValue, children, className, ...props }) {
    const [activeTab, setActiveTab] = React.useState(defaultValue)

    const childrenWithProps = React.Children.map(children, child => {
        if (React.isValidElement(child)) {
            return React.cloneElement(child, { activeTab, setActiveTab })
        }
        return child
    })

    return <div className={cn(styles.tabs, className)} {...props}>{childrenWithProps}</div>
}

export function TabsList({ children, className, activeTab, setActiveTab, ...props }) {
    const childrenWithProps = React.Children.map(children, child => {
        if (React.isValidElement(child)) {
            return React.cloneElement(child, {
                isActive: child.props.value === activeTab,
                onClick: () => setActiveTab(child.props.value)
            })
        }
        return child
    })

    return <div className={cn(styles.list, className)} {...props}>{childrenWithProps}</div>
}

export function TabsTrigger({ value, children, className, isActive, onClick, ...props }) {
    return (
        <button
            className={cn(styles.trigger, isActive && styles.active, className)}
            onClick={onClick}
            {...props}
        >
            {children}
        </button>
    )
}

export function TabsContent({ value, children, className, activeTab, ...props }) {
    if (value !== activeTab) return null
    return <div className={cn(styles.content, className)} {...props}>{children}</div>
}
