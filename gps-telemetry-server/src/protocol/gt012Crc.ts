/**
 * ITIS GUARDIAN NETWORK — GPS TELEMETRY SERVER
 * GT012 / Concox CRC-ITU (CRC-16-CCITT) Checksum Engine
 * 
 * Polynomial: x^16 + x^12 + x^5 + 1 (0x1021)
 * Standard table lookup implementation compliant with GT012 tracker hardware.
 */

// Precomputed 256-entry lookup table for CRC-ITU (0x1021)
const CRC_ITU_TABLE: number[] = new Array(256);

(function initCrcTable() {
  const polynomial = 0x1021;
  for (let i = 0; i < 256; i++) {
    let curr = i << 8;
    for (let j = 0; j < 8; j++) {
      if ((curr & 0x8000) !== 0) {
        curr = ((curr << 1) ^ polynomial) & 0xffff;
      } else {
        curr = (curr << 1) & 0xffff;
      }
    }
    CRC_ITU_TABLE[i] = curr;
  }
})();

export class GT012Crc {
  /**
   * Calculate CRC-ITU (16-bit) over a Buffer or byte array.
   * In GT012 protocol: calculated from Packet Length (index 2) up to Information Serial Number.
   */
  public static calculate(buffer: Buffer | Uint8Array, start = 0, length?: number): number {
    const end = length !== undefined ? start + length : buffer.length;
    let crc = 0x0000;

    for (let i = start; i < end; i++) {
      const byte = buffer[i];
      const tabIndex = ((crc >> 8) ^ byte) & 0xff;
      crc = ((crc << 8) ^ CRC_ITU_TABLE[tabIndex]) & 0xffff;
    }

    return crc;
  }

  /**
   * Validates CRC of a GT012 packet buffer.
   */
  public static validate(packet: Buffer): boolean {
    if (packet.length < 10) return false;
    if (packet[0] !== 0x78 || packet[1] !== 0x78) return false;

    const stopByteOffset = packet.length - 2;
    if (packet[stopByteOffset] !== 0x0d || packet[stopByteOffset + 1] !== 0x0a) {
      return false;
    }

    const crcOffset = stopByteOffset - 2;
    const packetCrc = packet.readUInt16BE(crcOffset);
    const crcCalculationLength = crcOffset - 2; // from index 2 to before crcOffset
    const calculatedCrc = GT012Crc.calculate(packet, 2, crcCalculationLength);

    return calculatedCrc === packetCrc;
  }
}
