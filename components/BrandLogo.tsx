import React from 'react';

interface BrandLogoProps {
    className?: string;
    isDarkMode?: boolean;
}

const BrandLogo: React.FC<BrandLogoProps> = ({ className = "size-10", isDarkMode }) => {
    const [isDark, setIsDark] = React.useState(isDarkMode ?? document.documentElement.classList.contains('dark'));

    React.useEffect(() => {
        if (isDarkMode !== undefined) {
            setIsDark(isDarkMode);
        } else {
            const observer = new MutationObserver(() => {
                setIsDark(document.documentElement.classList.contains('dark'));
            });
            observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
            return () => observer.disconnect();
        }
    }, [isDarkMode]);

    const logoSrc = isDark ? "/assets/logo-dark.png" : "/assets/logo-light.png";

    return (
        <div className={`flex items-center justify-center overflow-hidden rounded-full ${className}`}>
            <img
                src={logoSrc}
                alt="Asterix Logo"
                className="size-full object-cover scale-110"
            />
        </div>
    );
};

export default BrandLogo;
