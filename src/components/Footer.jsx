import React from 'react';
import { useNavigate } from 'react-router-dom';
import './Footer.css';
import FeatherIcon from 'feather-icons-react';

const Footer = () => {
  const navigate = useNavigate();

  const handleAboutUs = () => {
    navigate('/about', { replace: true });
  };

  return (
    <footer className="footer">
      <div className="footer-content">
        {/* Main Footer Sections */}
        <div className="footer-sections">
          {/* Company Section */}
          <div className="footer-section">
            <h3 className="footer-heading">Company</h3>
            <ul className="footer-links">
              <li><a href="#" className="footer-link" onClick={handleAboutUs}>About Us</a></li>
            </ul>
          </div>

          {/* Language Section */}
          <div className="footer-section">
            <h3 className="footer-heading">View Website in</h3>
            <div className="language-option">
              <span className="checkmark">✓</span>
              <span className="language-text">English</span>
            </div>
          </div>

          {/* Help Section */}
          <div className="footer-section">
            <h3 className="footer-heading">Need Help?</h3>
            <ul className="footer-links">
              <li><a href="#" className="footer-link">Visit Help Center</a></li>
              <li><a href="#" className="footer-link">Share Feedback</a></li>
            </ul>
          </div>

          {/* Social Media Section */}
          <div className="footer-section">
            <h3 className="footer-heading">Connect with Us</h3>
            <div className="language-text" style={{marginBottom: '1rem'}}>
            Waveion Technologies Pvt. Ltd.<br/>
            3rd Floor, SCO No. 36, OLD Jail Complex, Sohna Chowk,
            Gurgram, Haryana -122001<br/>
            <FeatherIcon icon="phone" size={16} /> : +91 9311 898 004 <br/>
            <FeatherIcon icon="mail" size={16} /> : info@waveiontechnologies.com <br/>
            <FeatherIcon icon="globe" size={16} /> : https://waveiontechnologies.com
            </div>
            {/* <div className="app-badges">
              <div className="app-badge google-play">
                <div className="badge-content">
                  <span className="badge-text">GET IT ON</span>
                  <span className="badge-store">Google Play</span>
                </div>
              </div>
              <div className="app-badge app-store">
                <div className="badge-content">
                  <span className="badge-text">Download on the</span>
                  <span className="badge-store">App Store</span>
                </div>
              </div>
            </div> */}
          </div>
        </div>

        {/* Copyright and Legal Links */}
        <div className="footer-bottom">
          <div className="copyright">
            © 2025 STAR. All Rights Reserved.
          </div>
          <div className="legal-links">
            <a href="#" className="legal-link">Terms Of Use</a>
            <a href="#" className="legal-link">Privacy Policy</a>
            <a href="#" className="legal-link">FAQ</a>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer; 