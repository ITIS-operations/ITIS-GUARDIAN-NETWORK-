import { MemoryDeviceRepository } from '../src/storage/deviceRepository.js';
import { DeviceAuthenticationService } from '../src/devices/deviceAuthentication.js';
import { DeviceRecord } from '../src/types/device.js';

export async function testDeviceRegistryAcceptanceSuite(): Promise<boolean> {
  console.log('--- TEST SUITE: GPS Device Registry & Lifecycle Acceptance ---');
  let passed = 0;
  let failed = 0;

  const repo = new MemoryDeviceRepository();
  await repo.init();
  const authService = new DeviceAuthenticationService(repo);

  // TEST 1: Unknown tracker connects -> remains UNREGISTERED
  try {
    const unknownImei = '868120039999999';
    const authResult = await authService.authenticateDevice(unknownImei);
    if (!authResult.allowed && authResult.reason === 'DEVICE_NOT_REGISTERED') {
      console.log('  [PASS] Test 1: Unknown tracker connects -> remains UNREGISTERED / NOT_REGISTERED');
      passed++;
    } else {
      console.error('  [FAIL] Test 1: Unknown tracker was unexpectedly authenticated', authResult);
      failed++;
    }
  } catch (err: any) {
    console.error('  [FAIL] Test 1 Exception:', err.message);
    failed++;
  }

  // TEST 2: Authorized technician provisions tracker -> device registered with ACTIVE state
  try {
    const newDevice: DeviceRecord = {
      id: 'DEV-ITIS-TECH-01',
      trackerDeviceId: 'GT012-PROV-8888',
      imei: '868120038888888',
      serialNumber: 'SN-GT012-8888',
      protocol: 'GT012',
      model: 'GT012-4G-SOS',
      firmwareVersion: 'v4.2.1',
      deviceState: 'ACTIVE',
      status: 'ONLINE',
      isActive: true,
      registeredAt: new Date(),
      updatedAt: new Date()
    };
    await repo.save(newDevice);

    const check = await repo.findByIdOrImei(newDevice.imei);
    const authRes = await authService.authenticateDevice(newDevice.imei);

    if (check && check.id === 'DEV-ITIS-TECH-01' && authRes.allowed && authRes.device?.deviceState === 'ACTIVE') {
      console.log('  [PASS] Test 2: Authorized technician provisions tracker -> device registered with ACTIVE state');
      passed++;
    } else {
      console.error('  [FAIL] Test 2: Provisioned device lookup or auth failed', { check, authRes });
      failed++;
    }
  } catch (err: any) {
    console.error('  [FAIL] Test 2 Exception:', err.message);
    failed++;
  }

  // TEST 3: Device assigned to learner -> assignment linkage recorded
  try {
    const assignedDev: DeviceRecord = {
      id: 'DEV-ITIS-LRN-01',
      trackerDeviceId: 'GT012-LRN-1001',
      imei: '868120037777777',
      serialNumber: 'SN-GT012-7777',
      protocol: 'GT012',
      model: 'GT012-4G-SOS',
      learnerId: 'lrn-001',
      schoolId: 'sch-001',
      deviceState: 'ACTIVE',
      status: 'ONLINE',
      isActive: true,
      registeredAt: new Date(),
      updatedAt: new Date()
    };
    await repo.save(assignedDev);

    const lookup = await repo.findByIdOrImei('868120037777777');
    if (lookup && lookup.learnerId === 'lrn-001' && lookup.schoolId === 'sch-001') {
      console.log('  [PASS] Test 3: Device assigned to learner -> assignment recorded (learnerId: lrn-001)');
      passed++;
    } else {
      console.error('  [FAIL] Test 3: Learner assignment linkage missing', lookup);
      failed++;
    }
  } catch (err: any) {
    console.error('  [FAIL] Test 3 Exception:', err.message);
    failed++;
  }

  // TEST 4: Suspended / Retired states are enforced
  try {
    const suspendedDev: DeviceRecord = {
      id: 'DEV-ITIS-SUSP-01',
      trackerDeviceId: 'GT012-SUSP-01',
      imei: '868120036666666',
      serialNumber: 'SN-GT012-6666',
      protocol: 'GT012',
      deviceState: 'SUSPENDED',
      status: 'OFFLINE',
      isActive: false,
      registeredAt: new Date(),
      updatedAt: new Date()
    };
    await repo.save(suspendedDev);

    const authRes = await authService.authenticateDevice(suspendedDev.imei);
    if (!authRes.allowed && (authRes.reason === 'DEVICE_SUSPENDED' || authRes.reason === 'DEVICE_DEACTIVATED')) {
      console.log('  [PASS] Test 4: Suspended device is blocked from active telemetry ingest');
      passed++;
    } else {
      console.error('  [FAIL] Test 4: Suspended device was not blocked', authRes);
      failed++;
    }
  } catch (err: any) {
    console.error('  [FAIL] Test 4 Exception:', err.message);
    failed++;
  }

  // TEST 5: Retired state is enforced
  try {
    const retiredDev: DeviceRecord = {
      id: 'DEV-ITIS-RET-01',
      trackerDeviceId: 'GT012-RET-01',
      imei: '868120035555555',
      serialNumber: 'SN-GT012-5555',
      protocol: 'GT012',
      deviceState: 'RETIRED',
      status: 'OFFLINE',
      isActive: false,
      registeredAt: new Date(),
      updatedAt: new Date()
    };
    await repo.save(retiredDev);

    const authRes = await authService.authenticateDevice(retiredDev.imei);
    if (!authRes.allowed && authRes.reason === 'DEVICE_RETIRED') {
      console.log('  [PASS] Test 5: Retired device is blocked permanently with DEVICE_RETIRED');
      passed++;
    } else {
      console.error('  [FAIL] Test 5: Retired device was not blocked with DEVICE_RETIRED', authRes);
      failed++;
    }
  } catch (err: any) {
    console.error('  [FAIL] Test 5 Exception:', err.message);
    failed++;
  }

  console.log(`Device Registry Acceptance Suite: ${passed} passed, ${failed} failed`);
  return failed === 0;
}
