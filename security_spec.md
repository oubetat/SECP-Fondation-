# Security Specification: CAD Product Governance

## Data Invariants
1. A Product must always have an `ownerId` matching the creator's UID.
2. The `ownerId` field is immutable after creation.
3. Only the owner can read, update, or delete their products.
4. Product IDs must follow the standard ID regex: `^[a-zA-Z0-9_\-]+$`.

## The "Dirty Dozen" Payloads (Deny Cases)
1. **Identity Spoofing**: Create product with `ownerId` of another user.
2. **Identity Escalation**: Update a product owned by another user.
3. **Privilege Escalation**: Update `ownerId` of an existing product.
4. **ID Poisoning**: Create product with a 2KB string as ID.
5. **Payload Bloat**: Create product with a description exceeding 1000 characters.
6. **Type Mismatch**: Set `updatedAt` as a boolean.
7. **Malformed ID**: Create product with `id` containing special characters like `*` or `!`.
8. **Orphaned Write**: Create product without an `id`.
9. **State Corruption**: Update product type to an invalid enum value (e.g., "MALICIOUS_ENGINE").
10. **Blanket Read Attack**: Attempt to list all products without being signed in.
11. **Cross-User Leak**: Attempt to list all products and expect to see other users' data.
12. **System Field Injection**: Attempt to write a field not defined in the blueprint schema.

## Test Runner Logic
The `firestore.rules.test.ts` will verify these payloads using `@firebase/rules-unit-testing`.
