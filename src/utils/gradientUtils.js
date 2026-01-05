/**
 * Generate CSS gradient string based on gradient data
 * @param {Object} gradientData - The gradient data object
 * @param {string} gradientData.type - 'linear' or 'radial'
 * @param {number} gradientData.angle - Angle for linear gradients (degrees)
 * @param {Array} gradientData.colors - Array of color objects with color and percentage
 * @returns {string} CSS gradient string
 */
export const generateGradientCSS = (gradientData) => {
    if (!gradientData || !gradientData.colors || gradientData.colors.length === 0) {
        return '';
    }

    const colorString = gradientData.colors
        .map(colorObj => `${colorObj.color} ${colorObj.percentage}%`)
        .join(', ');

    if (gradientData.type === 'radial') {
        return `radial-gradient(circle at center, ${colorString})`;
    } else {
        // Default to linear gradient
        const angle = gradientData.angle || 0;
        return `linear-gradient(${angle}deg, ${colorString})`;
    }
};

/**
 * Apply gradient to element style
 * @param {Object} gradientData - The gradient data object
 * @returns {Object} Style object with background property
 */
export const getGradientStyle = (gradientData) => {
    if (!gradientData) {
        return {};
    }

    return {
        background: generateGradientCSS(gradientData)
    };
};