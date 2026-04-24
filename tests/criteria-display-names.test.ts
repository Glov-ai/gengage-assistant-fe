import { describe, it, expect } from 'vitest';
import { formatCriteriaName } from '../src/chat/components/ComparisonTable.js';

describe('Criteria Display Name Mapping', () => {
  it('maps known field names to English labels', () => {
    expect(formatCriteriaName('screen_size')).toBe('Screen Size');
    expect(formatCriteriaName('battery_capacity')).toBe('Battery Capacity');
    expect(formatCriteriaName('energy_class')).toBe('Energy Class');
    expect(formatCriteriaName('weight')).toBe('Weight');
    expect(formatCriteriaName('ram')).toBe('RAM');
    expect(formatCriteriaName('processor')).toBe('Processor');
  });

  it('formats unknown field names by replacing underscores and capitalizing', () => {
    expect(formatCriteriaName('some_unknown_field')).toBe('Some unknown field');
    expect(formatCriteriaName('usb_port_count')).toBe('Usb port count');
  });

  it('uses Turkish locale-aware fallback capitalization by default', () => {
    expect(formatCriteriaName('istanbul_ilcesi')).toBe('İstanbul ilcesi');
    expect(formatCriteriaName('ışık_tipi')).toBe('Işık tipi');
  });

  it('uses the provided locale for fallback capitalization', () => {
    expect(formatCriteriaName('istanbul_district', undefined, 'en-US')).toBe('Istanbul district');
    expect(formatCriteriaName('istanbul_ilcesi', undefined, '')).toBe('İstanbul ilcesi');
  });

  it('falls back safely when the provided locale is invalid', () => {
    expect(formatCriteriaName('istanbul_ilcesi', undefined, 'bad locale')).toBe('İstanbul ilcesi');
  });

  it('passes through already-formatted labels unchanged', () => {
    expect(formatCriteriaName('Screen Size')).toBe('Screen Size');
  });

  it('handles single-word field names from the map', () => {
    expect(formatCriteriaName('ram')).toBe('RAM');
    expect(formatCriteriaName('color')).toBe('Color');
    expect(formatCriteriaName('brand')).toBe('Brand');
  });

  it('handles single-word field names not in the map', () => {
    expect(formatCriteriaName('bluetooth')).toBe('Bluetooth');
  });

  it('handles empty string', () => {
    expect(formatCriteriaName('')).toBe('');
  });

  it('uses locale-specific criteriaLabels when provided', () => {
    const trLabels: Record<string, string> = {
      screen_size: 'Ekran Boyutu',
      weight: 'Ağırlık',
      ram: 'RAM',
    };
    expect(formatCriteriaName('screen_size', trLabels)).toBe('Ekran Boyutu');
    expect(formatCriteriaName('weight', trLabels)).toBe('Ağırlık');
    expect(formatCriteriaName('ram', trLabels)).toBe('RAM');
  });

  it('falls back to built-in map when criteriaLabels does not have the key', () => {
    const partial: Record<string, string> = { screen_size: 'Ekran Boyutu' };
    // 'weight' not in partial, falls back to English built-in
    expect(formatCriteriaName('weight', partial)).toBe('Weight');
  });

  it('falls back to heuristic when neither map has the key', () => {
    const partial: Record<string, string> = {};
    expect(formatCriteriaName('usb_port_count', partial)).toBe('Usb port count');
  });

  it('covers all expected English mappings', () => {
    const expectedMappings: Record<string, string> = {
      screen_size: 'Screen Size',
      weight: 'Weight',
      battery_capacity: 'Battery Capacity',
      battery_life: 'Battery Life',
      storage: 'Storage',
      memory: 'Memory',
      ram: 'RAM',
      processor: 'Processor',
      camera: 'Camera',
      resolution: 'Resolution',
      display_type: 'Display Type',
      refresh_rate: 'Refresh Rate',
      color: 'Color',
      material: 'Material',
      dimensions: 'Dimensions',
      warranty: 'Warranty',
      connectivity: 'Connectivity',
      water_resistance: 'Water Resistance',
      operating_system: 'Operating System',
      brand: 'Brand',
      model: 'Model',
      price: 'Price',
      energy_class: 'Energy Class',
      noise_level: 'Noise Level',
      capacity: 'Capacity',
      power: 'Power',
      voltage: 'Voltage',
      width: 'Width',
      height: 'Height',
      depth: 'Depth',
    };

    for (const [raw, expected] of Object.entries(expectedMappings)) {
      expect(formatCriteriaName(raw)).toBe(expected);
    }
  });
});
