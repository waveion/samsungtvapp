import React, { useState, useEffect, useRef } from 'react';
import './Login.css';
import { Navigate } from 'react-router-dom';
import Toast from '../../components/Toast';

function OTPValidation({ mobileNumber, onBack, onSuccess, onToast }) {
    const [otp, setOtp] = useState(['', '', '', '', '', '']);
    const [activeIndex, setActiveIndex] = useState(0);
    const [resendTimer, setResendTimer] = useState(30);
    const [canResend, setCanResend] = useState(false);
    const [toast, setToast] = useState({ type: '', message: '', asyncFunction: null, asyncConfig: null });
    
    const inputRefs = useRef([]);

    // Timer for resend functionality
    useEffect(() => {
        let interval;
        if (resendTimer > 0) {
            interval = setInterval(() => {
                setResendTimer(prev => prev - 1);
            }, 1000);
        } else {
            setCanResend(true);
        }
        return () => clearInterval(interval);
    }, [resendTimer]);

    // Focus management for OTP inputs
    useEffect(() => {
        if (inputRefs.current[activeIndex]) {
            inputRefs.current[activeIndex].focus();
        }
    }, [activeIndex]);

    const handleKeypadClick = (value) => {
        if (value === '⌫') {
            // Backspace
            if (otp[activeIndex] !== '') {
                const newOtp = [...otp];
                newOtp[activeIndex] = '';
                setOtp(newOtp);
            } else if (activeIndex > 0) {
                const newOtp = [...otp];
                newOtp[activeIndex - 1] = '';
                setOtp(newOtp);
                setActiveIndex(activeIndex - 1);
            }
        } else if (value === '→') {
            handleSubmit();
        } else if (value === '↲') {
            if (activeIndex < 5) {
                setActiveIndex(activeIndex + 1);
            }
        } else {
            if (activeIndex < 6) {
                const newOtp = [...otp];
                newOtp[activeIndex] = value;
                setOtp(newOtp);
                
                if (activeIndex < 5) {
                    setActiveIndex(activeIndex + 1);
                }
            }
        }
    };

    const handleInputChange = (index, value) => {
        if (value.length <= 1) {
            const newOtp = [...otp];
            newOtp[index] = value;
            setOtp(newOtp);
            
            // Auto-advance to next input
            if (value && index < 5) {
                setActiveIndex(index + 1);
            }
        }
    };

    const handleInputFocus = (index) => {
        setActiveIndex(index);
    };

    const handleInputKeyDown = (e, index) => {
        if (e.key === 'Backspace') {
            e.preventDefault();
            if (otp[index] !== '') {
                const newOtp = [...otp];
                newOtp[index] = '';
                setOtp(newOtp);
            } else if (index > 0) {
                const newOtp = [...otp];
                newOtp[index - 1] = '';
                setOtp(newOtp);
                setActiveIndex(index - 1);
            }
        } else if (e.key === 'ArrowLeft' && index > 0) {
            setActiveIndex(index - 1);
        } else if (e.key === 'ArrowRight' && index < 5) {
            setActiveIndex(index + 1);
        }
    };

    const handleSubmit = () => {
        const otpString = otp.join('');
        if (otpString.length === 6) {
            // Simulate OTP validation
            const asyncFunction = async () => {
                await new Promise(resolve => setTimeout(resolve, 1000));
                // For demo, accept any 6-digit OTP
                if (otpString === '123456') {      
                    setOtp(['', '', '', '', '', '']);
                    // Call onSuccess after a delay to allow toast to show
                    setTimeout(() => {
                        onSuccess();
                    }, 1000);
                    return true;
                } else {
                    setOtp(['', '', '', '', '', '']);
                    setActiveIndex(0);
                    throw new Error('Invalid OTP');
                }
            };

            const asyncConfig = {
                loading: 'Verifying OTP...',
                success: 'OTP verified successfully!',
                error: 'Invalid OTP. Please try again.',
            };

            setToast({
                type: 'async',
                asyncFunction: asyncFunction,
                asyncConfig: asyncConfig
            });
        } else {
            setToast({ type: 'error', message: 'Please enter 6-digit OTP' });
        }
    };

    const handleResendOTP = () => {
        if (canResend) {
            setResendTimer(30);
            setCanResend(false);
            setToast({ type: 'success', message: 'OTP resent successfully!' });
        }
    };

    const formatTime = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    return (
        <div className="login-container">
            <Toast 
                type={toast.type} 
                message={toast.message} 
                asyncFunction={toast.asyncFunction}
                asyncConfig={toast.asyncConfig}
            />
            <div className="otp-header">
                <h1>Enter OTP code</h1>
                <p>Please enter 6-digit code we've sent to {mobileNumber}</p>
            </div>

            <div className="otp-content">
                {/* OTP Input Fields */}
                <div className="otp-input-container">
                    {otp.map((digit, index) => (
                        <input
                            key={index}
                            ref={el => inputRefs.current[index] = el}
                            type="text"
                            value={digit}
                            onChange={(e) => handleInputChange(index, e.target.value)}
                            onFocus={() => handleInputFocus(index)}
                            onKeyDown={(e) => handleInputKeyDown(e, index)}
                            className={`otp-input ${activeIndex === index ? 'active' : ''}`}
                            maxLength={1}
                            inputMode="numeric"
                        />
                    ))}
                </div>

                {/* Resend Timer */}
                <div className="resend-container">
                    {canResend ? (
                        <button className="resend-btn" onClick={handleResendOTP}>
                            Resend code
                        </button>
                    ) : (
                        <p className="resend-timer">
                            Re-send code in <span className="timer-highlight">{formatTime(resendTimer)}</span>
                        </p>
                    )}
                </div>                

                {/* Numeric Keypad */}
                <div className="keypad">
                    <div className="keypad-row">
                        <button onClick={() => handleKeypadClick('1')}>1</button>
                        <button onClick={() => handleKeypadClick('2')}>2</button>
                        <button onClick={() => handleKeypadClick('3')}>3</button>
                    </div>
                    <div className="keypad-row">
                        <button onClick={() => handleKeypadClick('4')}>4</button>
                        <button onClick={() => handleKeypadClick('5')}>5</button>
                        <button onClick={() => handleKeypadClick('6')}>6</button>
                    </div>
                    <div className="keypad-row">
                        <button onClick={() => handleKeypadClick('7')}>7</button>
                        <button onClick={() => handleKeypadClick('8')}>8</button>
                        <button onClick={() => handleKeypadClick('9')}>9</button>
                    </div>
                    <div className="keypad-row">                        
                        <button onClick={() => handleKeypadClick('⌫')}>⌫</button>
                        <button onClick={() => handleKeypadClick('0')}>0</button>
                        <button onClick={() => handleKeypadClick('→')} className="submit-btn">→</button>
                    </div>
                </div>
                {/* Back Button */}
                <button className="back-btn" onClick={onBack}>
                    ← Back to Login
                </button>
            </div>
        </div>
    );
}

export default OTPValidation;