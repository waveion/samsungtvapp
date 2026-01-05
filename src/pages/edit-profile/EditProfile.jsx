import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './EditProfile.css';

function EditProfile() {
    const navigate = useNavigate();
    const [user, setUser] = useState(null);
    const [selectedProfile, setSelectedProfile] = useState('rishi');
    const [showProfileModal, setShowProfileModal] = useState(false);
    const [editingProfile, setEditingProfile] = useState(null);
    const [profileName, setProfileName] = useState('');
    const [isKidsProfile, setIsKidsProfile] = useState(false);

    useEffect(() => {
        const storedUser = sessionStorage.getItem('user');
        if (storedUser) {
            try {
                const userData = JSON.parse(storedUser);
                // Set user data from the new structure
                if (userData && userData.data) {
                    setUser(userData.data);
                }
            } catch (error) {
                console.error('Failed to parse user data:', error);
            }
        }
    }, []);

    const handleBack = () => {
        navigate('/profile', { replace: true });
    };

    const handleUpgradePlan = () => {
        navigate('/plan', { replace: true });
    };

    const handleUpdateMobile = () => {
        // Handle mobile number update
        console.log('Update mobile number');
    };

    const handleLogoutDevice = (deviceId) => {
        // Handle device logout
        console.log('Logout device:', deviceId);
    };

    const handleProfileSelect = (profileId) => {
        setSelectedProfile(profileId);
    };

    const handleProfileClick = (profile) => {
        if (profile.isAdd) {
            // Create new profile
            setEditingProfile(null);
            setProfileName('');
            setIsKidsProfile(false);
        } else {
            // Edit existing profile
            setEditingProfile(profile);
            setProfileName(profile.name);
            setIsKidsProfile(profile.id === 'kids');
        }
        setShowProfileModal(true);
    };

    const handleSaveProfile = () => {
        if (profileName.trim()) {
            // Handle save logic here
            console.log('Saving profile:', { name: profileName, isKids: isKidsProfile });
            setShowProfileModal(false);
            setProfileName('');
            setIsKidsProfile(false);
            setEditingProfile(null);
        }
    };

    const handleCancelProfile = () => {
        setShowProfileModal(false);
        setProfileName('');
        setIsKidsProfile(false);
        setEditingProfile(null);
    };

    const profiles = [
        {
            id: 'rishi',
            name: 'Rishi',
            avatar: 'R',
            isActive: true
        },
        {
            id: 'vikash',
            name: 'Vikash',
            avatar: 'V',
            isActive: false
        },
        {
            id: 'kids',
            name: 'Kids',
            avatar: 'K',
            isActive: false
        },
        {
            id: 'add',
            name: 'Add',
            avatar: '+',
            isAdd: true
        }
    ];

    // Generate devices based on user's package device limit
    const generateDevices = () => {
        const deviceLimit = user?.packages?.[0]?.deviceLimit || 1;
        const devices = [];
        
        // Current device
        devices.push({
            id: 'current',
            type: 'Android TV',
            icon: '💻',
            lastUsed: 'Today',
            isCurrent: true
        });
        
        // Add other devices up to the device limit
        for (let i = 1; i < deviceLimit; i++) {
            devices.push({
                id: `mobile${i}`,
                type: 'Mobile',
                icon: '📱',
                lastUsed: `${i + 1} Days Ago`
            });
        }
        
        return devices;
    };

    const devices = generateDevices();

    return (
        <div className="edit-profile-container">
            <div className="edit-profile-header">
                <button className="back-btn" onClick={handleBack}>
                    ← Back
                </button>
                <h1>Edit Profile</h1>
            </div>

            <div className="edit-profile-content">
                {/* Profiles Section */}
                <div className="section">
                    <div className="section-header">
                        <h2>Profiles</h2>
                        {/* <button className="edit-profile-btn">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M11 4H4C3.46957 4 2.96086 4.21071 2.58579 4.58579C2.21071 4.96086 2 5.46957 2 6V20C2 20.5304 2.21071 21.0391 2.58579 21.4142C2.96086 21.7893 3.46957 22 4 22H18C18.5304 22 19.0391 21.7893 19.4142 21.4142C19.7893 21.0391 20 20.5304 20 20V13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                <path d="M18.5 2.50023C18.8978 2.10244 19.4374 1.87891 20 1.87891C20.5626 1.87891 21.1022 2.10244 21.5 2.50023C21.8978 2.89801 22.1213 3.43762 22.1213 4.00023C22.1213 4.56284 21.8978 5.10244 21.5 5.50023L12 15.0002L8 16.0002L9 12.0002L18.5 2.50023Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                            Edit Profile
                        </button> */}
                    </div>
                    <div className="profiles-grid">
                        {profiles.map((profile) => (
                            <div 
                                key={profile.id}
                                className={`profile-avatar-item ${selectedProfile === profile.id ? 'active' : ''} ${profile.isAdd ? 'add-profile' : ''}`}
                                onClick={() => handleProfileClick(profile)}
                            >
                                <div className={`profile-avatar-circle ${profile.isAdd ? 'add' : ''} ${profile.id === 'kids' ? 'kids' : ''}`}>
                                    {profile.isAdd ? (
                                        <div className="add-icon">{profile.avatar}</div>
                                    ) : (
                                        <div className="avatar-content">{profile.avatar}</div>
                                    )}
                                </div>
                                <span className="profile-name">{profile.name}</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Subscription & Devices Section */}
                <div className="section">
                    <h2>Subscription & Devices</h2>
                    
                    {/* Subscription Details */}
                    <div className="subscription-details">
                        {user?.packages && user.packages.length > 0 ? (
                            user.packages.map((pkg, index) => (
                                <div key={pkg.id || index} className="subscription-info">
                                    <div className="plan-info">
                                        <span className="plan-name">{pkg.packageName}</span>
                                        <span className="next-payment">
                                            Expires on {new Date(pkg.packageExpiryDate).toLocaleDateString()}
                                        </span>
                                        <span className="plan-details">
                                            Device Limit: {pkg.deviceLimit} | Quality: {pkg.maxVideoQuality} | Price: ₹{pkg.price}
                                        </span>
                                    </div>
                                    <button className="upgrade-plan-btn" onClick={handleUpgradePlan}>
                                        Upgrade Plan
                                    </button>
                                </div>
                            ))
                        ) : (
                            <div className="subscription-info">
                                <div className="plan-info">
                                    <span className="plan-name">Free Plan</span>
                                    <span className="next-payment">No active subscription</span>
                                </div>
                                <button className="upgrade-plan-btn" onClick={handleUpgradePlan}>
                                    Upgrade Plan
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Mobile Number */}
                    <div className="mobile-number-section">
                        <div className="mobile-info">
                            <div className="mobile-label">
                                <span>Registered Mobile Number</span>
                                <span className="mobile-number">+91 {user?.mobileNo || 'No mobile number'}</span>
                            </div>
                            <button className="update-btn" onClick={handleUpdateMobile}>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <path d="M11 4H4C3.46957 4 2.96086 4.21071 2.58579 4.58579C2.21071 4.96086 2 5.46957 2 6V20C2 20.5304 2.21071 21.0391 2.58579 21.4142C2.96086 21.7893 3.46957 22 4 22H18C18.5304 22 19.0391 21.7893 19.4142 21.4142C19.7893 21.0391 20 20.5304 20 20V13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                    <path d="M18.5 2.50023C18.8978 2.10244 19.4374 1.87891 20 1.87891C20.5626 1.87891 21.1022 2.10244 21.5 2.50023C21.8978 2.89801 22.1213 3.43762 22.1213 4.00023C22.1213 4.56284 21.8978 5.10244 21.5 5.50023L12 15.0002L8 16.0002L9 12.0002L18.5 2.50023Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                </svg>
                                Update
                            </button>
                        </div>
                    </div>

                    {/* Devices Section */}
                    <div className="devices-container">
                        {/* This Device Section */}
                        <div className="device-column">
                            <h3>This Device</h3>
                            <div className="device-item">
                                <div className="device-info">
                                    <div className="device-icon">💻</div>
                                    <div className="device-details">
                                        <span className="device-type">Android TV</span>
                                        <span className="last-used">Last used : Today</span>
                                    </div>
                                </div>
                                <button 
                                    className="logout-device-btn" 
                                    onClick={() => handleLogoutDevice('current')}
                                >
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                        <path d="M9 21H5C4.46957 21 3.96086 20.7893 3.58579 20.4142C3.21071 20.0391 3 19.5304 3 19V5C3 4.46957 3.21071 3.96086 3.58579 3.58579C3.96086 3.21071 4.46957 3 5 3H9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                        <path d="M16 17L21 12L16 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                        <path d="M21 12H9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                    </svg>
                                    Log Out
                                </button>
                            </div>
                        </div>

                        {/* Other Devices Section */}
                        <div className="device-column">
                            <h3>Other Devices</h3>
                            <div className="other-devices-list">
                                {devices.filter(device => !device.isCurrent).map((device) => (
                                    <div key={device.id} className="device-item">
                                        <div className="device-info">
                                            <div className="device-icon">{device.icon}</div>
                                            <div className="device-details">
                                                <span className="device-type">{device.type}</span>
                                                <span className="last-used">Last used : {device.lastUsed}</span>
                                            </div>
                                        </div>
                                        <button 
                                            className="logout-device-btn" 
                                            onClick={() => handleLogoutDevice(device.id)}
                                        >
                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                                <path d="M9 21H5C4.46957 21 3.96086 20.7893 3.58579 20.4142C3.21071 20.0391 3 19.5304 3 19V5C3 4.46957 3.21071 3.96086 3.58579 3.58579C3.96086 3.21071 4.46957 3 5 3H9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                                <path d="M16 17L21 12L16 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                                <path d="M21 12H9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                            </svg>
                                            Log Out
                                        </button>
                                    </div>
                                ))}
                                {devices.filter(device => !device.isCurrent).length === 0 && (
                                    <div className="no-devices">
                                        <p>No other devices connected</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Profile Modal */}
            {showProfileModal && (
                <div className="modal-overlay" onClick={handleCancelProfile}>
                    <div className="profile-modal-content" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>{editingProfile ? 'Edit Profile' : 'Create a profile'}</h2>
                            <button className="modal-close" onClick={handleCancelProfile}>×</button>
                        </div>
                        <div className="modal-body">
                            <div className="profile-creation-content">
                                <div className="profile-avatar-section">
                                    <div className="profile-avatar-large">
                                        <div className="avatar-content-large">
                                            {editingProfile ? editingProfile.avatar : '👤'}
                                        </div>
                                    </div>
                                </div>
                                <div className="profile-form-section">
                                    <div className="form-group">
                                        <input
                                            type="text"
                                            value={profileName}
                                            onChange={(e) => setProfileName(e.target.value)}
                                            placeholder="Enter profile name"
                                            className="profile-name-input"
                                        />
                                    </div>
                                    <div className="kids-profile-section">
                                        <div className="kids-profile-header">
                                            <label className="kids-profile-label">Kids Profile</label>
                                            <div className="toggle-switch">
                                                <input
                                                    type="checkbox"
                                                    id="kids-toggle"
                                                    checked={isKidsProfile}
                                                    onChange={(e) => setIsKidsProfile(e.target.checked)}
                                                />
                                                <label htmlFor="kids-toggle" className="toggle-slider"></label>
                                            </div>
                                        </div>
                                        <p className="kids-profile-description">
                                            Only see Kids-friendly TV shows and Movies
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="modal-actions">
                            <button type="button" className="modal-cancel" onClick={handleCancelProfile}>
                                Cancel
                            </button>
                            <button type="button" className="modal-submit" onClick={handleSaveProfile}>
                                Save
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default EditProfile; 