/**
 * =====================================================================
 * ITIS DEDICATED GPS TELEMETRY SERVER - PROTOCOL ADAPTER & FRAMER
 * Extracts discrete frames from TCP stream buffers
 * =====================================================================
 */

export interface ExtractedFrame {
  rawBuffer: Buffer;
  rawString: string;
  protocolHint: 'GT012' | 'ASCII' | 'JSON' | 'UNKNOWN';
}

export class StreamingProtocolFramer {
  /**
   * Slice one or more complete frames from an accumulated TCP byte buffer.
   * Returns extracted frames and any leftover incomplete bytes.
   */
  public static extractFrames(buffer: Buffer): { frames: ExtractedFrame[]; remainder: Buffer } {
    const frames: ExtractedFrame[] = [];
    let offset = 0;

    while (offset < buffer.length) {
      // 1. Check for GT012 Concox binary packet (0x78 0x78)
      if (
        offset + 5 <= buffer.length &&
        buffer[offset] === 0x78 &&
        buffer[offset + 1] === 0x78
      ) {
        const lengthField = buffer[offset + 2];
        const totalExpectedLength = lengthField + 5; // 2 start + 1 len + lengthField + 2 stop

        if (offset + totalExpectedLength <= buffer.length) {
          const packetSlice = buffer.slice(offset, offset + totalExpectedLength);
          
          // Verify 0x0D 0x0A stop bytes
          if (
            packetSlice[packetSlice.length - 2] === 0x0d &&
            packetSlice[packetSlice.length - 1] === 0x0a
          ) {
            frames.push({
              rawBuffer: packetSlice,
              rawString: packetSlice.toString('hex'),
              protocolHint: 'GT012'
            });
            offset += totalExpectedLength;
            continue;
          }
        } else {
          // Packet is incomplete; wait for next TCP chunk
          break;
        }
      }

      // 2. Check for ASCII delimited packet ($TRK, $SOS, $HB, etc.)
      if (buffer[offset] === 0x24 || buffer[offset] === 0x2b) { // '$' or '+'
        let newlineIndex = -1;
        for (let i = offset; i < buffer.length; i++) {
          if (buffer[i] === 0x0a) { // '\n'
            newlineIndex = i;
            break;
          }
        }

        if (newlineIndex !== -1) {
          const packetSlice = buffer.slice(offset, newlineIndex + 1);
          const str = packetSlice.toString('utf8').trim();
          frames.push({
            rawBuffer: packetSlice,
            rawString: str,
            protocolHint: 'ASCII'
          });
          offset = newlineIndex + 1;
          continue;
        } else {
          // Incomplete ASCII line; wait for newline
          break;
        }
      }

      // 3. Check for JSON telemetry payload ('{')
      if (buffer[offset] === 0x7b) { // '{'
        // Scan for matching balanced braces
        let depth = 0;
        let jsonEndIndex = -1;
        for (let i = offset; i < buffer.length; i++) {
          if (buffer[i] === 0x7b) depth++;
          else if (buffer[i] === 0x7d) {
            depth--;
            if (depth === 0) {
              jsonEndIndex = i;
              break;
            }
          }
        }

        if (jsonEndIndex !== -1) {
          const packetSlice = buffer.slice(offset, jsonEndIndex + 1);
          frames.push({
            rawBuffer: packetSlice,
            rawString: packetSlice.toString('utf8').trim(),
            protocolHint: 'JSON'
          });
          offset = jsonEndIndex + 1;
          continue;
        } else {
          // Incomplete JSON object; wait for closing brace
          break;
        }
      }

      // 4. If current byte is whitespace or carriage return, skip it
      if (buffer[offset] === 0x20 || buffer[offset] === 0x0d || buffer[offset] === 0x0a) {
        offset++;
        continue;
      }

      // 5. Unknown or unaligned byte: advance by 1 byte to re-synchronize
      offset++;
    }

    const remainder = buffer.slice(offset);
    return { frames, remainder };
  }
}
