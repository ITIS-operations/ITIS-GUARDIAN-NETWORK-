import { GeofenceEngine } from '../src/geofence/geofenceEngine.js';

export async function testGeofenceSuite(): Promise<boolean> {
  console.log('--- Running Geofence Test Suite ---');
  let passed = true;

  const engine = new GeofenceEngine();
  engine.registerGeofence({
    id: 'geo_school_01',
    name: 'Pretoria School Zone',
    type: 'CIRCLE',
    centerLatitude: -25.7590,
    centerLongitude: 28.2340,
    radiusMeters: 500,
    isActive: true
  });

  // Test 1: Inside geofence center
  const resultsInside = engine.evaluate('DEV-001', -25.7590, 28.2340);
  if (resultsInside.length === 1 && resultsInside[0].isInside) {
    console.log('✓ Test 1: Coordinate correctly detected INSIDE circle geofence');
  } else {
    console.error('✗ Test 1: Inside evaluation failed', resultsInside);
    passed = false;
  }

  // Test 2: Moving outside triggers EXIT event
  const resultsOutside = engine.evaluate('DEV-001', -25.7900, 28.2340); // ~3.4km away
  if (resultsOutside.length === 1 && !resultsOutside[0].isInside && resultsOutside[0].event === 'EXIT') {
    console.log('✓ Test 2: Transition from inside to outside correctly generated EXIT event');
  } else {
    console.error('✗ Test 2: Exit event generation failed', resultsOutside);
    passed = false;
  }

  // Test 3: Returning inside triggers ENTER event
  const resultsReenter = engine.evaluate('DEV-001', -25.7591, 28.2341);
  if (resultsReenter.length === 1 && resultsReenter[0].isInside && resultsReenter[0].event === 'ENTER') {
    console.log('✓ Test 3: Transition back into perimeter correctly generated ENTER event');
  } else {
    console.error('✗ Test 3: Enter event generation failed', resultsReenter);
    passed = false;
  }

  return passed;
}
