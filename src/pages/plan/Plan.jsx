import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './Plan.css';

function Plan() {
    const navigate = useNavigate();
    const [selectedPlan, setSelectedPlan] = useState('super-ads-free');

    const plans = [
        {
            id: 'super',
            name: 'Super',
            price: '899',
            period: '/yr',
            features: [
                'All content (Movies, TV Shows, Live TV)',
                'Ads free movies and shows (except sports)',
                '2 devices can be logged in',
                'Full HD 1080p Video Quality',
                'Dolby Atmos'
            ]
        },
        {
            id: 'super-ads-free',
            name: 'Super + Ads Free',
            price: '1099',
            period: '/yr',
            features: [
                'All content (Movies, TV Shows, Live TV)',
                'Ads free Movies, Shows and Live TV',
                '2 devices can be logged in',
                'Full HD 1080p Video Quality',
                'Dolby Atmos'
            ]
        },
        {
            id: 'premium',
            name: 'Premium',
            price: '1349',
            period: '/yr',
            features: [
                'All content (Movies, TV Shows, Live TV)',
                'Ads free Movies, Shows and Live TV',
                '4 devices can be logged in',
                '4K 2160p + Dolby Vision Video Quality',
                'Dolby Atmos'
            ]
        }
    ];

    const handlePlanSelect = (planId) => {
        setSelectedPlan(planId);
    };

    const handleUpgrade = () => {
        // Handle upgrade logic here
        console.log('Upgrading to plan:', selectedPlan);
        // You can add API call here
    };

    const handleBack = () => {
        navigate('/profile', { replace: true });
    };

    const selectedPlanData = plans.find(plan => plan.id === selectedPlan);
    const originalPrice = selectedPlanData?.price || '1099';    
    const remainingAmount = '647';
    const discountedPrice = '₹' + (parseFloat(originalPrice) - parseFloat(remainingAmount));

    return (
        <div className="plan-container">
            <div className="plan-header">
                <button className="back-btn" onClick={handleBack}>
                    ← Back
                </button>
                <h1>Upgrade to get more out of your subscription</h1>
            </div>

            <div className="plans-grid">
                {plans.map((plan) => (
                    <div 
                        key={plan.id}
                        className={`plan-card ${selectedPlan === plan.id ? 'selected' : ''}`}
                        onClick={() => handlePlanSelect(plan.id)}
                    >
                        {selectedPlan === plan.id && (
                            <div className="selected-badge">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <path d="M9 12L11 14L15 10M21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                </svg>
                            </div>
                        )}
                        
                        <div className="plan-header">
                            <h3>{plan.name}</h3>
                            <div className="plan-price">
                                <span className="price">₹{plan.price}</span>
                                <span className="period">{plan.period}</span>
                            </div>
                        </div>

                        <div className="plan-features">
                            {plan.features.map((feature, index) => (
                                <div key={index} className="feature-item">
                                    <span className="feature-icon">✓</span>
                                    <span className="feature-text">{feature}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>

            <div className="upgrade-section">
                <div className="payment-details">
                    <h3>You pay</h3>
                    <div className="price-breakdown">
                        <div className="final-price">
                            <span className="amount">{discountedPrice}</span>
                            <span className="original-price">{originalPrice}</span>
                        </div>
                        <div className="breakdown">
                            <div className="breakdown-item">
                                <span>Super Annual Plan + Ads Free Price:</span>
                                <span>₹{originalPrice}</span>
                            </div>
                            <div className="breakdown-item">
                                <span>Remaining amount in your current plan: &nbsp;</span>
                                <span> ₹{remainingAmount}</span>
                            </div>
                            <div className="breakdown-item total">
                                <span>Amount Payable:</span>
                                <span>{discountedPrice}</span>
                            </div>
                        </div>
                    </div>
                </div>

                <button className="upgrade-now-btn" onClick={handleUpgrade}>
                    Upgrade Now
                </button>
            </div>
        </div>
    );
}

export default Plan; 