import React from 'react';
import { Search } from 'lucide-react';
import styles from './GlassSearchBar.module.css';

interface GlassSearchBarProps extends React.InputHTMLAttributes<HTMLInputElement> {
    onSearch?: (value: string) => void;
    containerClassName?: string;
}

export const GlassSearchBar: React.FC<GlassSearchBarProps> = ({
    onSearch,
    containerClassName = '',
    className = '',
    onChange,
    ...props
}) => {

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (onChange) onChange(e);
        if (onSearch) onSearch(e.target.value);
    };

    return (
        <div className={`${styles.searchWrapper} ${containerClassName}`}>
            <Search className={styles.icon} size={18} />
            <input
                type="text"
                className={`${styles.input} ${className}`}
                onChange={handleChange}
                {...props}
            />
        </div>
    );
};

export default GlassSearchBar;
