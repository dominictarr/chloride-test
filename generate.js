
var sodium = require('sodium-chloride')(require('sodium-native'))
var JSONB = require('json-buffer')

var isArray = Array.isArray

function apply (ary) {
  var name = ary[0]
  var fn = sodium['crypto_'+name]
  if(!fn) throw new Error('method: crypto_'+name+' does not exist')

  try {
  return fn.apply(null, ary.slice(1).map(function (e) {
    return isArray(e) ? apply(e) : e
  }))
  } catch (err) {
    console.error('Error while running', ary)
    throw err
  }
}

function toCurve25519(keys) {
  return {
    publicKey: sodium.crypto_sign_ed25519_pk_to_curve25519(keys.publicKey),
    secretKey: sodium.crypto_sign_ed25519_sk_to_curve25519(keys.secretKey)
  }
}

var _alice = sodium.crypto_hash_sha256(new Buffer('alice'))
var _bob = sodium.crypto_hash_sha256(new Buffer('bob'))
var alice = sodium.crypto_sign_seed_keypair(_alice)
var bob = sodium.crypto_sign_seed_keypair(_bob)

var key = sodium.crypto_hash_sha256(new Buffer('key'))
var key2 = sodium.crypto_hash_sha256(new Buffer('NOT_KEY'))

var alice_curve = toCurve25519(alice)
var bob_curve = toCurve25519(bob)

var nonce = new Buffer(24)
nonce.fill(0)

var msgs = [
  'trust but verify',
// - russian proverb adopted by Ronald Regan

  'Military tactics are like unto water; '
+ 'for water in its natural course runs '
+ 'away from high places and hastens downwards. '
+ 'So in war, the way is to avoid what is strong '
+ 'and to strike at what is weak. ',
// - Sun Tzu, The Art of War

  'The last characteristic which we note in the history '
+ 'of cryptography is the division between amateur and '
+ 'professional cryptographers. Skill in production '
+ 'cryptanalysis has always been heavily on the side '
+ 'of the professionals, but innovation, particularly '
+ 'in the design of new types of cryptographic systems, '
+ 'has come primarily from the amateurs.'
// - Witfield Diffie, New Directions in Cryptography
].map(function (e) { return new Buffer(e) })

// taken from: https://github.com/jedisct1/libsodium/blob/ab4ab23d5744a8e060864a7cec1a7f9b059f9ddd/src/libsodium/crypto_scalarmult/curve25519/ref10/x25519_ref10.c#L16-L51
var low_order = [
  '00000000000000000000000000000000000000000000000000000000000000000',
  '0100000000000000000000000000000000000000000000000000000000000000', //1 in little endian
  'e0eb7a7c3b41b8ae1656e3faf19fc46ada098deb9c32b1fd866205165f49b800',
  '5f9c95bca3508c24b1d0b1559c83ef5b04445cc4581c8e86d8224eddd09f1157',
  'ecffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff7f',
  'edffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff7f',
  'eeffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff7f'
].map(function (e) {
  return Buffer.from(e, 'hex')
})

