/**
 * Visualization exports
 *
 * Central export point for all visualization types.
 */

export { SpectrumBars } from './SpectrumBars.js';
export { Waveform } from './Waveform.js';

/**
 * Visualization Registry
 *
 * Use this to get a list of all available visualization types.
 */
export const VISUALIZATION_TYPES = {
	SPECTRUM: 'spectrum',
	WAVEFORM: 'waveform'
};

/**
 * Get visualization class by type name
 */
export function getVisualizationClass(type) {
	switch (type) {
		case VISUALIZATION_TYPES.SPECTRUM:
			return SpectrumBars;
		case VISUALIZATION_TYPES.WAVEFORM:
			return Waveform;
		default:
			return null;
	}
}
