import React from 'react';
import { useNavigate } from 'react-router-dom';
import './About.css';

function About() {
    const navigate = useNavigate();

    const handleBack = () => {
        navigate('/', { replace: true });
    };

    return (
        <div className="about-container">
            <div className="about-header">
                <button className="back-btn" onClick={handleBack}>
                    ← Back
                </button>
                <h1>About Us</h1>
            </div>

            <div className="about-content">
                <div className="about-section">
                    <h2 className="section-title">WHO WE ARE?</h2>
                    <p className="section-content">
                        Waveion is a leading technology partner for innovative products and solution within the markets for Broadcast, Media & telecom & IT. With a team of highly professional motivated operations from locations from India, Singapore & Dubai.
                    </p>
                </div>

                <div className="about-section">
                    <h2 className="section-title">WHAT WE DO?</h2>
                    <div className="section-content">
                        <p>
                            Today's media market are highly driven by radically changed to IT-based technologies in all areas of broadcasting, Production and distribution. Always a step ahead, Waveion has the right answers to face these technological challenges. Besides our outstanding technical expertise as solution architect, we offer 360 degree professional services in the fields of consultancy, System Integration, technology Support as well as rental & project management for major events.
                        </p>
                        <p>
                            In areas such as strategy and management, information processing, Technical applications & business support our teams of highly skilled professionals provide support to customers along the entire media value chain. As a re-seller and representative for AV & IT Broadcast solutions, Waveion Technologies also offers the product portfolio's of selected international key manufactures.
                        </p>
                        <p>
                            Today many major broadcasters, media Network & Telecom providers relay on our expertise.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default About; 