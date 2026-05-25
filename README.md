# resume
A repo for a resume

## Documentation structure rationale

### `@fileoverview` on every file

Each file opens with a module-level docblock that answers: *what is this file's single responsibility, how does it relate to its siblings, and what would surprise a reader?* The dependency graph in `opfs.types.ts` makes it immediately clear it's a leaf with no internal imports. The `opfs.io.ts` fileoverview calls out the `SharedArrayBuffer` quirk upfront because it's the kind of thing that causes mysterious failures under `crossOriginIsolated` environments.

### Types: overview → remarks → example → references

Every exported type and interface follows that progression. The overview line is the one-liner. Remarks explain the *why* — why `ManifestEntry` excludes payload, why `ManifestWire` is an array instead of using `JSON.stringify(Map)`, why WAL ops don't include reads. The example shows a concrete value where one aids understanding. `@see` links go to MDN for browser APIs and to sibling interfaces for cross-references.

### `WALOpKind` — explicit statement about missing reads

The remarks on `WALOpKind` directly answer the question you raised: reads are absent by design, not by omission. The docs also flag read-your-own-writes as the known gap and name where it belongs (pipeline layer), so a future implementer knows exactly where to add it without having to re-derive the architectural reasoning.

### `OPFSBackend` — full workflow diagrams in fileoverview

The class-level docblock contains three ASCII diagrams: write data flow, read data flow, and the commit sequence with crash-recovery annotations at each step. These are maintenance artifacts as much as documentation — when someone changes `_commitTransaction` they can verify against the diagram that the crash-safety invariants still hold. The "Quirks" section captures the four things most likely to cause confusion: exclusive lock lifetime, no read-your-own-writes, no serializable transactions, and stub envelopes in the user eviction comparator.

### Private methods have docs too

`_applyWrite`, `_applyDelete`, `_applyClear`, `_commitTransaction`, `_replayWALIfPresent` all have remarks explaining what they deliberately do *not* do (flush the manifest to disk) and why. This prevents the common mistake of adding a `writeManifest` call inside `_applyWrite` "to be safe" — which would cause the manifest to be written N times per transaction commit instead of once.
