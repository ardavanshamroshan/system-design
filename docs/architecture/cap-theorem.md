# CAP Theorem

## The core statement

In a **distributed system**, when a partition happens, you cannot have all three at 100%:

| Letter | Meaning |
|--------|---------|
| **C** Consistency | Every node sees the same up-to-date data |
| **A** Availability | Every non-failing request gets a response |
| **P** Partition tolerance | The system keeps working despite network splits |

In practice the network fails → **P is nearly mandatory**. The real choice is usually between **CP** and **AP**.

---

## Mental model

Two data centers, link between them is down (partition):

```
[Node A]  ⚡ cut  [Node B]
 Users still hit both
```

- Answer only when nodes are in sync → keep **Consistency**, sacrifice Availability (**CP**).  
- Each node answers from local data → keep **Availability**, answers may diverge (**AP**).

---

## Rough examples

| System | Common lean | Short note |
|--------|-------------|------------|
| PostgreSQL primary + sync replica | CP-ish | Writes may stop on partition |
| Cassandra / Dynamo-style | AP-ish | Accepts writes; reconciles later |
| ZooKeeper / etcd | CP | Coordination; no quorum → no answer |
| Redis Cluster | Depends on config | Don’t oversimplify — read the docs |

::: warning
CAP labels on marketing pages are sloppy; check quorum, replication, and client behavior.
:::

---

## Consistency is a spectrum

CAP gets mixed with “strong vs eventual consistency,” but they aren’t identical:

- **Strong:** after a successful write, every read sees it.  
- **Eventual:** if writes stop, replicas converge.  
- **Read-your-writes / Causal:** mid-tier guarantees for better UX.

---

## What to ask in design

1. If two users see different wallet balances, is that acceptable?  
2. If checkout is down for 30 seconds, does the business die?  
3. How likely are partitions (one DC vs multi-region)?

| Business preference | Approximate choice |
|---------------------|--------------------|
| Money, inventory, seat booking | Lean CP / strong consistency |
| Likes, feeds, approximate counters | Lean AP / eventual |
| Distributed config | Usually CP |

---

## Decision rule

1. First understand what **wrong data** means, then pick tools.  
2. “We want both C and A” without defining partition → marketing.  
3. Many systems look CA in the happy path; the real test is partition.
