import React, { useState, useEffect } from 'react';
import './Login.css';
import QRCode from './../../assets/qrcode.png';
import { Link, useLocation, useNavigate  } from "react-router-dom";
import Toast from '../../components/Toast';
import OTPValidation from './OTPValidation';
import API from '../../services/api';

function Login() { 
    const navigate = useNavigate();
    const [mobileNumber, setMobileNumber] = useState('');
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [toast, setToast] = useState({ type: '', message: '', asyncFunction: null, asyncConfig: null });
    const [showOTPValidation, setShowOTPValidation] = useState(false);

    // Check if user is already authenticated
    useEffect(() => {
        const user = sessionStorage.getItem('user');
        if (user) {
            navigate('/', { replace: true });
        }
    }, [navigate]);

    const handleKeypadClick = (value) => {
        if (value === '⌫') {
            setMobileNumber(prev => prev.slice(0, -1));
        } else {
            setMobileNumber(prev => prev + value);
        }
    };

    const handleSendOTP = () => {
        if (mobileNumber === '9876543210') {
            setToast({ type: 'success', message: 'OTP sent successfully!' });
            // Delay navigation to show toast first
            setTimeout(() => {
                setShowOTPValidation(true);
            }, 1000);
        } else if (mobileNumber.length >= 10) {
            setToast({ type: 'success', message: 'OTP sent successfully!' });
            // Delay navigation to show toast first
            setTimeout(() => {
                setShowOTPValidation(true);
            }, 1000);
        } else {
            setToast({ type: 'error', message: 'Please enter a valid mobile number' });
        }
    };

    const handleUserLogin = async (e) => {
        e.preventDefault();
        if (username && password) {
            const asyncFunction = async () => {
                const res = await API.post("/app/tv-users/login", { username, password });
                
                // Clear any existing data first
                sessionStorage.removeItem("token");
                sessionStorage.removeItem("user");
                
                // Store new data based on the actual API response
                sessionStorage.setItem("user", JSON.stringify(res));
                
                setTimeout(() => {
                    navigate("/", { replace: true });
                }, 1000);
                return res;
            };

            const asyncConfig = {
                loading: 'Logging in...',
                success: 'Login successful!',
                error: 'Login failed. Please check your credentials.',
            };

            setToast({
                type: 'async',
                asyncFunction: asyncFunction,
                asyncConfig: asyncConfig
            });
        } else {
            setToast({ type: 'error', message: 'Please enter both username and password' });
        }
    };

    const handleUserSignup = async () => {
        if (username && password) {
            try {
                // const res = await API.post("/auth/signup", { email, password });
                setToast({ type: 'success', message: 'Signup successful! You can now login with your credentials.' });        
                setUsername('');
                setPassword('');
            } catch (err) {                
                setUsername('');
                setPassword('');
                setToast({ type: 'error', message: err?.message || 'Signup failed. Please try again.' });
            }
        } else {
            setToast({ type: 'error', message: 'Please enter both username and password' });
        }
    };

    const handleBackToLogin = () => {
        setShowOTPValidation(false);
        setMobileNumber('');
    };

    const handleOTPSuccess = () => {
        setToast({ type: 'success', message: 'Login successful! Welcome to the application.' });
        setTimeout(() => {
            navigate('/', { replace: true });
        }, 1000);
    };

    // Show OTP validation page if mobile number is entered
    if (showOTPValidation) {
        return (
            <OTPValidation 
                mobileNumber={mobileNumber}
                onBack={handleBackToLogin}
                onSuccess={handleOTPSuccess}
                onToast={setToast}
            />
        );
    }

    return (
        <div className="login-container">
            <Toast 
                type={toast.type} 
                message={toast.message} 
                asyncFunction={toast.asyncFunction}
                asyncConfig={toast.asyncConfig}
            />
            <div className="login-header">
                <h1>Login or Signup to continue</h1>
                <p>Scan QR Code or use User Login to continue</p>
            </div>            
            <div className="login-content">
                {/* Left Section - QR Code */}
                <div className="qr-section">
                    <h3>Use Camera App to Scan QR</h3>
                    <p>Click on the link generated to redirect to the application</p>
                    <div className="qr-code-container">
                        <div className="qr-code">
                            {/* Placeholder QR code - in real app, use a QR code library */}
                            <div className="qr-placeholder">
                                <div className="qr-pattern">                                    
                                    <img src={QRCode} alt="QR Code" style={{objectFit: 'contain'}} />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Center Divider */}
                <div className="divider">
                    <div className="divider-line-top"></div>
                    <span className="divider-text">OR</span>
                    <div className="divider-line-bottom"></div>
                </div>                
                
                {/* Right Section - User Login Form */}
                <div className="user-login-section">
                    <h3>User Login</h3>
                    <p>Enter your credentials to login to the application</p>
                    <form onSubmit={handleUserLogin} className="user-login-form">
                        <div className="form-group">
                            <label htmlFor="username">Username</label>
                            <input
                                type="text"
                                id="username"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                placeholder="Enter your username"
                                required
                            />
                        </div>
                        <div className="form-group">
                            <label htmlFor="password">Password</label>
                            <input
                                type="password"
                                id="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="Enter your password"
                                required
                            />
                        </div>
                        <div className="form-actions">
                            <button type="button" className="signup-btn" onClick={handleUserSignup}>
                                Signup
                            </button>
                            <button type="submit" className="login-btn">
                                Login
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}

export default Login;