// Light-weight pure-JS synchronous crypto shim for the browser to satisfy Vite imports of Node 'crypto'
function sha256Sync(ascii: string): string {
  function rightRotate(value: number, amount: number) {
    return (value >>> amount) | (value << (32 - amount));
  }
  
  var mathPow = Math.pow;
  var maxWord = mathPow(2, 32);
  var lengthProperty = 'length';
  var i, j;
  var result = '';

  var words: number[] = [];
  var asciiLength = ascii.length;
  
  var hash: number[] = [];
  var k: number[] = [];
  var primeCounter = 0;

  var isComposite: Record<number, number> = {};
  for (var candidate = 2; primeCounter < 64; candidate++) {
    if (!isComposite[candidate]) {
      for (i = 0; i < 313; i += candidate) {
        isComposite[i] = 1;
      }
      hash[primeCounter] = (mathPow(candidate, .5) * maxWord) | 0;
      k[primeCounter++] = (mathPow(candidate, 1/3) * maxWord) | 0;
    }
  }
  
  ascii += '\x80';
  while (ascii.length % 64 - 56) ascii += '\x00';
  for (i = 0; i < ascii.length; i++) {
    j = ascii.charCodeAt(i);
    if (j >> 8) return '';
    words[i >> 2] |= j << ((3 - i % 4) * 8);
  }
  words[words.length] = ((asciiLength * 8) / maxWord) | 0;
  words[words.length] = (asciiLength * 8) | 0;
  
  for (j = 0; j < words.length; j += 16) {
    var w = words.slice(j, j + 16);
    var oldHash = hash.slice(0);
    for (i = 0; i < 64; i++) {
      if (i >= 16) {
        w[i] = (
          rightRotate(w[i - 2], 17) ^ rightRotate(w[i - 2], 19) ^ (w[i - 2] >>> 10)
        ) + w[i - 7] + (
          rightRotate(w[i - 15], 7) ^ rightRotate(w[i - 15], 18) ^ (w[i - 15] >>> 3)
        ) + w[i - 16] | 0;
      }
      
      var a = hash[0], e = hash[4];
      var temp1 = hash[7] + (
        rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25)
      ) + (
        (e & hash[5]) ^ (~e & hash[6])
      ) + k[i] + (w[i] | 0);
      
      var temp2 = (
        rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22)
      ) + (
        (a & hash[1]) ^ (a & hash[2]) ^ (hash[1] & hash[2])
      );
      
      hash = [(temp1 + temp2) | 0].concat(hash);
      hash[4] = (hash[4] + temp1) | 0;
      hash.length = 8;
    }
    
    for (i = 0; i < 8; i++) {
      hash[i] = (hash[i] + oldHash[i]) | 0;
    }
  }
  
  for (i = 0; i < 8; i++) {
    var hex = (hash[i] >>> 0).toString(16);
    while (hex.length < 8) hex = '0' + hex;
    result += hex;
  }
  return result;
}

class Hash {
  private data: string = '';
  
  update(val: any) {
    if (typeof val === 'string') {
      this.data += val;
    } else if (val instanceof Uint8Array) {
      this.data += new TextDecoder().decode(val);
    } else if (val && typeof val.toString === 'function') {
      this.data += val.toString();
    } else {
      this.data += String(val);
    }
    return this;
  }
  
  digest(encoding?: string) {
    const hex = sha256Sync(this.data);
    if (encoding === 'hex') {
      return hex;
    }
    const arr = new Uint8Array(
      (hex.match(/.{1,2}/g) || []).map(byte => parseInt(byte, 16))
    );
    return arr;
  }
}

class Hmac {
  private data: string = '';
  update(val: any) {
    if (typeof val === 'string') {
      this.data += val;
    } else if (val instanceof Uint8Array) {
      this.data += new TextDecoder().decode(val);
    } else if (val && typeof val.toString === 'function') {
      this.data += val.toString();
    }
    return this;
  }
  digest(encoding?: string) {
    const hex = sha256Sync(this.data);
    if (encoding === 'hex') return hex;
    return new Uint8Array((hex.match(/.{1,2}/g) || []).map(b => parseInt(b, 16)));
  }
}

class Signer {
  private data: string = '';
  update(val: any) {
    if (typeof val === 'string') {
      this.data += val;
    } else if (val instanceof Uint8Array) {
      this.data += new TextDecoder().decode(val);
    }
    return this;
  }
  sign(privateKey: any, encoding?: string) {
    if (encoding === 'base64') return 'dummy-sig-base64';
    if (encoding === 'hex') return 'dummy-sig-hex';
    return new Uint8Array(32);
  }
}

class Verifier {
  private data: string = '';
  update(val: any) {
    if (typeof val === 'string') {
      this.data += val;
    } else if (val instanceof Uint8Array) {
      this.data += new TextDecoder().decode(val);
    }
    return this;
  }
  verify(publicKey: any, signature: any, encoding?: string) {
    return true;
  }
}

export function createHash(algo: string) {
  return new Hash();
}

export function createHmac(algo: string, key: any) {
  return new Hmac();
}

export function createSign(algo: string) {
  return new Signer();
}

export function createVerify(algo: string) {
  return new Verifier();
}

export function sign(algo: any, data: any, key: any) {
  return new Uint8Array(32);
}

export function verify(algo: any, data: any, key: any, signature: any) {
  return true;
}

export function timingSafeEqual(a: any, b: any) {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a[i] ^ b[i];
  }
  return result === 0;
}

export function generateKeyPairSync(type: string, options: any) {
  return {
    publicKey: 'dummy-public-key',
    privateKey: 'dummy-private-key'
  };
}

export function randomBytes(size: number) {
  const arr = new Uint8Array(size);
  if (typeof window !== 'undefined' && window.crypto && window.crypto.getRandomValues) {
    window.crypto.getRandomValues(arr);
  } else {
    for (let i = 0; i < size; i++) {
      arr[i] = Math.floor(Math.random() * 256);
    }
  }
  return arr;
}

export function randomUUID() {
  if (typeof window !== 'undefined' && window.crypto && window.crypto.randomUUID) {
    return window.crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

export default {
  createHash,
  createHmac,
  createSign,
  createVerify,
  sign,
  verify,
  timingSafeEqual,
  generateKeyPairSync,
  randomBytes,
  randomUUID
};
