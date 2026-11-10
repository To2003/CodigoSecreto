import { randomInt } from 'node:crypto';
import { ROOM_CODE_ALPHABET, ROOM_CODE_LENGTH } from '@clave/shared';

/** A fresh 4-letter code (SPEC §2.3) not in use. Crypto randomness: codes are guessable otherwise. */
export function generateRoomCode(taken: (code: string) => boolean): string {
  for (;;) {
    let code = '';
    for (let i = 0; i < ROOM_CODE_LENGTH; i++) {
      code += ROOM_CODE_ALPHABET.charAt(randomInt(ROOM_CODE_ALPHABET.length));
    }
    if (!taken(code)) return code;
  }
}
