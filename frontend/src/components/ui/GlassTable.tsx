import React from 'react';
import styles from './GlassTable.module.css';

interface Column<T> {
    key: string | keyof T;
    header: React.ReactNode;
    render?: (item: any) => React.ReactNode;
    align?: 'left' | 'center' | 'right';
    width?: string;
}

interface GlassTableProps<T> {
    data: T[];
    columns: Column<T>[];
    keyExtractor: (item: any) => string;
    onRowClick?: (item: any) => void;
    loading?: boolean;
    emptyMessage?: string;
    className?: string;
}

export function GlassTable<T>({
    data,
    columns,
    keyExtractor,
    onRowClick,
    loading = false,
    emptyMessage = "No records found.",
    className = ''
}: GlassTableProps<T>) {
    return (
        <div className={`${styles.tableWrapper} ${className}`}>
            <table className={styles.table}>
                <thead>
                    <tr>
                        {columns.map((col, idx) => (
                            <th
                                key={String(col.key) + idx}
                                className={`${styles.th} ${col.align ? styles[`align-${col.align}`] : ''}`}
                                style={{ width: col.width }}
                            >
                                {col.header}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {loading ? (
                        <tr>
                            <td colSpan={columns.length} className={styles.loadingCell}>
                                <div className={styles.loadingWrapper}>
                                    <div className={styles.spinner}></div>
                                    <span>Loading data...</span>
                                </div>
                            </td>
                        </tr>
                    ) : data.length === 0 ? (
                        <tr>
                            <td colSpan={columns.length} className={styles.emptyCell}>
                                {emptyMessage}
                            </td>
                        </tr>
                    ) : (
                        data.map((item) => (
                            <tr
                                key={keyExtractor(item)}
                                className={`${styles.tr} ${onRowClick ? styles.clickable : ''}`}
                                onClick={() => onRowClick && onRowClick(item)}
                            >
                                {columns.map((col, idx) => (
                                    <td
                                        key={String(col.key) + idx}
                                        className={`${styles.td} ${col.align ? styles[`align-${col.align}`] : ''}`}
                                    >
                                        {col.render ? col.render(item) : (item as any)[col.key]}
                                    </td>
                                ))}
                            </tr>
                        ))
                    )}
                </tbody>
            </table>
        </div>
    );
}

export default GlassTable;
