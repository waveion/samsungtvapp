import React from 'react';
import { Navigate } from 'react-router-dom';

const ProtectedRoute = ({ children }) => {
    let authed = false;
    let authFailReason = '';
    
    // Temporary bypass to skip login/auth checks
    // Auth enabled: require valid user in storage
    const BYPASS_AUTH = false;
    if (BYPASS_AUTH) {
        console.log('[AUTH] BYPASS_AUTH is true - skipping auth check');
        return children;
    }
    
    try {
        const raw = sessionStorage.getItem('user') || localStorage.getItem('user');
        
        if (!raw) {
            authFailReason = 'No user data in storage';
            authed = false;
        } else {
            try {
                const parsed = JSON.parse(raw);
                
                // Try multiple ways to find customer number
                const cn = parsed?.data?.customerNumber || 
                          parsed?.customerNumber || 
                          parsed?.data?.username || // Fallback to username
                          parsed?.credentials?.username;
                
                if (cn) {
                    authed = true;
                    console.log('[AUTH] Authentication successful:', {
                        customerNumber: cn,
                        source: parsed?.data?.customerNumber ? 'data.customerNumber' :
                                parsed?.customerNumber ? 'customerNumber' :
                                parsed?.data?.username ? 'data.username' : 'credentials.username'
                    });
                } else {
                    authFailReason = 'No customer number or username found';
                    authed = false;
                    console.error('[AUTH] Authentication FAILED - No customer identifier');
                    console.error('[AUTH] Parsed user object:', JSON.stringify(parsed, null, 2));
                }
            } catch (parseError) {
                authFailReason = 'Failed to parse user data';
                authed = false;
                console.error('[AUTH] Failed to parse user data:', parseError);
            }
        }
    } catch (storageError) {
        authFailReason = 'Failed to access storage';
        authed = false;
        console.error('[AUTH] Storage access error:', storageError);
    }

    if (!authed) {
        console.warn('[AUTH] ⚠️ Redirecting to login - Reason:', authFailReason);
        console.warn('[AUTH] Current path:', window.location.pathname);
        return <Navigate to="/panmetro-login" replace />;
    }

    return children;
};

export default ProtectedRoute;