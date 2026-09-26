# CAP Theorem

> Module D — System Architecture · Section 10

## Mental outline

1. [What and why](#what-and-why)  
2. [Mental model](#mental-model)  
3. [CP / AP / CA](#cp--ap--ca)  
4. [Rough system lean](#rough-system-lean)  
5. [Consistency spectrum](#consistency-spectrum)  
6. [Interview notes](#interview-notes)  
7. [Per-feature tradeoffs](#per-feature-tradeoffs)  
8. [Decision rule](#decision-rule)  
9. [Antipatterns](#antipatterns)

---

## What and why

**CAP** (Eric Brewer, 2000): in a **distributed** shared-data system, when a **network partition** happens, you cannot guarantee all three at once:

| Letter | Meaning |
|--------|---------|
| **C** Consistency | Every successful read sees the latest successful write (or an error) |
| **A** Availability | Every request to a non-failing node gets a non-error response (may be stale) |
| **P** Partition tolerance | System keeps operating despite message loss / splits between nodes |

**Why not all three?** Partitions (latency spikes, cable cuts, AZ isolation) happen. On a partition the nodes cannot reconcile. You must pick:

- Refuse / block until safe → keep **C**, drop **A** (**CP**)  
- Answer from local state → keep **A**, drop **C** (**AP**)

In practice **P is nearly mandatory** for any real distributed system. The useful choice collapses to **CP vs AP**.

::: tip
CAP **only bites during a partition**. On a healthy day C and A can both look fine. Interview trap: treating CAP as “every day, pick two forever.”
:::

Related: [API Gateway](/architecture/api-gateway) · [Outbox](/patterns/outbox) · [Brokers](/messaging/brokers)

---

## Mental model

Two servers, link down:

```
Client → [S1]  ⚡ cut  [S2] ← Client
           write X=1     read X → ?
```

Write lands on S1. Read hits S2. S1 and S2 cannot talk.

| Choice | Behavior |
|--------|----------|
| Keep **C** | S2 rejects / times out → lose **A** |
| Keep **A** | S2 returns old X → lose **C** |

That is the theorem in one diagram. Same idea USA ↔ Europe profile update: show stale name (**AP**) or error (**CP**).

---

## CP / AP / CA

### CP — Consistency + Partition tolerance

Prefer correct data; may refuse work while partitioned.

| Typical lean | Notes |
|--------------|-------|
| MongoDB (majority write concern / strict) | Wait for quorum; minority may be unavailable |
| HBase, ZooKeeper, etcd | Coordination; no quorum → no answer |
| Spanner / CockroachDB | Strong consistency; latency cost |
| MySQL/Postgres primary + sync replica | Writes may stop if quorum/sync cannot complete |

**Use when wrong data is catastrophic:** banking balances, seat booking, inventory reservation, medical records.

### AP — Availability + Partition tolerance

Prefer answering; reconcile later (eventual consistency, versioning, CRDTs, last-write-wins, …).

| Typical lean | Notes |
|--------------|-------|
| Cassandra, DynamoDB (eventual mode) | Accept writes; converge later |
| CouchDB | Multi-master + conflict docs |
| Social feeds / likes / counters | Stale for seconds–minutes is OK |

**Use when downtime hurts more than brief staleness:** newsfeed, profile picture, cart browse (checkout may still be CP).

### CA — Consistency + Availability (theoretical for distributed)

Single-node RDBMS (one MySQL/Postgres, no multi-node replication) can look CA: ACID + always answer **that** node. It is **not** partition-tolerant across nodes — if you add multi-node and a split, CAP applies. Redis **single node** similarly: not a real CAP distributed claim; it is a single point of failure.

::: warning
Marketing “we are CA” for a multi-region DB is usually wrong or means “happy path.” Label systems **CP-ish / AP-ish** and check quorum, replication, and client defaults.
:::

---

## Rough system lean

| System | Approximate lean | Short note |
|--------|------------------|------------|
| MySQL primary + hard sync replica | CP-ish | Write on primary; no quorum → may be unavailable |
| DynamoDB / Cassandra (default-ish) | AP + eventual | Always answer; may be stale |
| Redis single node | Not really distributed CAP | SPOF; CAP framing does not apply |
| Kafka | Log + replication | Tradeoff via ISR / `acks` — not a blunt CAP sticker |
| ZooKeeper / etcd | CP | Cluster coordination |
| Redis Cluster | Config-dependent | Don’t oversimplify — read the docs |

---

## Consistency spectrum

CAP “C” ≈ **linearizability / strong consistency** in the classic proof — not the same as ACID’s “C” (constraints). Spectrum you actually design with:

| Model | Guarantee | Typical use |
|-------|-----------|-------------|
| **Strong** | After successful write, every read sees it | Balances, bookings |
| **Causal** | Related events keep order (comment after post) | Collaborative feeds |
| **Read-your-writes** | You always see your own updates | Profile edit UX |
| **Eventual** | If writes stop, replicas converge | DNS, counters, likes |

Deeper than “2 of 3”: **PACELC** — if Partition → choose A or C; **Else** (normal) → choose Latency vs Consistency. CAP forbids only the tiny corner of *perfect* C + *perfect* A under partition.

---

## Interview notes

1. Start NFRs with: **“On partition, do we prefer C or A?”**  
2. CAP alone does **not** justify picking Cassandra for chat — dig into latency, write path, ops.  
3. Quote-level honesty: CAP blocks only perfect C+A under partition; partitions are rare but real.  
4. Don’t call single-node Postgres “CP” or “CA” without saying it isn’t multi-node distributed.

---

## Per-feature tradeoffs

Real products mix leanings inside one system:

| Surface | Lean | Why |
|---------|------|-----|
| Ticket **booking** | CP | Double seat = catastrophe |
| Event **description** page | AP | Stale text OK |
| **Payment / wallet** | CP-ish, single writer, transactions | Wrong money unacceptable |
| Feed / like **counter** | AP + eventual | Approximate is fine |
| Cart **add item** | Often AP | Browse must stay up |
| Cart **checkout** | Often CP | Charge once, inventory correct |

Interview line: “Consistency for the critical write path; availability for read-mostly / soft state.”

---

## Decision rule

1. Ask: **Would brief wrong data be catastrophic?** Yes → CP / strong. No → AP / eventual.  
2. Treat **P as given** in multi-node designs; argue C vs A under partition.  
3. Prefer **per-feature** CAP, not one stamp for the whole product.  
4. Happy path looking like CA ≠ CA under split — design the failure mode.  
5. Payment / inventory / seats → consistency (CP-ish, single writer, transactions). Feed / likes → AP + eventual usually enough.

---

## Antipatterns

- Saying “we want CAP all three” without defining partition behavior  
- Sticking **CP/AP labels** on databases without checking write concern / quorum / client consistency mode  
- Applying CAP to a **single node** as if it were a distributed guarantee  
- Forcing one consistency model on **every** endpoint of a large app  
- Ignoring **latency vs consistency** on the healthy path (PACELC) after only citing CAP