var input = [
  ['sign_seed_keypair', _alice],
  ['sign_seed_keypair', _bob],

  ['sign_detached', msgs[0], bob.secretKey],
  ['sign_detached', msgs[1], bob.secretKey],
  ['sign_detached', msgs[2], bob.secretKey],

  ['sign', msgs[0], bob.secretKey],
  ['sign', msgs[1], bob.secretKey],
  ['sign', msgs[2], bob.secretKey],

  ['sign_open', sodium.crypto_sign(msgs[0], bob.secretKey), bob.publicKey],
  ['sign_open', sodium.crypto_sign(msgs[1], bob.secretKey), bob.publicKey],
  ['sign_open', sodium.crypto_sign(msgs[2], bob.secretKey), bob.publicKey],

  ['sign_verify_detached',
    sodium.crypto_sign_detached(msgs[0], bob.secretKey),
    msgs[0], bob.publicKey
  ],
  ['sign_verify_detached',
    sodium.crypto_sign_detached(msgs[1], bob.secretKey),
    msgs[1], bob.publicKey
  ],
  ['sign_verify_detached',
    sodium.crypto_sign_detached(msgs[2], bob.secretKey),
    msgs[2], bob.publicKey
  ],

  ['sign_ed25519_pk_to_curve25519', alice.publicKey],
  ['sign_ed25519_sk_to_curve25519', bob.secretKey],
  ['sign_ed25519_pk_to_curve25519',  key], //should return null if input is not a pk

  ['scalarmult',
    alice_curve.publicKey,
    bob_curve.secretKey
  ],
  //buffer, nonce, key
  ['secretbox_easy', msgs[0], nonce, key],
  ['secretbox_easy', msgs[1], nonce, key],
  ['secretbox_easy', msgs[2], nonce, key],

  ['secretbox_open_easy', sodium.crypto_secretbox_easy(msgs[0], nonce, key), nonce, key],
  ['secretbox_open_easy', sodium.crypto_secretbox_easy(msgs[1], nonce, key), nonce, key],
  ['secretbox_open_easy', sodium.crypto_secretbox_easy(msgs[2], nonce, key), nonce, key],

  //test failing to decrypt
  ['secretbox_open_easy', sodium.crypto_secretbox_easy(msgs[0], nonce, key), nonce, key2],
  ['secretbox_open_easy', sodium.crypto_secretbox_easy(msgs[1], nonce, key), nonce, key2],
  ['secretbox_open_easy', sodium.crypto_secretbox_easy(msgs[2], nonce, key), nonce, key2],

  //buffer, nonce, key

  ['box_easy', msgs[0], nonce, bob_curve.secretKey, alice_curve.publicKey],
  ['box_easy', msgs[1], nonce, bob_curve.secretKey, alice_curve.publicKey],
  ['box_easy', msgs[2], nonce, bob_curve.secretKey, alice_curve.publicKey],

  ['box_open_easy',
    sodium.crypto_box_easy(msgs[0], nonce, bob_curve.secretKey, alice_curve.publicKey),
    nonce, bob_curve.secretKey, alice_curve.publicKey],

  ['box_open_easy',
    sodium.crypto_box_easy(msgs[1], nonce, bob_curve.secretKey, alice_curve.publicKey),
    nonce, bob_curve.secretKey, alice_curve.publicKey],

  ['box_open_easy',
    sodium.crypto_box_easy(msgs[2], nonce, bob_curve.secretKey, alice_curve.publicKey),
    nonce, bob_curve.secretKey, alice_curve.publicKey],

  ['auth', msgs[0], key],
  ['auth', msgs[1], key],
  ['auth', msgs[2], key],

  ['auth_verify', sodium.crypto_auth(msgs[0], key), msgs[0], key],
  ['auth_verify', sodium.crypto_auth(msgs[1], key), msgs[1], key],
  ['auth_verify', sodium.crypto_auth(msgs[2], key), msgs[2], key],

  ['hash', msgs[0]],
  ['hash', msgs[1]],
  ['hash', msgs[2]],

  ['hash_sha256', msgs[0]],
  ['hash_sha256', msgs[1]],
  ['hash_sha256', msgs[2]]
 
//  ['scalarmult', bob_curve.publicKey, alice_curve.secretKey]
]

var output = input.map(function (e) {
  var result
  return ['deepEquals', e, apply(e)]
})

low_order.forEach(function (e, i) {
  try {
    sodium.crypto_scalarmult(alice_curve.secretKey, e)
  } catch (err) {
    console.error(err)
    return output.push(['throws', ['scalarmult', alice_curve.secretKey, e]])
  }
  throw new Error('expected scalarmult to throw, ')
})

//console.error(input)
console.log(JSON.stringify(JSONB.stringify(output, null, 2)))

