# Replication

> Module D — System Architecture · Section 9.6 (after Fallacies / CAP foundations)

## Mental outline

1. [What and why](#what-and-why)  
2. [Mental model](#mental-model)  
3. [Sync vs async](#sync-vs-async)  
4. [Topologies](#topologies)  
5. [Lag, durability, and read routing](#lag-durability-and-read-routing)  
6. [Failover and split-brain](#failover-and-split-brain)  
7. [Quorum and PACELC](#quorum-and-pacelc)  
8. [Laravel / Postgres in practice](#laravel--postgres-in-practice)  
9. [Real challenges](#real-challenges)  
10. [Interview notes](#interview-notes)  
11. [Decision rule](#decision-rule)  
12. [Antipatterns](#antipatterns)  
13. [Mental drill](#mental-drill)

---

## What and why

**Replication** copies the same logical data to multiple nodes so that:

- reads scale (replicas),
- a node death is survivable (HA),
- geography is closer to users (latency).

It is **not** free. Every replica adds: lag risk, failover complexity, conflict surface, and ops cost.

| Goal | Replication helps? | Main tax |
|------|--------------------|----------|
| More read QPS | Yes (read replicas) | Stale reads |
| Survive disk/node loss | Yes | Failover correctness |
| Multi-region write | Hard | Conflicts / latency |
| Strong consistency everywhere | Often **hurts** latency | Sync quorum |

Related: [Fallacies & PACELC](/architecture/fallacies-pacelc) · [CAP](/architecture/cap-theorem) · [Locking](/database/locking) · [Outbox](/patterns/outbox)

---

## Mental model

One **writer truth** (or several, if multi-leader) plus **followers** that apply the same change stream:

```
Client write ──► Primary ──WAL/binlog──► Replica A
                     │                      │
                     └──────────────────► Replica B
Client read  ◄── primary and/or replicas (policy!)
```

Key questions every design must answer:

1. **Who accepts writes?** (single primary vs multi-leader)  
2. **When is a write “done”?** (local fsync vs wait for N replicas)  
3. **Where do reads go?** (always primary / sticky / any replica)  
4. **What if primary dies mid-flight?** (failover + fencing)

::: tip
Replication copies **history of changes**. It does not invent a new consistency model by itself — **ack policy + read routing** decide PACELC lean.
:::

---

## Sync vs async

| Mode | Write ACK when… | Failure mode | Lean |
|------|-----------------|--------------|------|
| **Async** | Primary durable (local) | Replica can miss last N commits if primary burns | Low L, weaker durability |
| **Sync** (full) | All replicas ACK | Any replica down → writes stall | Stronger, high L |
| **Quorum / semi-sync** | Majority (or designated standby) ACK | Minority loss OK; majority loss → refuse or promote carefully | PC/EC-ish |

```
Async:     Client ← ACK ← Primary          (replica catches up later)
Semi-sync: Client ← ACK ← Primary ← ACK ← Standby
Sync all:  Client ← ACK ← Primary ← ACK ← All replicas
```

**Rule of thumb:** money / inventory → at least **semi-sync or quorum**. Analytics / cache warmers → async OK.

---

## Topologies

### Single-leader (primary / secondary)

Most Laravel/Postgres/MySQL setups.

| Pros | Cons |
|------|------|
| Simple conflict story (one writer) | Primary is write bottleneck |
| Well-understood failover | Failover mistakes → split-brain |
| Easy mental model | Cross-region writes always hit one place |

### Multi-leader

Writes accepted in ≥2 regions.

| Pros | Cons |
|------|------|
| Local write latency | Conflict resolution mandatory |
| Survive region write outage | App must handle diverged rows |

Use only with **clear merge rules** (CRDT, LWW with version vectors, or domain “winner”). Never multi-leader for wallets without a conflict story.

### Leaderless (Dynamo-style)

Client writes to N nodes; quorum R/W. See [CAP](/architecture/cap-theorem) + NWR. Powerful, ops-heavy — not default for classic RDBMS apps.

---

## Lag, durability, and read routing

**Replication lag** = time between primary commit and replica apply.

```
t=0  primary commits order #1001 paid
t=1.2s replica still shows unpaid   ← lag window
```

### Read-your-writes

After a successful write, the same user must see it. Options:

| Strategy | How |
|----------|-----|
| **Primary sticky** | Route that session / user to primary for T seconds |
| **Read-after-write token** | Client sends `last_write_lsn` / timestamp; replica serves only if caught up |
| **Always primary for mutating flows** | Checkout, profile save confirmation |

```php
// Conceptual Laravel — sticky primary after write
session(['read_from_primary_until' => now()->addSeconds(5)]);

$connection = session('read_from_primary_until')?->isFuture()
    ? 'pgsql_primary'
    : 'pgsql_replica';

$order = DB::connection($connection)
    ->table('orders')
    ->where('id', $orderId)
    ->first();
```

```python
# Same idea — don’t serve “payment success” page from a lagging replica
def choose_connection(user_just_wrote: bool) -> str:
    return "primary" if user_just_wrote else "replica"
```

### Durability ≠ visibility

Semi-sync can make a write **durable on standby** while a **different replica** used for reads is still behind. Separate concerns:

- **Durability policy** (fsync / sync_commit / `rpl_semi_sync`)  
- **Read routing policy** (which node for which query)

---

## Failover and split-brain

**Failover:** promote a replica to primary when the old primary is unreachable.

**Split-brain:** two nodes both think they are primary → divergent writes → nightmare merge (especially money).

```
AZ-1 Primary ◄──X──► AZ-2 Replica (promoted?
         │                    │
      still accepts         also accepts
         writes               writes
              ╲             ╱
               divergent DB
```

### Hard requirements for safe failover

1. **Fencing** — old primary must not accept writes after promote (STONITH, revoked leases, disk fencing).  
2. **Single writer lease** — via consensus (Patroni + etcd/ZooKeeper) or cloud managed failover.  
3. **App reconnect** — pools drop dead primary; discover new writer DNS.  
4. **Replay / catch-up** — new primary must have the latest known durable position (or accept data loss explicitly).

```php
// App-side: treat connection errors as “maybe failover”, not infinite retry on dead IP
try {
    DB::connection('pgsql')->transaction(fn () => $this->placeOrder($cmd));
} catch (QueryException $e) {
    if ($this->isConnectionLost($e)) {
        // brief backoff; DNS/ProxySQL/PgBouncer should point at new primary
        usleep(200_000);
        DB::purge('pgsql');
        DB::reconnect('pgsql');
        // retry ONLY if operation is idempotent
    }
    throw $e;
}
```

::: danger
Automatic failover **without fencing** is often worse than downtime. Dual primary for payments is a career-limiting event.
:::

---

## Quorum and PACELC

Replication choices are PACELC dials:

| Setting | Under partition | Healthy path |
|---------|-----------------|--------------|
| Async + read replicas | Often **A** (stale OK) | **L** (fast) — PA/EL lean |
| Sync quorum writes | Prefer **C** (refuse if no quorum) | Extra **C** cost → higher latency — PC/EC lean |
| Multi-leader + LWW | **A** with conflict | Low L, weak C |

NWR reminder (leaderless / Dynamo-style):

- **N** copies, **W** write ACKs, **R** read nodes  
- Strongish read if `R + W > N`

Classic RDBMS single-primary is usually: **W = primary (+ optional sync standby)**, reads optional from replicas with lag.

---

## Laravel / Postgres in practice

### Connections

```php
// config/database.php (sketch)
'pgsql' => [ /* default — often primary */ ],
'pgsql_replica' => [
    'driver' => 'pgsql',
    'host' => env('DB_REPLICA_HOST'),
    // read-only user recommended
],
```

```php
// Explicit read offload — never guess for money paths
$products = DB::connection('pgsql_replica')
    ->table('products')
    ->where('active', true)
    ->paginate(40);

DB::connection('pgsql')->transaction(function () use ($order) {
    // writes always primary
    $order->markPaid();
});
```

### Postgres knobs (conceptual)

| Knob | Effect |
|------|--------|
| `synchronous_commit = on` | Wait for local flush (not necessarily replica) |
| `synchronous_standby_names` | Wait for named standby(s) — semi-sync / sync |
| Streaming replication | WAL ship to replicas |
| Logical replication | Table-level / cross-version; lag + conflict rules differ |

MySQL cousins: binlog, `rpl_semi_sync_master_enabled`, GTID failover.

### What Laravel does **not** do for you

- Choose sync vs async  
- Fence a zombie primary  
- Guarantee read-your-writes across `pgsql_replica`  

Those are **infra + routing policy**. App code only respects the policy.

---

## Real challenges

### Challenge A — Support sees unpaid; customer has receipt

Payment wrote primary. Support admin UI reads replica (lag 3 s). Agent refunds “unpaid” order → double mess.

| Cause | Fix |
|-------|-----|
| Read routing ignored mutating context | Sticky primary / token for ops tools too |
| Assumed lag ≈ 0 | Fallacy #2 |

### Challenge B — “Zero downtime failover” loses last 40 orders

Async replica promoted after primary disk death. Last WAL not shipped → orders “paid” on dead primary never existed on new primary. Customers charged by PSP; DB says no order.

| Cause | Fix |
|-------|-----|
| Async durability + automatic promote | Semi-sync / quorum; or accept loss **and** reconcile from PSP webhooks |
| No outbox/PSP reconciliation | Idempotent webhook consumer rebuilds truth |

```php
// PSP webhook is source of money truth when DB failover loses tail
public function handlePaymentSucceeded(array $payload): void
{
    Order::query()->updateOrCreate(
        ['psp_payment_id' => $payload['id']],
        ['status' => 'paid', 'paid_at' => $payload['created']],
    );
}
```

### Challenge C — Split-brain after flaky VPN between AZs

Both sides promote. Inventory decremented twice on different primaries. Merge script “picks max version” → stock wrong.

| Cause | Fix |
|-------|-----|
| Failover without quorum/lease | Patroni/etcd or managed HA with fencing |
| LWW on inventory | Wrong merge function for stock — use domain rules + audit |

### Challenge D — Replica pool for “speed” on checkout

Checkout reads stock from replica, writes reserve on primary. Race: two checkouts see stock=1 on lagging replicas → oversell.

| Cause | Fix |
|-------|-----|
| Mixed consistency in one flow | Reserve on primary with [locking](/database/locking) / atomic decrement |
| PACELC mismatch | Checkout needs PC/EC lean, not PA/EL |

```php
DB::connection('pgsql')->transaction(function () use ($sku) {
    $row = DB::table('inventory')->where('sku', $sku)->lockForUpdate()->first();
    if ($row->qty < 1) {
        throw new OutOfStock();
    }
    DB::table('inventory')->where('sku', $sku)->decrement('qty');
});
```

---

## Interview notes

1. Draw **primary + replicas**, then ask: sync or async? where do reads go?  
2. Say **lag** explicitly; give read-your-writes strategy.  
3. Failover: mention **fencing / split-brain** — not just “promote replica”.  
4. Tie to PACELC: async replicas = EL; sync quorum = EC.  
5. Don’t claim “replication = strong consistency”.  

---

## Decision rule

1. **Single writer** by default; multi-leader only with a conflict protocol.  
2. Money / stock / seats: write (+ critical read-after-write) on **primary**; prefer **semi-sync/quorum** durability.  
3. Catalog / feed reads: replicas OK; document max acceptable lag.  
4. Failover: **fencing > clever scripts**. Downtime beats dual primary for payments.  
5. After write: sticky primary or LSN gate — never “hope lag is zero”.  
6. Reconcile external money (PSP) with **idempotent webhooks** — replication is not a ledger.

---

## Antipatterns

- All reads on replica, including post-checkout confirmation  
- Async replication + automatic failover treated as “RPO = 0”  
- Hard-coded primary IP (topology fallacy)  
- Multi-leader without merge rules  
- Using `max(updated_at)` to merge bank balances  
- Assuming Laravel `DB::connection('mysql')` failover is solved because RDS exists — still define read policy  

---

## Mental drill

You run Postgres primary + 2 async replicas behind Laravel:

1. User pays; immediately GETs `/orders/{id}` — which connection? Why?  
2. Primary dies; replica lag was 2 s — what can you lose? How do you detect it?  
3. You enable sync to one standby — what did you buy? what did you pay?  
4. Admin “refund unpaid” bug — which policy failed?  
5. Next pattern: multi-step **Order → Pay → Ship** across services — why replication alone won’t save you → [Saga](/patterns/saga).
