import { ProtocolRegistry } from '../src/protocol/protocolRegistry.js';
import { SimulatedTestProtocol } from '../src/protocol/simulatedProtocol.js';
import { PacketDecoder } from '../src/protocol/packetDecoder.js';
import { RawNetworkPacket } from '../src/types/packet.js';

export async function testProtocolSuite(): Promise<boolean> {
  console.log('--- Running Protocol Test Suite ---');
  let passed = true;

  const registry = new ProtocolRegistry();
  const simProtocol = new SimulatedTestProtocol();
  registry.register(simProtocol);

  // Test 1: Identify JSON simulated packet
  const jsonPacket: RawNetworkPacket = {
    id: 'pkt_1',
    transport: 'TCP',
    remoteAddress: '127.0.0.1',
    remotePort: 54321,
    data: Buffer.from(JSON.stringify({ simulated: true, deviceId: 'DEV-SIM-001', latitude: -25.75, longitude: 28.23 })),
    receivedAt: new Date()
  };

  const identified = registry.identifyProtocol(jsonPacket);
  if (identified?.protocolName === 'SIMULATED_TEST_PROTOCOL') {
    console.log('✓ Test 1: JSON simulated packet protocol identified');
  } else {
    console.error('✗ Test 1: Failed to identify JSON simulation protocol');
    passed = false;
  }

  // Test 2: Decode valid simulated packet
  const decoded = await PacketDecoder.decodePacket(simProtocol, jsonPacket);
  if (decoded.success && decoded.deviceId === 'DEV-SIM-001') {
    console.log('✓ Test 2: Simulated packet decoded successfully');
  } else {
    console.error('✗ Test 2: Failed to decode simulated packet', decoded);
    passed = false;
  }

  // Test 3: Reject malformed packet
  const corruptPacket: RawNetworkPacket = {
    id: 'pkt_2',
    transport: 'TCP',
    remoteAddress: '127.0.0.1',
    remotePort: 54321,
    data: Buffer.from('NOT_A_VALID_PACKET_BUFFER_AT_ALL'),
    receivedAt: new Date()
  };

  const identifiedCorrupt = registry.identifyProtocol(corruptPacket);
  if (identifiedCorrupt === null) {
    console.log('✓ Test 3: Unrecognized packet safely ignored');
  } else {
    console.error('✗ Test 3: Malformed packet matched unexpectedly');
    passed = false;
  }

  return passed;
}
