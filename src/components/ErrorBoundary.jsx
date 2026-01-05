import React from 'react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    // Mark that an error occurred, but we will still try to keep rendering children.
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    try {
      // eslint-disable-next-line no-console
      console.error('[ErrorBoundary]', error, info);
    } catch {}
  }

  render() {
    // Even if an error was caught, keep rendering children.
    // The error has been logged in componentDidCatch, but we avoid
    // showing any user-facing message or overlay.
    return this.props.children;
  }
}


