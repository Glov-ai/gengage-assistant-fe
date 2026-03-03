import { describe, it, expect } from 'vitest';
import { formatCriteriaName } from '../src/chat/components/ComparisonTable.js';

describe('Criteria Display Name Mapping', () => {
  it('maps known field names to Turkish labels', () => {
    expect(formatCriteriaName('screen_size')).toBe('Ekran Boyutu');
    expect(formatCriteriaName('battery_capacity')).toBe('Batarya Kapasitesi');
    expect(formatCriteriaName('energy_class')).toBe('Enerji Sınıfı');
    expect(formatCriteriaName('weight')).toBe('Ağırlık');
    expect(formatCriteriaName('ram')).toBe('RAM');
    expect(formatCriteriaName('processor')).toBe('İşlemci');
  });

  it('formats unknown field names by replacing underscores and capitalizing', () => {
    expect(formatCriteriaName('some_unknown_field')).toBe('Some unknown field');
    expect(formatCriteriaName('usb_port_count')).toBe('Usb port count');
  });

  it('passes through already-formatted labels unchanged', () => {
    // If the backend already provided a human-readable label (no underscores),
    // it should pass through as-is with first letter capitalized
    expect(formatCriteriaName('Ekran Boyutu')).toBe('Ekran Boyutu');
  });

  it('handles single-word field names from the map', () => {
    expect(formatCriteriaName('ram')).toBe('RAM');
    expect(formatCriteriaName('color')).toBe('Renk');
    expect(formatCriteriaName('brand')).toBe('Marka');
  });

  it('handles single-word field names not in the map', () => {
    expect(formatCriteriaName('bluetooth')).toBe('Bluetooth');
  });

  it('handles empty string', () => {
    expect(formatCriteriaName('')).toBe('');
  });

  it('covers all expected Turkish mappings', () => {
    const expectedMappings: Record<string, string> = {
      screen_size: 'Ekran Boyutu',
      weight: 'Ağırlık',
      battery_capacity: 'Batarya Kapasitesi',
      battery_life: 'Batarya Ömrü',
      storage: 'Depolama',
      memory: 'Bellek',
      ram: 'RAM',
      processor: 'İşlemci',
      camera: 'Kamera',
      resolution: 'Çözünürlük',
      display_type: 'Ekran Tipi',
      refresh_rate: 'Yenileme Hızı',
      color: 'Renk',
      material: 'Malzeme',
      dimensions: 'Boyutlar',
      warranty: 'Garanti',
      connectivity: 'Bağlantı',
      water_resistance: 'Su Dayanıklılığı',
      operating_system: 'İşletim Sistemi',
      brand: 'Marka',
      model: 'Model',
      price: 'Fiyat',
      energy_class: 'Enerji Sınıfı',
      noise_level: 'Gürültü Seviyesi',
      capacity: 'Kapasite',
      power: 'Güç',
      voltage: 'Voltaj',
      width: 'Genişlik',
      height: 'Yükseklik',
      depth: 'Derinlik',
    };

    for (const [raw, expected] of Object.entries(expectedMappings)) {
      expect(formatCriteriaName(raw)).toBe(expected);
    }
  });
});
