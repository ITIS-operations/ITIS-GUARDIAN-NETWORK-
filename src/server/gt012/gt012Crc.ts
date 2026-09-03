/**
 * ITIS GUARDIAN NETWORK — GT012 GPS TRACKER COMMUNICATION PROTOCOL
 * Authoritative CRC-ITU (CRC-16-CCITT) Checksum Engine
 * 
 * Polynomial: x^16 + x^12 + x^5 + 1 (0x1021)
 * Standard table lookup implementation compliant with GT012 / Concox / Topin hardware standards.
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
   * In GT012 protocol: calculated from Packet Length up to Information Serial Number.
   */
  public static calculate(buffer: Buffer | Uint8Array, start = 0, length?: number): number {
    const end = length !== undefined ? start + length : buffer.length;
    let crc = 0x0000; // Standard GT012 initial value is 0x0000 (or 0xFFFF in inverted variant)

    for (let i = start; i < end; i++) {
      const byte = buffer[i];
      const tabIndex = ((crc >> 8) ^ byte) & 0xff;
      crc = ((crc << 8) ^ CRC_ITU_TABLE[tabIndex]) & 0xffff;
    }

    return crc;
  }

  /**
   * Calculate CRC using 0xFFFF seed for alternative GPS tracker variants if needed
   */
  public static calculateWithSeed(buffer: Buffer | Uint8Array, seed = 0xffff, start = 0, length?: number): number {
    const end = length !== undefined ? start + length : buffer.length;
    let crc = seed & 0xffff;

    for (let i = start; i < end; i++) {
      const byte = buffer[i];
      const tabIndex = ((crc >> 8) ^ byte) & 0xff;
      crc = ((crc << 8) ^ CRC_ITU_TABLE[tabIndex]) & 0xffff;
    }

    return crc;
  }

  /**
   * Validates CRC of a GT012 packet buffer.
   * Packet structure:
   * [0,1]: 0x78 0x78
   * [2]: Length (L bytes from protocol number to serial number)
   * [3]: Protocol Number
   * [4..2+L-2]: Information Content
   * [2+L-1, 2+L]: Serial Number
   * [2+L+1, 2+L+2]: Expected CRC
   * [2+L+3, 2+L+4]: 0x0D 0x0A
   */
  public static validate(packet: Buffer): boolean {
    if (packet.length < 10) return false;
    if (packet[0] !== 0x78 || packet[1] !== 0x78) return false;

    const length = packet[2];
    const totalExpectedLength = length + 5; // 2 start bytes + 1 length byte + length payload + 2 CRC bytes + 2 stop bytes = length + 5?
    // In GT012: Total bytes = 2 (start) + 1 (len) + length (which is protocol + content + serial) + 2 (crc) + 2 (stop)
    // = length + 7 bytes total.
    const packetLengthTotal = length + 7;
    if (packet.length < packetLengthTotal) return false;

    // CRC is calculated over bytes from index 2 to index (2 + length) inclusive -> (1 + length) bytes
    const calculatedCrc = GT012Crc.calculate(packet, 2, length + 1);
    
    // Extract CRC bytes from packet (2 bytes immediately before the 0x0D 0x0A stop bytes)
    const crcOffset = 2 + length + 1;
    const packetCrc = packet.readUInt16BE(crcOffset);

    return calculatedCrc === packetCrc;
  }
}
