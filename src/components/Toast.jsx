import React from 'react';
import toast, { Toaster } from 'react-hot-toast';

const Toast = ({ type, message, asyncFunction, asyncConfig }) => {
    const showToast = async () => {
        switch (type) {
            case 'success':
                toast.success(message);
                break;
            case 'error':
                toast.error(message);
                break;
            case 'loading':
                toast.loading(message);
                break;
            case 'info':
                toast(message);
                break;
            case 'async':
                if (asyncFunction && asyncConfig) {
                    const loadingToast = toast.loading(asyncConfig.loading);
                    
                    try {
                        await asyncFunction();
                        toast.success(asyncConfig.success, { id: loadingToast });
                    } catch (error) {
                        toast.error(asyncConfig.error, { id: loadingToast });
                        console.error('Async operation failed:', error);
                    }
                }
                break;
            default:
                toast(message);
        }
    };

    // Auto-show toast when component mounts with type and message
    React.useEffect(() => {
        if (type && (message || (asyncFunction && asyncConfig))) {
            showToast();
        }
    }, [type, message, asyncFunction, asyncConfig]);

    return (
        <Toaster 
            position="top-center"
            toastOptions={{
                duration: 2000,
                style: {
                    background: '#1a1a1a',
                    color: '#fff',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '12px',
                    fontSize: '14px',
                    padding: '16px',
                },
                success: {
                    iconTheme: {
                        primary: '#00d4ff',
                        secondary: '#fff',
                    },
                    style: {
                        background: 'linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%)',
                        border: '1px solid #00d4ff',
                    },
                },
                error: {
                    iconTheme: {
                        primary: '#ff4757',
                        secondary: '#fff',
                    },
                    style: {
                        background: 'linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%)',
                        border: '1px solid #ff4757',
                    },
                },
                loading: {
                    iconTheme: {
                        primary: '#00d4ff',
                        secondary: '#fff',
                    },
                    style: {
                        background: 'linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%)',
                        border: '1px solid #00d4ff',
                    },
                },
            }}
        />
    );
};

export default Toast; 